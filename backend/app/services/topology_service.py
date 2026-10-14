"""
In-memory topology state management.

This module owns a single authoritative copy of the network graph.
All routing algorithms and API handlers read from and write to this
state through the exported functions.

Persistence across server restarts is NOT implemented in this version.
The design uses a plain Python dictionary + threading.Lock so it can be
extended to JSON-file or database backends by replacing the load/save
functions only.
"""

from __future__ import annotations

import copy
import json
import threading
from pathlib import Path
from typing import Optional

from app.models.schemas import NetworkLink, RouterNodeData, RouterId, LinkStatus
from app.services.cost_service import calculate_cost

# ---------------------------------------------------------------------------
# Thread safety
# ---------------------------------------------------------------------------

_lock = threading.Lock()

# ---------------------------------------------------------------------------
# Internal state
# ---------------------------------------------------------------------------

_routers: list[RouterNodeData] = []
_links: list[NetworkLink] = []

# ---------------------------------------------------------------------------
# Default topology path
# ---------------------------------------------------------------------------

_DEFAULT_TOPOLOGY_PATH = Path(__file__).parent.parent / "data" / "default_topology.json"


# ---------------------------------------------------------------------------
# Private helpers
# ---------------------------------------------------------------------------


def _compute_link_cost(link_data: dict) -> float:
    return calculate_cost(
        bandwidth_mbps=link_data["bandwidthMbps"],
        delay_ms=link_data["delayMs"],
        congestion_percent=link_data["congestionPercent"],
    )


def _load_default() -> tuple[list[RouterNodeData], list[NetworkLink]]:
    """Parse the default_topology.json and return typed objects."""
    with open(_DEFAULT_TOPOLOGY_PATH, "r", encoding="utf-8") as fh:
        raw = json.load(fh)

    routers = [RouterNodeData(**r) for r in raw["routers"]]
    links: list[NetworkLink] = []
    for ld in raw["links"]:
        ld["cost"] = _compute_link_cost(ld)
        links.append(NetworkLink(**ld))

    return routers, links


# ---------------------------------------------------------------------------
# Initialise on import
# ---------------------------------------------------------------------------


def _initialise() -> None:
    global _routers, _links
    _routers, _links = _load_default()


_initialise()


# ---------------------------------------------------------------------------
# Public read API
# ---------------------------------------------------------------------------


def get_routers() -> list[RouterNodeData]:
    with _lock:
        return copy.deepcopy(_routers)


def get_links() -> list[NetworkLink]:
    with _lock:
        return copy.deepcopy(_links)


def get_link_by_id(link_id: str) -> Optional[NetworkLink]:
    with _lock:
        for lk in _links:
            if lk.id == link_id:
                return copy.deepcopy(lk)
    return None


# ---------------------------------------------------------------------------
# Public write API
# ---------------------------------------------------------------------------


def fail_link(link_id: str) -> Optional[NetworkLink]:
    """Set link status to 'failed'. Return updated link or None if not found."""
    with _lock:
        from datetime import datetime, timezone

        for lk in _links:
            if lk.id == link_id:
                lk.status = LinkStatus.FAILED
                lk.failedAt = datetime.now(timezone.utc).isoformat()
                # Mirror status on router interfaces
                _sync_interface_status(lk.source, lk.target, "down")
                _sync_interface_status(lk.target, lk.source, "down")
                return copy.deepcopy(lk)
    return None


def restore_link(link_id: str) -> Optional[NetworkLink]:
    """Restore a failed link. Return updated link or None if not found."""
    with _lock:
        for lk in _links:
            if lk.id == link_id:
                lk.status = LinkStatus.ACTIVE
                lk.failedAt = None
                _sync_interface_status(lk.source, lk.target, "up")
                _sync_interface_status(lk.target, lk.source, "up")
                return copy.deepcopy(lk)
    return None


def update_link_metrics(
    link_id: str,
    *,
    cost: Optional[float] = None,
    bandwidth_mbps: Optional[float] = None,
    delay_ms: Optional[float] = None,
    congestion_percent: Optional[float] = None,
) -> Optional[NetworkLink]:
    """Apply metric updates and recalculate derived cost.  Returns updated link."""
    with _lock:
        for lk in _links:
            if lk.id == link_id:
                if bandwidth_mbps is not None:
                    lk.bandwidthMbps = bandwidth_mbps
                if delay_ms is not None:
                    lk.delayMs = delay_ms
                if congestion_percent is not None:
                    lk.congestionPercent = congestion_percent
                # If caller explicitly sets cost, respect it;
                # otherwise recompute from the formula.
                if cost is not None:
                    lk.cost = cost
                else:
                    lk.cost = calculate_cost(
                        lk.bandwidthMbps, lk.delayMs, lk.congestionPercent
                    )
                return copy.deepcopy(lk)
    return None


def reset() -> tuple[list[RouterNodeData], list[NetworkLink]]:
    """Restore the factory-default topology. Returns (routers, links)."""
    global _routers, _links
    with _lock:
        _routers, _links = _load_default()
        return copy.deepcopy(_routers), copy.deepcopy(_links)


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------


def _sync_interface_status(
    router_id: RouterId, connected_to: RouterId, status: str
) -> None:
    """Mirror link up/down on the router's interface list (no lock needed – caller holds it)."""
    for rtr in _routers:
        if rtr.id == router_id:
            for iface in rtr.interfaces:
                if iface.connectedTo == connected_to:
                    iface.status = status
