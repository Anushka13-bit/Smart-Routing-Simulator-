"""
Routing calculation, comparison, explanation, and routing-table generation service.
"""

from __future__ import annotations

from typing import Any

from app.algorithms.bellman_ford import run_bellman_ford
from app.algorithms.dijkstra import run_dijkstra
from app.algorithms.distance_vector import run_distance_vector
from app.algorithms.link_state import run_link_state
from app.models.schemas import (
    AlgorithmComparisonResult,
    AlgorithmType,
    NetworkLink,
    RouteResult,
    RouterId,
    RouterNodeData,
    RoutingTable,
    RoutingTableEntry,
)
from app.services.cost_service import cost_breakdown
from app.utils.graph_utils import ALL_ROUTERS, find_link_id

ALGORITHM_METADATA: dict[AlgorithmType, dict[str, str]] = {
    AlgorithmType.DIJKSTRA: {
        "name": "Dijkstra's Algorithm",
        "timeComplexity": "O((V + E) log V)",
        "spaceComplexity": "O(V)",
        "protocolBasis": "OSPF / IS-IS SPF Engine",
        "keyFeature": "Centralized greedy search; fast convergence; guaranteed optimal for positive weights.",
    },
    AlgorithmType.BELLMAN_FORD: {
        "name": "Bellman-Ford Algorithm",
        "timeComplexity": "O(V × E)",
        "spaceComplexity": "O(V)",
        "protocolBasis": "RIP Distance Vector basis",
        "keyFeature": "Dynamic edge relaxation (|V|-1 passes); tolerates negative edge cycles.",
    },
    AlgorithmType.DISTANCE_VECTOR: {
        "name": "Distance Vector (Distributed)",
        "timeComplexity": "O(Iterations × E)",
        "spaceComplexity": "O(V × Neighbors)",
        "protocolBasis": "RIP v2 / BGP Vector Exchange",
        "keyFeature": "Decentralized exchange between neighbors; split-horizon loop protection.",
    },
    AlgorithmType.LINK_STATE: {
        "name": "Link State Protocol (OSPF)",
        "timeComplexity": "Flooding O(E) + SPF O((V+E)log V)",
        "spaceComplexity": "O(V + E) LSDB",
        "protocolBasis": "OSPF RFC 2328 Standard",
        "keyFeature": "Reliable LSA flooding creates identical LSDB; each router runs SPF locally.",
    },
}


def calculate_route(
    algorithm: AlgorithmType,
    source: RouterId,
    destination: RouterId,
    links: list[NetworkLink],
) -> RouteResult:
    """Execute the selected algorithm on the current active links."""
    if algorithm == AlgorithmType.DIJKSTRA:
        return run_dijkstra(source, destination, links)
    elif algorithm == AlgorithmType.BELLMAN_FORD:
        return run_bellman_ford(source, destination, links)
    elif algorithm == AlgorithmType.DISTANCE_VECTOR:
        return run_distance_vector(source, destination, links)
    elif algorithm == AlgorithmType.LINK_STATE:
        return run_link_state(source, destination, links)
    else:
        raise ValueError(f"Unsupported algorithm: {algorithm}")


def compare_algorithms(
    source: RouterId,
    destination: RouterId,
    links: list[NetworkLink],
) -> list[AlgorithmComparisonResult]:
    """Execute all four algorithms on the exact same topology snapshot."""
    results: list[AlgorithmComparisonResult] = []

    for algo in [
        AlgorithmType.DIJKSTRA,
        AlgorithmType.BELLMAN_FORD,
        AlgorithmType.DISTANCE_VECTOR,
        AlgorithmType.LINK_STATE,
    ]:
        res = calculate_route(algo, source, destination, links)
        meta = ALGORITHM_METADATA[algo]

        results.append(
            AlgorithmComparisonResult(
                algorithm=algo,
                name=meta["name"],
                path=res.path,
                totalCost=res.totalCost,
                totalHops=res.totalHops,
                totalDelayMs=res.totalDelayMs,
                executionTimeMs=res.executionTimeMs,
                convergenceRounds=res.convergenceRounds,
                messagesExchanged=res.messagesExchanged,
                timeComplexity=meta["timeComplexity"],
                spaceComplexity=meta["spaceComplexity"],
                protocolBasis=meta["protocolBasis"],
                keyFeature=meta["keyFeature"],
                status="success" if res.success else "failed",
            )
        )

    return results


