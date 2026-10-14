"""
Dijkstra's Shortest-Path Algorithm.

Uses a simple priority queue (heapq) over the active topology.  All edge
costs are non-negative (guaranteed by the cost formula).

Time complexity : O((V + E) log V)
Space complexity: O(V)

Used directly by the Link State algorithm as its SPF engine.
"""

from __future__ import annotations

import heapq
import time
from datetime import datetime, timezone
from typing import Optional

from app.models.schemas import NetworkLink, RouteResult, RouterId, StepTrace, AlgorithmType
from app.utils.graph_utils import (
    ALL_ROUTERS,
    build_adjacency,
    find_link_id,
    path_metrics,
    reconstruct_path,
)

INF = float("inf")


def run_dijkstra(
    source: RouterId,
    destination: RouterId,
    links: list[NetworkLink],
    algorithm_label: AlgorithmType = AlgorithmType.DIJKSTRA,
) -> RouteResult:
    """
    Compute the shortest path from *source* to *destination* using Dijkstra.

    Parameters
    ----------
    source, destination:
        Valid RouterId values.
    links:
        Current link state (active and failed).  Only active links are used.
    algorithm_label:
        Allow Link State to reuse this function with its own label.
    """
    t_start = time.perf_counter()

    # ---- Handle trivial case --------------------------------------------------
    if source == destination:
        elapsed = (time.perf_counter() - t_start) * 1000
        return RouteResult(
            algorithm=algorithm_label,
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

    adj = build_adjacency(links)
    dist: dict[RouterId, float] = {r: INF for r in ALL_ROUTERS}
    prev: dict[RouterId, Optional[RouterId]] = {r: None for r in ALL_ROUTERS}
    dist[source] = 0.0

    # heap: (cost, router)
    heap: list[tuple[float, str]] = [(0.0, source.value)]
    visited: set[RouterId] = set()
    traces: list[StepTrace] = []
    step = 0

    traces.append(
        StepTrace(
            step=step,
            description=f"Initialise: dist({source}) = 0, all others = ∞",
            visited=[],
            tentativeCosts={r: (dist[r] if dist[r] < INF else None) for r in ALL_ROUTERS},
            actionType="visit",
        )
    )

    while heap:
        cost_u, u_val = heapq.heappop(heap)
        u = RouterId(u_val)

        if u in visited:
            continue
        visited.add(u)

        step += 1
        traces.append(
            StepTrace(
                step=step,
                description=f"Visit {u} — current min cost = {cost_u:.4f}",
                currentRouter=u,
                visited=list(visited),
                tentativeCosts={r: (dist[r] if dist[r] < INF else None) for r in ALL_ROUTERS},
                actionType="visit",
            )
        )

        if u == destination:
            break

        for edge in adj[u]:
            v = edge.neighbor
            if v in visited:
                continue
            alt = dist[u] + edge.cost
            if alt < dist[v]:
                dist[v] = alt
                prev[v] = u
                heapq.heappush(heap, (alt, v.value))

                step += 1
                traces.append(
                    StepTrace(
                        step=step,
                        description=(
                            f"Relax edge ({u} → {v}): "
                            f"new dist = {alt:.4f} via {u}"
                        ),
                        currentRouter=u,
                        visited=list(visited),
                        tentativeCosts={
                            r: (dist[r] if dist[r] < INF else None) for r in ALL_ROUTERS
                        },
                        actionType="relax",
                    )
                )

    # ---- Reconstruct path ----------------------------------------------------
    path = reconstruct_path(prev, source, destination) if dist[destination] < INF else []
    success = bool(path)

    path_link_ids = []
    if success and len(path) > 1:
        for i in range(len(path) - 1):
            lid = find_link_id(path[i], path[i + 1], links)
            if lid:
                path_link_ids.append(lid)

    total_cost, total_delay, bottleneck_bw = path_metrics(path, links)
    if not success:
        total_cost = float("inf")

    elapsed_ms = (time.perf_counter() - t_start) * 1000

    step += 1
    traces.append(
        StepTrace(
            step=step,
            description=(
                f"Done — path: {' → '.join(p.value for p in path)} | cost: {total_cost}"
                if success
                else f"No path from {source} to {destination} (network partition)"
            ),
            visited=list(visited),
            tentativeCosts={r: (dist[r] if dist[r] < INF else None) for r in ALL_ROUTERS},
            actionType="converge",
        )
    )

    return RouteResult(
        algorithm=algorithm_label,
        source=source,
        destination=destination,
        path=path,
        links=path_link_ids,
        totalCost=total_cost,
        totalHops=max(0, len(path) - 1),
        totalDelayMs=total_delay,
        bottleneckBandwidthMbps=bottleneck_bw,
        executionTimeMs=round(max(elapsed_ms, 0.01), 3),
        convergenceRounds=len(visited),
        messagesExchanged=len(visited) * 2,
        success=success,
        message=(
            "Shortest path calculated successfully."
            if success
            else f"Destination {destination} unreachable from {source}."
        ),
        traces=traces,
        timestamp=datetime.now(timezone.utc).isoformat(),
    )
