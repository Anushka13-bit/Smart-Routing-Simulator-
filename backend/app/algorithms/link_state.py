"""
Link State Routing Protocol Simulation (e.g., OSPF / IS-IS).

Educational & Conceptual Distinction:
-------------------------------------
Link State is a distributed routing architecture/protocol, NOT simply a shortest-path formula.
- Step 1: Neighbor discovery using periodic Hello packets.
- Step 2: Generation of Link State Advertisements (LSAs) containing direct link metrics.
- Step 3: Reliable flooding of LSAs to all routers in the routing domain.
- Step 4: Every router maintains an identical, synchronized Link State Database (LSDB),
          which represents the complete map of active topology.
- Step 5: Each router independently executes Dijkstra's Shortest Path First (SPF) algorithm
          using itself as the root to construct its shortest-path tree and routing table.

Time Complexity : Flooding O(E) + Local SPF O((V + E) log V)
Space Complexity: O(V + E) for synchronized LSDB
"""

from __future__ import annotations

import time
from datetime import datetime, timezone
from typing import Any

from app.algorithms.dijkstra import run_dijkstra
from app.models.schemas import AlgorithmType, NetworkLink, RouteResult, RouterId, StepTrace
from app.utils.graph_utils import ALL_ROUTERS


class LinkStateDatabase:
    """
    Simulated Link State Database (LSDB).
    Each router builds and maintains this local copy of network-wide link states.
    """

    def __init__(self, active_links: list[NetworkLink]):
        # LSA map: router_id -> list of advertised active links
        self.lsas: dict[RouterId, list[dict[str, Any]]] = {r: [] for r in ALL_ROUTERS}
        for lk in active_links:
            self.lsas[lk.source].append({
                "neighbor": lk.target,
                "cost": lk.cost,
                "bandwidthMbps": lk.bandwidthMbps,
                "delayMs": lk.delayMs,
                "congestionPercent": lk.congestionPercent,
                "linkId": lk.id,
            })
            self.lsas[lk.target].append({
                "neighbor": lk.source,
                "cost": lk.cost,
                "bandwidthMbps": lk.bandwidthMbps,
                "delayMs": lk.delayMs,
                "congestionPercent": lk.congestionPercent,
                "linkId": lk.id,
            })

    def get_topology_map(self) -> dict[RouterId, list[dict[str, Any]]]:
        return self.lsas


def run_link_state(
    source: RouterId,
    destination: RouterId,
    links: list[NetworkLink],
) -> RouteResult:
    """
    Executes Link State routing:
    1. Simulates neighbor discovery (OSPF Hello).
    2. Simulates reliable LSA flooding and synchronized LSDB construction.
    3. Runs local Dijkstra SPF on the synchronized LSDB.
    """
    t_start = time.perf_counter()
    active_links = [lk for lk in links if lk.status.value == "active"]

    # Step 1: Neighbor Discovery
    traces: list[StepTrace] = []
    traces.append(
        StepTrace(
            step=0,
            description="OSPF Hello Protocol: Routers discover adjacent neighbors and establish 2-way adjacency.",
            visited=list(ALL_ROUTERS),
            tentativeCosts={r: (0.0 if r == source else None) for r in ALL_ROUTERS},
            actionType="visit",
        )
    )

    # Step 2: Construct LSDB via reliable flooding
    lsdb = LinkStateDatabase(active_links)
    lsa_packets_exchanged = len(active_links) * 4  # Typical LSA flooding volume per active link
    traces.append(
        StepTrace(
            step=1,
            description=(
                f"LSA Flooding: Link State Advertisements reliably flooded across network. "
                f"Synchronized LSDB formed ({lsa_packets_exchanged} LSA packets exchanged)."
            ),
            visited=list(ALL_ROUTERS),
            tentativeCosts={r: (0.0 if r == source else None) for r in ALL_ROUTERS},
            actionType="flood",
        )
    )

    # Step 3: Run SPF (Dijkstra) locally rooted at the source router
    spf_result = run_dijkstra(
        source=source,
        destination=destination,
        links=links,
        algorithm_label=AlgorithmType.LINK_STATE,
    )

    elapsed_ms = (time.perf_counter() - t_start) * 1000

    # Combine traces: prepend the protocol phases (discovery & flooding)
    merged_traces = traces + [
        StepTrace(
            step=t.step + 2,
            description=f"[Local SPF] {t.description}",
            currentRouter=t.currentRouter,
            visited=t.visited,
            tentativeCosts=t.tentativeCosts,
            actionType=t.actionType,
        )
        for t in spf_result.traces
    ]

    success = spf_result.success
    msg = (
        "Synchronized LSDB flooded & SPF tree computed locally."
        if success
        else f"Destination {destination} unreachable (Topology partition in LSDB)."
    )

    return RouteResult(
        algorithm=AlgorithmType.LINK_STATE,
        source=source,
        destination=destination,
        path=spf_result.path,
        links=spf_result.links,
        totalCost=spf_result.totalCost,
        totalHops=spf_result.totalHops,
        totalDelayMs=spf_result.totalDelayMs,
        bottleneckBandwidthMbps=spf_result.bottleneckBandwidthMbps,
        executionTimeMs=round(max(elapsed_ms, 0.02), 3),
        convergenceRounds=2 + spf_result.convergenceRounds,
        messagesExchanged=lsa_packets_exchanged + spf_result.messagesExchanged,
        success=success,
        message=msg,
        traces=merged_traces,
        timestamp=datetime.now(timezone.utc).isoformat(),
    )
