"""
Graph utility helpers shared by all routing algorithms.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Optional

from app.models.schemas import NetworkLink, RouterId

ALL_ROUTERS: list[RouterId] = [
    RouterId.R1,
    RouterId.R2,
    RouterId.R3,
    RouterId.R4,
    RouterId.R5,
]


@dataclass
class AdjEdge:
    neighbor: RouterId
    cost: float
    delay_ms: float
    bandwidth_mbps: float
    link_id: str


def build_adjacency(links: list[NetworkLink]) -> dict[RouterId, list[AdjEdge]]:
    """
    Build a bidirectional adjacency list from *active* links only.
    Failed links are silently ignored.
    """
    adj: dict[RouterId, list[AdjEdge]] = {r: [] for r in ALL_ROUTERS}

    for lk in links:
        if lk.status.value != "active":
            continue

        edge_fwd = AdjEdge(
            neighbor=lk.target,
            cost=lk.cost,
            delay_ms=lk.delayMs,
            bandwidth_mbps=lk.bandwidthMbps,
            link_id=lk.id,
        )
        edge_rev = AdjEdge(
            neighbor=lk.source,
            cost=lk.cost,
            delay_ms=lk.delayMs,
            bandwidth_mbps=lk.bandwidthMbps,
            link_id=lk.id,
        )
        adj[lk.source].append(edge_fwd)
        adj[lk.target].append(edge_rev)

    return adj


def find_link_id(u: RouterId, v: RouterId, links: list[NetworkLink]) -> Optional[str]:
    """Return the link ID for an (u, v) pair regardless of direction."""
    for lk in links:
        if (lk.source == u and lk.target == v) or (
            lk.source == v and lk.target == u
        ):
            return lk.id
    return None


def reconstruct_path(
    previous: dict[RouterId, Optional[RouterId]],
    source: RouterId,
    destination: RouterId,
) -> list[RouterId]:
    """Walk the predecessor map backwards to recover the shortest path."""
    path: list[RouterId] = []
    current: Optional[RouterId] = destination

    while current is not None:
        path.insert(0, current)
        if current == source:
            break
        current = previous.get(current)
    else:
        return []  # source not reached

    if not path or path[0] != source or path[-1] != destination:
        return []
    return path


def path_metrics(
    path: list[RouterId],
    links: list[NetworkLink],
) -> tuple[float, float, float]:
    """
    Given an ordered path, return:
        (total_cost, total_delay_ms, bottleneck_bandwidth_mbps)

    Uses the stored link.cost values for total_cost.
    """
    if len(path) < 2:
        return 0.0, 0.0, 0.0

    total_cost = 0.0
    total_delay = 0.0
    bottleneck_bw = float("inf")
    link_map = {lk.id: lk for lk in links}

    for i in range(len(path) - 1):
        lid = find_link_id(path[i], path[i + 1], links)
        if lid and lid in link_map:
            lk = link_map[lid]
            total_cost += lk.cost
            total_delay += lk.delayMs
            bottleneck_bw = min(bottleneck_bw, lk.bandwidthMbps)

    return (
        round(total_cost, 6),
        round(total_delay, 3),
        bottleneck_bw if bottleneck_bw != float("inf") else 0.0,
    )
