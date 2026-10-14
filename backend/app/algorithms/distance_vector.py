"""
Distance Vector Routing — Educational Distributed Simulation.

Each router maintains a full distance vector (cost to every destination).
Routers iteratively exchange their vectors with direct neighbours using the
Bellman-Ford equation:

    Dx(y) = min_v { c(x, v) + Dv(y) }

The simulation continues until either:
  a) No distance vector changes in an iteration (converged), or
  b) The configured iteration limit is reached (non-convergence reported).

This is a distinct implementation from Dijkstra/Bellman-Ford:
  - State is maintained *per router* (distance vectors + next-hop tables)
  - Updates are driven by neighbour-to-neighbour message passing
  - Convergence iterations and total messages are realistic educational metrics

Time complexity : O(Iterations × E) per router
Space complexity: O(V × Neighbors)
"""

from __future__ import annotations

import time
from datetime import datetime, timezone
from typing import Optional

from app.models.schemas import NetworkLink, RouteResult, RouterId, StepTrace, AlgorithmType
from app.utils.graph_utils import ALL_ROUTERS, build_adjacency, find_link_id, path_metrics

INF = float("inf")
MAX_ITERATIONS = 20  # safe upper bound for 5-node graph


def run_distance_vector(
    source: RouterId,
    destination: RouterId,
    links: list[NetworkLink],
) -> RouteResult:
    t_start = time.perf_counter()

    # Trivial case
    if source == destination:
        elapsed = (time.perf_counter() - t_start) * 1000
        return RouteResult(
            algorithm=AlgorithmType.DISTANCE_VECTOR,
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

    # ---- Initialise distance vectors -----------------------------------------
    # dv[router][target] = best known cost from router to target
    dv: dict[RouterId, dict[RouterId, float]] = {
        r: {t: (0.0 if t == r else INF) for t in ALL_ROUTERS}
        for r in ALL_ROUTERS
    }
    # nh[router][target] = next hop from router toward target
    nh: dict[RouterId, dict[RouterId, Optional[RouterId]]] = {
        r: {t: None for t in ALL_ROUTERS}
        for r in ALL_ROUTERS
    }

    # Step 0: populate direct-neighbour costs
    for r in ALL_ROUTERS:
        for edge in adj[r]:
            v = edge.neighbor
            if edge.cost < dv[r][v]:
                dv[r][v] = edge.cost
                nh[r][v] = v

    traces: list[StepTrace] = []
    step = 0
    traces.append(
        StepTrace(
            step=step,
            description=(
                "DV Init: each router populates its vector with direct-link costs."
            ),
            visited=[source],
            tentativeCosts={r: (dv[source][r] if dv[source][r] < INF else None) for r in ALL_ROUTERS},
            actionType="visit",
        )
    )

    converged = False
    iterations = 0
    total_messages = 0

    # ---- Iterative exchange loop ---------------------------------------------
    while not converged and iterations < MAX_ITERATIONS:
        iterations += 1
        any_updated = False

        for node in ALL_ROUTERS:
            for edge in adj[node]:
                neighbor = edge.neighbor
                total_messages += 1

                # Apply Bellman-Ford equation from node's perspective
                for target in ALL_ROUTERS:
                    if target == node:
                        continue
                    cost_via = edge.cost + dv[neighbor][target]
                    if cost_via < dv[node][target]:
                        dv[node][target] = cost_via
                        nh[node][target] = neighbor
                        any_updated = True

                        if node == source:
                            step += 1
                            traces.append(
                                StepTrace(
                                    step=step,
                                    description=(
                                        f"Iter {iterations}: {node} learned "
                                        f"cost={cost_via:.4f} to {target} "
                                        f"via {neighbor}"
                                    ),
                                    currentRouter=node,
                                    visited=[node, neighbor],
                                    tentativeCosts={
                                        r: (dv[source][r] if dv[source][r] < INF else None)
                                        for r in ALL_ROUTERS
                                    },
                                    actionType="update",
                                )
                            )

        if not any_updated:
            converged = True
            step += 1
            traces.append(
                StepTrace(
                    step=step,
                    description=(
                        f"Converged in {iterations} iteration(s). "
                        "No further vector updates."
                    ),
                    visited=list(ALL_ROUTERS),
                    tentativeCosts={
                        r: (dv[source][r] if dv[source][r] < INF else None)
                        for r in ALL_ROUTERS
                    },
                    actionType="converge",
                )
            )

    # ---- Reconstruct path using next-hop table from source -------------------
    path: list[RouterId] = []
    success = False

    if dv[source][destination] < INF:
        current = source
        seen: set[RouterId] = {source}
        path.append(source)

        while current != destination:
            nxt = nh[current][destination]
            if nxt is None or nxt in seen:
                path = []  # loop or dead-end
                break
            path.append(nxt)
            seen.add(nxt)
            current = nxt

        success = bool(path) and path[-1] == destination

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

    if not converged:
        status_msg = (
            f"Did NOT converge within {MAX_ITERATIONS} iterations — "
            "possible routing instability."
        )
    elif success:
        status_msg = (
            f"Converged via distributed vector exchange "
            f"({iterations} iteration(s), {total_messages} messages)."
        )
    else:
        status_msg = f"Destination {destination} unreachable from {source}."

    return RouteResult(
        algorithm=AlgorithmType.DISTANCE_VECTOR,
        source=source,
        destination=destination,
        path=path,
        links=path_link_ids,
        totalCost=total_cost,
        totalHops=max(0, len(path) - 1),
        totalDelayMs=total_delay,
        bottleneckBandwidthMbps=bottleneck_bw,
        executionTimeMs=round(max(elapsed_ms, 0.01), 3),
        convergenceRounds=iterations,
        messagesExchanged=total_messages,
        success=success,
        message=status_msg,
        traces=traces,
        timestamp=datetime.now(timezone.utc).isoformat(),
    )
