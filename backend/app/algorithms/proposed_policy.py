"""
Proposed Routing Policy: Failure-Aware, Multi-Metric and Route-Stable Routing (FAMM-RS).

Key Principles:
1. Multi-metric composite cost J(e) balancing delay, congestion, bandwidth penalty,
   and simulated failure risk:
       J(e) = w_delay      * normalized_delay(e)
            + w_congestion * normalized_congestion(e)
            + w_bandwidth  * normalized_bandwidth_penalty(e)
            + w_risk       * normalized_failure_risk(e)

2. Link-failure awareness: Failed links are completely excluded (cost = INF).
3. Detailed per-link and per-metric breakdown for full explainability.
4. Identifies primary optimal path and candidate alternative paths.
"""

from __future__ import annotations

import heapq
import time
from datetime import datetime, timezone
from typing import Optional

from app.models.schemas import (
    AlgorithmType,
    MetricWeights,
    NetworkLink,
    RouteResult,
    RouterId,
    StepTrace,
)
from app.services.cost_service import calculate_cost, cost_breakdown, get_policy_config
from app.utils.graph_utils import (
    ALL_ROUTERS,
    find_link_id,
    path_metrics,
)

INF = float("inf")


class ProposedPolicyEdge:
    def __init__(
        self,
        neighbor: RouterId,
        link_id: str,
        cost: float,
        delay_ms: float,
        bandwidth_mbps: float,
        congestion_percent: float,
        simulated_risk: float,
        breakdown: dict,
    ):
        self.neighbor = neighbor
        self.link_id = link_id
        self.cost = cost
        self.delay_ms = delay_ms
        self.bandwidth_mbps = bandwidth_mbps
        self.congestion_percent = congestion_percent
        self.simulated_risk = simulated_risk
        self.breakdown = breakdown


def build_famm_adjacency(
    links: list[NetworkLink],
    weights: Optional[MetricWeights] = None,
    reference_bw: Optional[float] = None,
    reference_max_delay: Optional[float] = None,
    nodes: Optional[list[RouterId]] = None,
) -> dict[RouterId, list[ProposedPolicyEdge]]:
    """Build bidirectional adjacency list of active links using the 4-metric FAMM cost."""
    active_nodes = nodes or ALL_ROUTERS
    adj: dict[RouterId, list[ProposedPolicyEdge]] = {r: [] for r in active_nodes}

    for lk in links:
        if lk.status.value != "active":
            continue

        c = calculate_cost(
            bandwidth_mbps=lk.bandwidthMbps,
            delay_ms=lk.delayMs,
            congestion_percent=lk.congestionPercent,
            simulated_failure_risk=lk.simulatedFailureRisk,
            weights=weights,
            reference_bw=reference_bw,
            reference_max_delay=reference_max_delay,
        )
        bd = cost_breakdown(
            bandwidth_mbps=lk.bandwidthMbps,
            delay_ms=lk.delayMs,
            congestion_percent=lk.congestionPercent,
            simulated_failure_risk=lk.simulatedFailureRisk,
            weights=weights,
            reference_bw=reference_bw,
            reference_max_delay=reference_max_delay,
        )

        edge_fwd = ProposedPolicyEdge(
            neighbor=lk.target,
            link_id=lk.id,
            cost=c,
            delay_ms=lk.delayMs,
            bandwidth_mbps=lk.bandwidthMbps,
            congestion_percent=lk.congestionPercent,
            simulated_risk=lk.simulatedFailureRisk,
            breakdown=bd,
        )
        edge_rev = ProposedPolicyEdge(
            neighbor=lk.source,
            link_id=lk.id,
            cost=c,
            delay_ms=lk.delayMs,
            bandwidth_mbps=lk.bandwidthMbps,
            congestion_percent=lk.congestionPercent,
            simulated_risk=lk.simulatedFailureRisk,
            breakdown=bd,
        )

        if lk.source in adj:
            adj[lk.source].append(edge_fwd)
        else:
            adj[lk.source] = [edge_fwd]

        if lk.target in adj:
            adj[lk.target].append(edge_rev)
        else:
            adj[lk.target] = [edge_rev]

    return adj


