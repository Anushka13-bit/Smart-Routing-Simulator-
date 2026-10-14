"""
Bellman-Ford Algorithm.

Explicitly implements the classic |V| − 1 edge-relaxation passes over the
active topology.  Negative-cycle detection is included as an extra pass.

Time complexity : O(V × E)
Space complexity: O(V)

All edge costs produced by the cost formula are non-negative, so no
negative cycle is expected in normal operation.  The check is provided
for future extensibility and educational completeness.
"""

from __future__ import annotations

import time
from datetime import datetime, timezone
from typing import Optional

from app.models.schemas import NetworkLink, RouteResult, RouterId, StepTrace, AlgorithmType
from app.utils.graph_utils import (
    ALL_ROUTERS,
    find_link_id,
    path_metrics,
    reconstruct_path,
)

INF = float("inf")


def run_bellman_ford(
    source: RouterId,
    destination: RouterId,
    links: list[NetworkLink],
) -> RouteResult:
    t_start = time.perf_counter()

    # Trivial case
    if source == destination:
        elapsed = (time.perf_counter() - t_start) * 1000
        return RouteResult(
            algorithm=AlgorithmType.BELLMAN_FORD,
            source=source,
            destination=destination,
            path=[source],
            links=[],
            totalCost=0.0,
            totalHops=0,
            totalDelayMs=0.0,
            bottleneckBandwidthMbps=0.0,
            executionTimeMs=round(max(elapsed, 0.01), 3),
            convergenceRounds=0,
            messagesExchanged=0,
            success=True,
            message="Source and destination are the same router.",
            traces=[],
            timestamp=datetime.now(timezone.utc).isoformat(),
        )

    active_links = [lk for lk in links if lk.status.value == "active"]
    n = len(ALL_ROUTERS)  # 5

    dist: dict[RouterId, float] = {r: INF for r in ALL_ROUTERS}
    prev: dict[RouterId, Optional[RouterId]] = {r: None for r in ALL_ROUTERS}
    dist[source] = 0.0

    traces: list[StepTrace] = []
    step = 0
    rounds_done = 0
    negative_cycle = False

    traces.append(
        StepTrace(
            step=step,
            description=f"Bellman-Ford init: dist({source}) = 0, all others = ∞",
            visited=[source],
            tentativeCosts={r: (dist[r] if dist[r] < INF else None) for r in ALL_ROUTERS},
            actionType="visit",
        )
    )

    # --- |V| − 1 relaxation passes -------------------------------------------
    for rnd in range(1, n):
        changed = False
        rounds_done += 1

        for lk in active_links:
            # Both directions of the undirected link
            for u, v in [(lk.source, lk.target), (lk.target, lk.source)]:
                if dist[u] < INF and dist[u] + lk.cost < dist[v]:
                    dist[v] = dist[u] + lk.cost
                    prev[v] = u
                    changed = True

                    step += 1
                    traces.append(
                        StepTrace(
                            step=step,
                            description=(
                                f"Round {rnd}: relax ({u} → {v}) "
                                f"— new dist = {dist[v]:.4f}"
                            ),
                            currentRouter=u,
                            visited=[
                                r for r in ALL_ROUTERS if dist[r] < INF
                            ],
                            tentativeCosts={
                                r: (dist[r] if dist[r] < INF else None)
                                for r in ALL_ROUTERS
                            },
                            actionType="relax",
                        )
                    )

        if not changed:
            step += 1
            traces.append(
                StepTrace(
                    step=step,
                    description=f"Early convergence at round {rnd}: no updates.",
                    visited=[r for r in ALL_ROUTERS if dist[r] < INF],
                    tentativeCosts={
                        r: (dist[r] if dist[r] < INF else None) for r in ALL_ROUTERS
                    },
                    actionType="converge",
                )
            )
            break

    # --- Extra pass: negative-cycle detection ---------------------------------
    for lk in active_links:
        for u, v in [(lk.source, lk.target), (lk.target, lk.source)]:
            if dist[u] < INF and dist[u] + lk.cost < dist[v]:
                negative_cycle = True
                break
        if negative_cycle:
            break

    # ---- Reconstruct path ----------------------------------------------------
    path: list[RouterId] = []
    if not negative_cycle and dist[destination] < INF:
        path = reconstruct_path(prev, source, destination)

    success = bool(path) and not negative_cycle
    path_link_ids: list[str] = []

    if success and len(path) > 1:
        for i in range(len(path) - 1):
            lid = find_link_id(path[i], path[i + 1], links)
            if lid:
                path_link_ids.append(lid)

    total_cost, total_delay, bottleneck_bw = path_metrics(path, links)
    if not success:
        total_cost = float("inf")
    elapsed_ms = (time.perf_counter() - t_start) * 1000

    if negative_cycle:
        message = "Negative-weight cycle detected — distances are unreliable."
    elif success:
        message = f"Optimal path computed via {rounds_done} relaxation pass(es)."
    else:
        message = f"Destination {destination} unreachable from {source}."

    step += 1
    traces.append(
        StepTrace(
            step=step,
            description=message,
            visited=[r for r in ALL_ROUTERS if dist[r] < INF],
            tentativeCosts={r: (dist[r] if dist[r] < INF else None) for r in ALL_ROUTERS},
            actionType="converge",
        )
    )

    return RouteResult(
        algorithm=AlgorithmType.BELLMAN_FORD,
        source=source,
        destination=destination,
        path=path,
        links=path_link_ids,
        totalCost=total_cost,
        totalHops=max(0, len(path) - 1),
        totalDelayMs=total_delay,
        bottleneckBandwidthMbps=bottleneck_bw,
        executionTimeMs=round(max(elapsed_ms, 0.01), 3),
        convergenceRounds=rounds_done,
        messagesExchanged=rounds_done * len(active_links) * 2,
        success=success,
        message=message,
        traces=traces,
        timestamp=datetime.now(timezone.utc).isoformat(),
    )