def generate_routing_table(
    router_id: RouterId,
    links: list[NetworkLink],
    routers: list[RouterNodeData],
) -> RoutingTable:
    """Generate dynamic routing table entries for a router using SPF."""
    entries: list[RoutingTableEntry] = []
    router_data = next((r for r in routers if r.id == router_id), None)

    for target in ALL_ROUTERS:
        if target == router_id:
            entries.append(
                RoutingTableEntry(
                    destination=target,
                    nextHop="DIRECT",
                    metric=0.0,
                    interfaceName="Loopback0",
                    protocol="Local/Connected",
                )
            )
            continue

        route = run_dijkstra(router_id, target, links)

        if route.success and len(route.path) >= 2:
            next_hop = route.path[1]
            iface_name = f"Eth-{next_hop.value}"
            if router_data:
                for iface in router_data.interfaces:
                    if iface.connectedTo == next_hop:
                        iface_name = iface.name
                        break

            entries.append(
                RoutingTableEntry(
                    destination=target,
                    nextHop=next_hop.value,
                    metric=route.totalCost,
                    interfaceName=iface_name,
                    protocol="OSPF / SPF",
                )
            )
        else:
            entries.append(
                RoutingTableEntry(
                    destination=target,
                    nextHop="DIRECT",
                    metric=float("inf"),
                    interfaceName="Null0",
                    protocol="Unreachable",
                )
            )

    return RoutingTable(routerId=router_id, entries=entries)


def explain_route(
    route: RouteResult,
    links: list[NetworkLink],
) -> dict[str, Any]:
    """
    Generate detailed educational breakdown explaining why the route was chosen:
    - Traversed links with metrics & penalties
    - Sum of link costs
    - Hop count
    - Whether a cheaper alternative exists
    """
    if not route.success or len(route.path) < 2:
        return {
            "reachable": route.success,
            "message": route.message,
            "traversed_links": [],
            "total_cost": route.totalCost,
            "hops": route.totalHops,
            "is_optimal": False,
        }

    traversed_links: list[dict[str, Any]] = []
    link_map = {l.id: l for l in links}

    for i in range(len(route.path) - 1):
        u = route.path[i]
        v = route.path[i + 1]
        lid = find_link_id(u, v, links)
        if lid and lid in link_map:
            l = link_map[lid]
            breakdown = cost_breakdown(l.bandwidthMbps, l.delayMs, l.congestionPercent)
            traversed_links.append({
                "link_id": l.id,
                "endpoints": f"{u.value} <-> {v.value}",
                "bandwidth_mbps": l.bandwidthMbps,
                "delay_ms": l.delayMs,
                "congestion_percent": l.congestionPercent,
                "calculated_cost": l.cost,
                "cost_components": breakdown,
            })

    # Dijkstra gives guaranteed optimal cost for non-negative edges
    opt_route = run_dijkstra(route.source, route.destination, links)
    is_optimal = route.totalCost <= (opt_route.totalCost + 1e-6)

    return {
        "reachable": True,
        "algorithm": route.algorithm.value,
        "source": route.source.value,
        "destination": route.destination.value,
        "path": [r.value for r in route.path],
        "total_cost": route.totalCost,
        "hops": route.totalHops,
        "traversed_links": traversed_links,
        "is_optimal": is_optimal,
        "cheaper_alternative_exists": not is_optimal,
        "explanation": (
            f"The route traverses {route.totalHops} hop(s) with total composite metric {route.totalCost:.4f}. "
            f"Each hop was evaluated using the weighted formula balancing bandwidth, latency, and congestion."
        ),
    }