def run_proposed_policy(
    source: RouterId,
    destination: RouterId,
    links: list[NetworkLink],
    weights: Optional[MetricWeights] = None,
    reference_bw: Optional[float] = None,
    reference_max_delay: Optional[float] = None,
    available_nodes: Optional[list[RouterId]] = None,
) -> RouteResult:
    """Execute the proposed Failure-Aware Multi-Metric (FAMM) routing policy."""
    t_start = time.perf_counter()
    nodes = available_nodes or ALL_ROUTERS

    if weights is None:
        weights = get_policy_config().weights

    # ---- 1. Handle trivial source == destination case ----
    if source == destination:
        elapsed = (time.perf_counter() - t_start) * 1000
        return RouteResult(
            algorithm=AlgorithmType.PROPOSED_POLICY,
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
            costBreakdown={"total_cost": 0.0, "weights": weights.model_dump()},
            linkBreakdowns=[],
            alternativeRoutes=[],
        )

    # ---- 2. Build multi-metric graph (failed links excluded) ----
    adj = build_famm_adjacency(
        links,
        weights=weights,
        reference_bw=reference_bw,
        reference_max_delay=reference_max_delay,
        nodes=nodes,
    )

    dist: dict[RouterId, float] = {r: INF for r in nodes}
    prev: dict[RouterId, Optional[RouterId]] = {r: None for r in nodes}
    edge_used: dict[RouterId, Optional[ProposedPolicyEdge]] = {r: None for r in nodes}

    dist[source] = 0.0
    heap: list[tuple[float, str]] = [(0.0, source.value)]
    visited: set[RouterId] = set()
    traces: list[StepTrace] = []
    step = 0

    traces.append(
        StepTrace(
            step=step,
            description=f"Initialise FAMM-RS policy from source {source}. Weights: delay={weights.w_delay}, cong={weights.w_congestion}, bw={weights.w_bandwidth}, risk={weights.w_risk}",
            visited=[],
            tentativeCosts={r: (dist[r] if dist[r] < INF else None) for r in nodes},
            actionType="visit",
        )
    )

    while heap:
        cost_u, u_val = heapq.heappop(heap)
        try:
            u = RouterId(u_val)
        except ValueError:
            u = u_val  # Support generic synthetic string nodes if any

        if u in visited:
            continue
        visited.add(u)
        step += 1

        traces.append(
            StepTrace(
                step=step,
                description=f"Evaluate router {u} (accumulated composite score J = {cost_u:.4f})",
                currentRouter=u if isinstance(u, RouterId) else None,
                visited=list(visited),
                tentativeCosts={r: (dist[r] if dist[r] < INF else None) for r in nodes},
                actionType="visit",
            )
        )

        if u == destination:
            break

        for edge in adj.get(u, []):
            v = edge.neighbor
            if v in visited:
                continue

            new_cost = cost_u + edge.cost
            if new_cost < dist.get(v, INF):
                dist[v] = round(new_cost, 6)
                prev[v] = u
                edge_used[v] = edge
                heapq.heappush(heap, (dist[v], v.value if hasattr(v, "value") else str(v)))
                step += 1
                traces.append(
                    StepTrace(
                        step=step,
                        description=(
                            f"Relax edge {edge.link_id} ({u} → {v}): "
                            f"edge score J={edge.cost:.4f} "
                            f"[delay={edge.delay_ms}ms, cong={edge.congestion_percent}%, bw={edge.bandwidth_mbps}Mbps, risk={edge.simulated_risk:.2f}] "
                            f"→ tentative path score = {dist[v]:.4f}"
                        ),
                        currentRouter=u if isinstance(u, RouterId) else None,
                        visited=list(visited),
                        tentativeCosts={r: (dist[r] if dist[r] < INF else None) for r in nodes},
                        actionType="relax",
                    )
                )

    # ---- 3. Reconstruct shortest path ----
    elapsed = (time.perf_counter() - t_start) * 1000

    if dist.get(destination, INF) == INF or prev.get(destination) is None:
        traces.append(
            StepTrace(
                step=step + 1,
                description=f"Destination {destination} unreachable: all paths severed or failed.",
                visited=list(visited),
                tentativeCosts={r: (dist[r] if dist[r] < INF else None) for r in nodes},
                actionType="converge",
            )
        )
        return RouteResult(
            algorithm=AlgorithmType.PROPOSED_POLICY,
            source=source,
            destination=destination,
            path=[],
            links=[],
            totalCost=0.0,
            totalHops=0,
            totalDelayMs=0.0,
            bottleneckBandwidthMbps=0.0,
            executionTimeMs=round(max(elapsed, 0.01), 3),
            convergenceRounds=len(visited),
            messagesExchanged=len(traces),
            success=False,
            message=f"Destination {destination} is unreachable from {source} under current active links.",
            traces=traces,
            timestamp=datetime.now(timezone.utc).isoformat(),
            costBreakdown={"total_cost": INF, "weights": weights.model_dump()},
            linkBreakdowns=[],
            alternativeRoutes=[],
        )

    # Reconstruct optimal path
    path: list[RouterId] = []
    curr: Optional[RouterId] = destination
    while curr is not None:
        path.insert(0, curr)
        if curr == source:
            break
        curr = prev.get(curr)

    path_links: list[str] = []
    link_breakdowns: list[dict] = []
    total_delay = 0.0
    bottleneck_bw = INF
    total_risk = 0.0

    for i in range(len(path) - 1):
        u_node = path[i]
        v_node = path[i + 1]
        lk_id = find_link_id(u_node, v_node, links) or f"{u_node}-{v_node}"
        path_links.append(lk_id)

        # find actual link object
        matched_lk = next((l for l in links if l.id == lk_id), None)
        if matched_lk:
            total_delay += matched_lk.delayMs
            bottleneck_bw = min(bottleneck_bw, matched_lk.bandwidthMbps)
            total_risk += matched_lk.simulatedFailureRisk
            b_info = cost_breakdown(
                bandwidth_mbps=matched_lk.bandwidthMbps,
                delay_ms=matched_lk.delayMs,
                congestion_percent=matched_lk.congestionPercent,
                simulated_failure_risk=matched_lk.simulatedFailureRisk,
                weights=weights,
                reference_bw=reference_bw,
                reference_max_delay=reference_max_delay,
            )
            b_info["link_id"] = lk_id
            b_info["source"] = u_node.value if hasattr(u_node, "value") else str(u_node)
            b_info["target"] = v_node.value if hasattr(v_node, "value") else str(v_node)
            b_info["bandwidth_mbps"] = matched_lk.bandwidthMbps
            b_info["delay_ms"] = matched_lk.delayMs
            b_info["congestion_percent"] = matched_lk.congestionPercent
            b_info["simulated_failure_risk"] = matched_lk.simulatedFailureRisk
            link_breakdowns.append(b_info)

    if bottleneck_bw == INF:
        bottleneck_bw = 0.0

    # ---- 4. Discover feasible alternative routes (e.g. bypass route) ----
    alternative_routes = []
    # Try disabling each link in the primary path one-by-one to find viable backup paths
    for primary_edge in path_links:
        sub_links = [l for l in links if l.id != primary_edge and l.status.value == "active"]
        alt_res = _find_simple_path(source, destination, sub_links, weights, reference_bw, reference_max_delay, nodes)
        if alt_res and alt_res["path"] != path and alt_res["path"] not in [a["path"] for a in alternative_routes]:
            alternative_routes.append(alt_res)

    traces.append(
        StepTrace(
            step=step + 1,
            description=f"Optimal FAMM path discovered: {' → '.join(str(p) for p in path)} with composite score J={dist[destination]:.4f}",
            visited=list(visited),
            tentativeCosts={r: (dist[r] if dist[r] < INF else None) for r in nodes},
            actionType="converge",
        )
    )

    path_cost = round(dist[destination], 6)
    return RouteResult(
        algorithm=AlgorithmType.PROPOSED_POLICY,
        source=source,
        destination=destination,
        path=path,
        links=path_links,
        totalCost=path_cost,
        totalHops=len(path_links),
        totalDelayMs=round(total_delay, 2),
        bottleneckBandwidthMbps=round(bottleneck_bw, 2),
        executionTimeMs=round(max(elapsed, 0.01), 3),
        convergenceRounds=len(visited),
        messagesExchanged=len(traces),
        success=True,
        message=f"Optimal FAMM-RS path selected: {' → '.join(str(p) for p in path)} (Score J={path_cost:.4f})",
        traces=traces,
        timestamp=datetime.now(timezone.utc).isoformat(),
        costBreakdown={
            "total_cost": path_cost,
            "total_delay_ms": round(total_delay, 2),
            "bottleneck_bandwidth_mbps": round(bottleneck_bw, 2),
            "average_simulated_risk": round(total_risk / max(len(path_links), 1), 4),
            "weights": weights.model_dump(),
        },
        linkBreakdowns=link_breakdowns,
        alternativeRoutes=alternative_routes,
    )


def _find_simple_path(
    source: RouterId,
    destination: RouterId,
    links: list[NetworkLink],
    weights: Optional[MetricWeights],
    reference_bw: Optional[float],
    reference_max_delay: Optional[float],
    nodes: list[RouterId],
) -> Optional[dict]:
    """Helper to find an alternative route given a subset of links."""
    adj = build_famm_adjacency(links, weights, reference_bw, reference_max_delay, nodes)
    dist: dict[RouterId, float] = {r: INF for r in nodes}
    prev: dict[RouterId, Optional[RouterId]] = {r: None for r in nodes}
    dist[source] = 0.0
    heap = [(0.0, source.value if hasattr(source, "value") else str(source))]
    visited: set[RouterId] = set()

    while heap:
        c, u_val = heapq.heappop(heap)
        try:
            u = RouterId(u_val)
        except ValueError:
            u = u_val
        if u in visited:
            continue
        visited.add(u)
        if u == destination:
            break
        for edge in adj.get(u, []):
            v = edge.neighbor
            if v in visited:
                continue
            if c + edge.cost < dist.get(v, INF):
                dist[v] = round(c + edge.cost, 6)
                prev[v] = u
                heapq.heappush(heap, (dist[v], v.value if hasattr(v, "value") else str(v)))

    if dist.get(destination, INF) == INF or prev.get(destination) is None:
        return None

    path: list[RouterId] = []
    curr: Optional[RouterId] = destination
    while curr is not None:
        path.insert(0, curr)
        if curr == source:
            break
        curr = prev.get(curr)

    alt_links = []
    for i in range(len(path) - 1):
        alt_links.append(find_link_id(path[i], path[i + 1], links) or f"{path[i]}-{path[i + 1]}")

    return {
        "path": path,
        "links": alt_links,
        "totalCost": round(dist[destination], 6),
        "totalHops": len(alt_links),
    }
