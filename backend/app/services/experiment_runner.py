"""
Automated Network Resilience Experiment Runner and Critical-Link Analyzer.

Implements repeatable automated scenarios to evaluate and benchmark:
  Policy A: Baseline Dijkstra with static metrics
  Policy B: Adaptive Multi-Metric without Hysteresis (flapping baseline)
  Policy C: Proposed Failure-Aware Multi-Metric with Route Stability (FAMM-RS)

Supports:
- Single-link failure and restoration
- Selected double-link failures
- Gradual congestion oscillation (demonstrating route dampening)
- Network partition and disconnected graphs
- Critical-link vulnerability ranking
- Synthetic scalable graph topologies
- Structured CSV and JSON data export
"""

from __future__ import annotations

import copy
import io
import json
import math
import random
import time
from datetime import datetime, timezone
from typing import Optional

from app.algorithms.dijkstra import run_dijkstra
from app.algorithms.proposed_policy import run_proposed_policy
from app.models.schemas import (
    CriticalLinkAnalysisResponse,
    CriticalLinkItem,
    ExperimentStepResult,
    HysteresisConfig,
    LinkStatus,
    MetricWeights,
    NetworkLink,
    PolicyOverallSummary,
    PolicyStepMetric,
    ResilienceExperimentReport,
    ResilienceExperimentRequest,
    RouteStabilityRecord,
    RouterId,
    RouterNodeData,
    ScenarioEvent,
)
from app.services import cost_service, topology_service
from app.services.stability_service import (
    _recompute_path_cost,
    evaluate_with_hysteresis,
)
from app.utils.graph_utils import ALL_ROUTERS, find_link_id

# Global store for completed experiment reports
_experiment_cache: dict[str, ResilienceExperimentReport] = {}


def generate_synthetic_topology(num_nodes: int = 10, seed: int = 42) -> tuple[list[RouterNodeData], list[NetworkLink]]:
    """
    Generate a reproducible synthetic mesh/ring network topology with configurable size.
    Used to evaluate policy scalability as network size increases.
    """
    rng = random.Random(seed)
    nodes: list[RouterNodeData] = []
    node_ids: list[str] = [f"R{i+1}" for i in range(num_nodes)]

    for i, nid in enumerate(node_ids):
        nodes.append(
            RouterNodeData(
                id=RouterId.R1 if nid == "R1" else (RouterId.R5 if nid == "R5" else RouterId.R2),
                label=f"Router {nid}",
                ipAddress=f"10.0.{i+1}.1",
                loopback=f"10.255.0.{i+1}/32",
                status="active",
                description=f"Synthetic transit node {nid}",
                interfaces=[],
                cpuUsage=float(rng.randint(15, 45)),
                memoryUsage=float(rng.randint(20, 55)),
            )
        )

    links: list[NetworkLink] = []
    # Ring backbone
    for i in range(num_nodes):
        u = node_ids[i]
        v = node_ids[(i + 1) % num_nodes]
        bw = float(rng.choice([500, 1000, 10000]))
        delay = float(rng.randint(2, 12))
        cong = float(rng.randint(5, 30))
        risk = round(rng.uniform(0.02, 0.18), 3)
        c = cost_service.calculate_cost(bw, delay, cong, simulated_failure_risk=risk)
        lid = f"{u}-{v}"
        u_rid = RouterId.R1 if u == "R1" else (RouterId.R5 if u == "R5" else RouterId.R2)
        v_rid = RouterId.R1 if v == "R1" else (RouterId.R5 if v == "R5" else RouterId.R2)
        links.append(
            NetworkLink(
                id=lid,
                source=u_rid,
                target=v_rid,
                cost=c,
                bandwidthMbps=bw,
                delayMs=delay,
                congestionPercent=cong,
                status=LinkStatus.ACTIVE,
                simulatedFailureRisk=risk,
            )
        )

    # Chords/cross links for redundancy
    for i in range(num_nodes):
        if i + 2 < num_nodes and rng.random() > 0.4:
            u = node_ids[i]
            v = node_ids[i + 2]
            bw = float(rng.choice([500, 1000]))
            delay = float(rng.randint(4, 16))
            cong = float(rng.randint(10, 40))
            risk = round(rng.uniform(0.04, 0.22), 3)
            c = cost_service.calculate_cost(bw, delay, cong, simulated_failure_risk=risk)
            lid = f"{u}-{v}"
            u_rid = RouterId.R1 if u == "R1" else (RouterId.R5 if u == "R5" else RouterId.R2)
            v_rid = RouterId.R1 if v == "R1" else (RouterId.R5 if v == "R5" else RouterId.R2)
            links.append(
                NetworkLink(
                    id=lid,
                    source=u_rid,
                    target=v_rid,
                    cost=c,
                    bandwidthMbps=bw,
                    delayMs=delay,
                    congestionPercent=cong,
                    status=LinkStatus.ACTIVE,
                    simulatedFailureRisk=risk,
                )
            )

    return nodes, links


def _build_scenario_events(
    scenario: str,
    target_link_1: str = "R3-R5",
    target_link_2: str = "R1-R3",
    random_seed: int = 42,
) -> tuple[str, str, list[ScenarioEvent]]:
    """Build deterministic event sequence for the requested scenario."""
    rng = random.Random(random_seed)

    if scenario == "single_failure":
        name = "Single-Link Failure and Restoration"
        desc = f"Simulates steady state, severs primary link {target_link_1}, measures failover, then restores the link."
        events = [
            ScenarioEvent(step=1, action="none", description="Step 1: Steady-state baseline network operations"),
            ScenarioEvent(
                step=2,
                action="fail_link",
                targetLinkId=target_link_1,
                description=f"Step 2: SEVERE FAILURE - Link {target_link_1} fails unexpectedly",
            ),
            ScenarioEvent(
                step=3,
                action="none",
                description=f"Step 3: Post-failure transit traffic stabilizes on redundant bypass path",
            ),
            ScenarioEvent(
                step=4,
                action="restore_link",
                targetLinkId=target_link_1,
                description=f"Step 4: RESTORATION - Physical link {target_link_1} is repaired and brought online",
            ),
            ScenarioEvent(
                step=5,
                action="none",
                description="Step 5: Post-restoration convergence and hysteresis evaluation",
            ),
        ]

    elif scenario == "double_failure":
        name = "Selected Double-Link Compound Failure"
        desc = f"Severing primary backbone link {target_link_1} followed by {target_link_2} to evaluate deep path resilience."
        events = [
            ScenarioEvent(step=1, action="none", description="Step 1: Baseline network operations"),
            ScenarioEvent(
                step=2,
                action="fail_link",
                targetLinkId=target_link_1,
                description=f"Step 2: Primary link {target_link_1} cut",
            ),
            ScenarioEvent(
                step=3,
                action="fail_link",
                targetLinkId=target_link_2,
                description=f"Step 3: COMPOUND FAILURE - Second backbone link {target_link_2} cut simultaneously",
            ),
            ScenarioEvent(
                step=4,
                action="restore_link",
                targetLinkId=target_link_1,
                description=f"Step 4: Partial repair - Link {target_link_1} restored",
            ),
            ScenarioEvent(
                step=5,
                action="restore_link",
                targetLinkId=target_link_2,
                description=f"Step 5: Full recovery - Link {target_link_2} restored",
            ),
        ]

    elif scenario == "congestion_oscillation":
        name = "Congestion Fluctuation & Route Oscillation Stress Test"
        desc = "Perturbs congestion on the primary route back and forth across small margins to evaluate route flapping vs dampening."
        events = [
            ScenarioEvent(step=1, action="none", description="Step 1: Initial balanced load"),
            ScenarioEvent(
                step=2,
                action="set_congestion",
                targetLinkId="R1-R3",
                value=45.0,
                description="Step 2: Moderate congestion spike on R1-R3 (+20%)",
            ),
            ScenarioEvent(
                step=3,
                action="set_congestion",
                targetLinkId="R1-R3",
                value=24.0,
                description="Step 3: Congestion drops slightly below alternative bypass route",
            ),
            ScenarioEvent(
                step=4,
                action="set_congestion",
                targetLinkId="R1-R3",
                value=48.0,
                description="Step 4: Congestion rises again slightly (+24%)",
            ),
            ScenarioEvent(
                step=5,
                action="set_congestion",
                targetLinkId="R1-R3",
                value=22.0,
                description="Step 5: Congestion drops again slightly (-26%)",
            ),
            ScenarioEvent(
                step=6,
                action="set_congestion",
                targetLinkId="R1-R3",
                value=50.0,
                description="Step 6: Congestion rises back to 50%",
            ),
            ScenarioEvent(
                step=7,
                action="set_congestion",
                targetLinkId="R1-R3",
                value=25.0,
                description="Step 7: Congestion settles back to baseline 25%",
            ),
        ]

    elif scenario == "network_partition":
        name = "Network Partition / Disconnected Graph Test"
        desc = "Severs all physical egress connections to destination R5, testing graceful disconnection handling."
        events = [
            ScenarioEvent(step=1, action="none", description="Step 1: Baseline network connected"),
            ScenarioEvent(
                step=2,
                action="fail_link",
                targetLinkId="R3-R5",
                description="Step 2: Primary egress R3-R5 cut",
            ),
            ScenarioEvent(
                step=3,
                action="fail_link",
                targetLinkId="R4-R5",
                description="Step 3: COMPLETE ISOLATION - Redundant egress R4-R5 cut, isolating R5",
            ),
            ScenarioEvent(
                step=4,
                action="none",
                description="Step 4: Evaluating unreachable graph behavior across all algorithms",
            ),
            ScenarioEvent(
                step=5,
                action="restore_link",
                targetLinkId="R4-R5",
                description="Step 5: Redundant egress R4-R5 restored (reconnecting R5)",
            ),
            ScenarioEvent(
                step=6,
                action="restore_link",
                targetLinkId="R3-R5",
                description="Step 6: Primary egress R3-R5 restored",
            ),
        ]

    else:
        name = "Standard Network Resilience Walkthrough"
        desc = "Standard single link failure test."
        events = [
            ScenarioEvent(step=1, action="none", description="Step 1: Baseline"),
            ScenarioEvent(step=2, action="fail_link", targetLinkId=target_link_1, description=f"Fail {target_link_1}"),
            ScenarioEvent(step=3, action="restore_link", targetLinkId=target_link_1, description=f"Restore {target_link_1}"),
        ]

    return name, desc, events


def run_resilience_experiment(request: ResilienceExperimentRequest) -> ResilienceExperimentReport:
    """
    Execute an automated resilience benchmark comparing:
    - Policy A: Static Dijkstra
    - Policy B: Adaptive Multi-Metric without Hysteresis
    - Policy C: Proposed FAMM-RS with Hysteresis
    """
    exp_id = f"exp_{int(time.time())}_{random.randint(1000, 9999)}"
    source = request.source
    destination = request.destination
    weights = request.weights or cost_service.get_policy_config().weights
    weights = weights.normalized()
    hysteresis_thresh = max(request.hysteresisThreshold, 0.0)

    # Initialize working copy of topology
    if request.scenario == "synthetic_graph" and request.topologySize and request.topologySize > 5:
        _, working_links = generate_synthetic_topology(num_nodes=request.topologySize, seed=request.randomSeed or 42)
    else:
        working_links = topology_service.get_links()

    target_1 = request.targetLinkId or "R3-R5"
    target_2 = request.secondTargetLinkId or "R1-R3"

    scen_name, scen_desc, events = _build_scenario_events(
        request.scenario,
        target_link_1=target_1,
        target_link_2=target_2,
        random_seed=request.randomSeed or 42,
    )

    # Internal state tracking per policy across simulation steps
    # Policy A: Static Dijkstra state
    active_path_a: Optional[list[RouterId]] = None
    switches_a = 0

    # Policy B: Adaptive Multi-Metric without Hysteresis
    active_path_b: Optional[list[RouterId]] = None
    switches_b = 0

    # Policy C: Proposed FAMM-RS with Hysteresis
    active_path_c: Optional[list[RouterId]] = None
    switches_c = 0
    active_cost_c: Optional[float] = None

    steps_results: list[ExperimentStepResult] = []

    # Accumulators for overall metrics
    policy_names = ["dijkstra_static", "adaptive_no_hysteresis", "famm_rs_hysteresis"]
    step_metrics_acc: dict[str, list[dict]] = {p: [] for p in policy_names}

    for evt in events:
        # 1. Apply event mutation to working_links
        if evt.action == "fail_link" and evt.targetLinkId:
            for lk in working_links:
                if lk.id == evt.targetLinkId:
                    lk.status = LinkStatus.FAILED
                    lk.failedAt = datetime.now(timezone.utc).isoformat()
        elif evt.action == "restore_link" and evt.targetLinkId:
            for lk in working_links:
                if lk.id == evt.targetLinkId:
                    lk.status = LinkStatus.ACTIVE
                    lk.failedAt = None
        elif evt.action == "set_congestion" and evt.targetLinkId and evt.value is not None:
            for lk in working_links:
                if lk.id == evt.targetLinkId:
                    lk.congestionPercent = float(evt.value)
                    lk.cost = cost_service.calculate_cost(
                        lk.bandwidthMbps, lk.delayMs, lk.congestionPercent, lk.simulatedFailureRisk, weights
                    )
        elif evt.action == "set_risk" and evt.targetLinkId and evt.value is not None:
            for lk in working_links:
                if lk.id == evt.targetLinkId:
                    lk.simulatedFailureRisk = float(evt.value)
                    lk.cost = cost_service.calculate_cost(
                        lk.bandwidthMbps, lk.delayMs, lk.congestionPercent, lk.simulatedFailureRisk, weights
                    )

        # 2. Evaluate Policy A: Static Dijkstra
        t0 = time.perf_counter()
        res_a = run_dijkstra(source, destination, working_links)
        time_a = (time.perf_counter() - t0) * 1000

        switched_a = False
        reason_a = "Optimal Dijkstra SPF maintained"
        if res_a.success:
            if active_path_a is None:
                active_path_a = res_a.path
                switched_a = True
                reason_a = "Initial path selected"
            elif res_a.path != active_path_a:
                switches_a += 1
                switched_a = True
                reason_a = f"Route changed from {' → '.join(str(p) for p in active_path_a)} to {' → '.join(str(p) for p in res_a.path)}"
                active_path_a = res_a.path
        else:
            if active_path_a is not None:
                switches_a += 1
                switched_a = True
                reason_a = "Destination unreachable: route severed"
                active_path_a = None

        metric_a = PolicyStepMetric(
            policy="dijkstra_static",
            reachable=res_a.success,
            path=[str(p) for p in res_a.path],
            links=res_a.links,
            totalCost=res_a.totalCost,
            totalHops=res_a.totalHops,
            totalDelayMs=res_a.totalDelayMs,
            bottleneckBandwidthMbps=res_a.bottleneckBandwidthMbps,
            computationTimeMs=round(time_a, 3),
            switched=switched_a,
            switchReason=reason_a,
        )

        # 3. Evaluate Policy B: Adaptive Multi-Metric without Hysteresis
        t0 = time.perf_counter()
        res_b = run_proposed_policy(source, destination, working_links, weights=weights)
        time_b = (time.perf_counter() - t0) * 1000

        switched_b = False
        reason_b = "Adaptive FAMM path maintained"
        if res_b.success:
            if active_path_b is None:
                active_path_b = res_b.path
                switched_b = True
                reason_b = "Initial adaptive route selected"
            elif res_b.path != active_path_b:
                switches_b += 1
                switched_b = True
                reason_b = f"Instantaneous metric improvement: switched to {' → '.join(str(p) for p in res_b.path)}"
                active_path_b = res_b.path
        else:
            if active_path_b is not None:
                switches_b += 1
                switched_b = True
                reason_b = "Destination unreachable"
                active_path_b = None

        metric_b = PolicyStepMetric(
            policy="adaptive_no_hysteresis",
            reachable=res_b.success,
            path=[str(p) for p in res_b.path],
            links=res_b.links,
            totalCost=res_b.totalCost,
            totalHops=res_b.totalHops,
            totalDelayMs=res_b.totalDelayMs,
            bottleneckBandwidthMbps=res_b.bottleneckBandwidthMbps,
            computationTimeMs=round(time_b, 3),
            switched=switched_b,
            switchReason=reason_b,
        )

        # 4. Evaluate Policy C: Proposed FAMM-RS with Hysteresis
        t0 = time.perf_counter()
        cand_c = run_proposed_policy(source, destination, working_links, weights=weights)
        time_c = (time.perf_counter() - t0) * 1000

        switched_c = False
        reason_c = "Active route retained"
        effective_path_c = cand_c.path
        effective_cost_c = cand_c.totalCost
        effective_links_c = cand_c.links
        effective_delay_c = cand_c.totalDelayMs
        effective_bw_c = cand_c.bottleneckBandwidthMbps
        reachable_c = cand_c.success

        if not cand_c.success:
            if active_path_c is not None:
                switches_c += 1
                switched_c = True
                reason_c = "Destination unreachable: all routes severed"
                active_path_c = None
                active_cost_c = None
            reachable_c = False
        elif active_path_c is None:
            active_path_c = cand_c.path
            active_cost_c = cand_c.totalCost
            switches_c += 1
            switched_c = True
            reason_c = "Initial FAMM-RS route established"
        else:
            # Check validity of active_path_c
            curr_active_cost, is_valid = _recompute_path_cost(active_path_c, working_links)
            if not is_valid or curr_active_cost is None:
                # Emergency failover
                switches_c += 1
                switched_c = True
                reason_c = f"FAILOVER: Active route severed; immediate switch to backup {' → '.join(str(p) for p in cand_c.path)}"
                active_path_c = cand_c.path
                active_cost_c = cand_c.totalCost
            else:
                active_cost_c = curr_active_cost
                delta = curr_active_cost - cand_c.totalCost
                rel_imp = (delta / curr_active_cost) if curr_active_cost > 0 else 0.0

                if [str(p) for p in cand_c.path] == [str(p) for p in active_path_c]:
                    switched_c = False
                    reason_c = "Active route remains optimal"
                elif delta <= 0:
                    switched_c = False
                    reason_c = "Active route cost is lower or equal; retained"
                elif rel_imp >= hysteresis_thresh and delta >= 0.02:
                    switches_c += 1
                    switched_c = True
                    reason_c = f"Improvement {rel_imp*100:.1f}% >= threshold {hysteresis_thresh*100:.1f}%; switched to {' → '.join(str(p) for p in cand_c.path)}"
                    active_path_c = cand_c.path
                    active_cost_c = cand_c.totalCost
                else:
                    # Suppressed by hysteresis!
                    switched_c = False
                    reason_c = f"HYSTERESIS DAMPENING: Improvement {rel_imp*100:.1f}% < threshold {hysteresis_thresh*100:.1f}%; route switch suppressed to prevent flapping"
                    # Keep previous active path
                    effective_path_c = active_path_c
                    effective_cost_c = curr_active_cost
                    # Recompute links for previous active path
                    effective_links_c = [
                        find_link_id(active_path_c[i], active_path_c[i + 1], working_links) or f"{active_path_c[i]}-{active_path_c[i+1]}"
                        for i in range(len(active_path_c) - 1)
                    ]

        metric_c = PolicyStepMetric(
            policy="famm_rs_hysteresis",
            reachable=reachable_c,
            path=[str(p) for p in effective_path_c],
            links=effective_links_c,
            totalCost=effective_cost_c,
            totalHops=len(effective_links_c),
            totalDelayMs=effective_delay_c,
            bottleneckBandwidthMbps=effective_bw_c,
            computationTimeMs=round(time_c, 3),
            switched=switched_c,
            switchReason=reason_c,
        )

        step_metrics_acc["dijkstra_static"].append(metric_a.model_dump())
        step_metrics_acc["adaptive_no_hysteresis"].append(metric_b.model_dump())
        step_metrics_acc["famm_rs_hysteresis"].append(metric_c.model_dump())

        # Active links count for summary
        active_cnt = sum(1 for l in working_links if l.status.value == "active")
        total_cnt = len(working_links)
        state_summary = f"{active_cnt}/{total_cnt} links operational"

        steps_results.append(
            ExperimentStepResult(
                step=evt.step,
                event=evt,
                networkStateSummary=state_summary,
                policyMetrics={
                    "dijkstra_static": metric_a,
                    "adaptive_no_hysteresis": metric_b,
                    "famm_rs_hysteresis": metric_c,
                },
            )
        )

    # 5. Compute overall summaries for each policy
    summaries: dict[str, PolicyOverallSummary] = {}
    for p in policy_names:
        m_list = step_metrics_acc[p]
        reachable_count = sum(1 for m in m_list if m["reachable"])
        reach_pct = round((reachable_count / len(m_list)) * 100, 1)

        reachable_costs = [m["totalCost"] for m in m_list if m["reachable"] and m["totalCost"] > 0]
        avg_cost = round(sum(reachable_costs) / len(reachable_costs), 4) if reachable_costs else 0.0

        reachable_delays = [m["totalDelayMs"] for m in m_list if m["reachable"]]
        avg_delay = round(sum(reachable_delays) / len(reachable_delays), 2) if reachable_delays else 0.0

        total_sw = sum(1 for m in m_list if m["switched"])
        avg_comp = round(sum(m["computationTimeMs"] for m in m_list) / len(m_list), 3)

        # Baseline cost inflation versus ideal adaptive minimum
        ideal_costs = [
            step_metrics_acc["adaptive_no_hysteresis"][i]["totalCost"]
            for i in range(len(m_list))
            if step_metrics_acc["adaptive_no_hysteresis"][i]["reachable"]
        ]
        avg_ideal = sum(ideal_costs) / len(ideal_costs) if ideal_costs else 1.0
        cost_inflation = round(max((avg_cost - avg_ideal) / max(avg_ideal, 1e-4) * 100, 0.0), 2)

        # Stability score calculation (0 - 100):
        # High reachability, low unnecessary switching, deterministic dampening
        switch_penalty = min(total_sw * 12.0, 50.0)
        reach_credit = reach_pct * 0.5
        stability_score = round(max(reach_credit + (50.0 - switch_penalty), 0.0), 1)

        summaries[p] = PolicyOverallSummary(
            policy=p,
            reachabilityPercent=reach_pct,
            averageCost=avg_cost,
            averageDelayMs=avg_delay,
            totalSwitches=total_sw,
            averageComputationTimeMs=avg_comp,
            costInflationVersusOptimal=cost_inflation,
            stabilityScore=stability_score,
        )

    report = ResilienceExperimentReport(
        experimentId=exp_id,
        scenarioName=scen_name,
        description=scen_desc,
        source=source.value if hasattr(source, "value") else str(source),
        destination=destination.value if hasattr(destination, "value") else str(destination),
        randomSeed=request.randomSeed,
        trials=request.trials,
        steps=steps_results,
        summaries=summaries,
        criticalLinks=[target_1, target_2],
        timestamp=datetime.now(timezone.utc).isoformat(),
    )

    _experiment_cache[exp_id] = report
    return report


def analyze_critical_links(links: Optional[list[NetworkLink]] = None) -> CriticalLinkAnalysisResponse:
    """
    Simulated Critical-Link Vulnerability Analyzer.

    Simulates the failure of each link in the topology one-by-one and measures:
    - Does removing the link disconnect any router pair? (Bridge detection)
    - What is the global all-pairs reachability ratio?
    - How much does the average path cost inflate across affected operational paths?
    - Computes simulated criticality score (0-100) and classification.

    Note: This is an empirical simulation-based vulnerability metric, distinguished
    from formal graph-theoretic cut-set guarantees.
    """
    base_links = links or topology_service.get_links()
    routers = ALL_ROUTERS
    total_pairs = len(routers) * (len(routers) - 1)
    critical_items: list[CriticalLinkItem] = []

    # 1. Measure baseline all-pairs reachability and costs
    baseline_costs: dict[tuple[RouterId, RouterId], float] = {}
    for u in routers:
        for v in routers:
            if u != v:
                r = run_dijkstra(u, v, base_links)
                if r.success:
                    baseline_costs[(u, v)] = r.totalCost

    # 2. Iterate through each link and evaluate impact of its removal
    for target_link in base_links:
        # Create topology with target_link failed
        sub_links = []
        for l in base_links:
            copy_l = l.model_copy()
            if copy_l.id == target_link.id:
                copy_l.status = LinkStatus.FAILED
            sub_links.append(copy_l)

        reachable_pairs = 0
        cost_inflations: list[float] = []
        disconnects = False

        for u in routers:
            for v in routers:
                if u != v:
                    r_sub = run_dijkstra(u, v, sub_links)
                    if r_sub.success:
                        reachable_pairs += 1
                        base_c = baseline_costs.get((u, v), 1.0)
                        if base_c > 0:
                            cost_inflations.append(r_sub.totalCost / base_c)
                    else:
                        disconnects = True

        reach_ratio = round(reachable_pairs / total_pairs, 4)
        avg_inflation = round(sum(cost_inflations) / len(cost_inflations), 4) if cost_inflations else 2.5

        # Criticality formula:
        # Heavily penalizes disconnection (60%), cost inflation (30%), and link's simulated failure risk (10%)
        disconnect_factor = 60.0 if disconnects or reach_ratio < 1.0 else 0.0
        inflation_factor = min(max((avg_inflation - 1.0) * 40.0, 0.0), 30.0)
        risk_factor = target_link.simulatedFailureRisk * 10.0
        crit_score = round(min(disconnect_factor + inflation_factor + risk_factor, 100.0), 1)

        if disconnects or reach_ratio < 0.9:
            classification = "CRITICAL_BRIDGE"
        elif crit_score > 35.0:
            classification = "MAJOR_BOTTLENECK"
        else:
            classification = "REDUNDANT"

        critical_items.append(
            CriticalLinkItem(
                linkId=target_link.id,
                source=target_link.source.value,
                target=target_link.target.value,
                currentStatus=target_link.status.value,
                disconnectsNetwork=disconnects,
                reachabilityRatio=reach_ratio,
                costInflationFactor=avg_inflation,
                criticalityScore=crit_score,
                classification=classification,
            )
        )

    # Sort descending by criticality score
    critical_items.sort(key=lambda x: x.criticalityScore, reverse=True)

    recommendation = (
        f"Highest vulnerability identified on link '{critical_items[0].linkId}' "
        f"(Criticality Score: {critical_items[0].criticalityScore}/100). "
        f"Failure would cause network partition: {critical_items[0].disconnectsNetwork}. "
        "Recommend provisioning dual-homed redundant bypass link."
    )

    return CriticalLinkAnalysisResponse(
        analyzedAt=datetime.now(timezone.utc).isoformat(),
        totalLinks=len(critical_items),
        criticalLinks=critical_items,
        recommendation=recommendation,
    )


def export_experiment_csv(report: ResilienceExperimentReport) -> str:
    """Generate CSV string of the experiment step-by-step results."""
    buf = io.StringIO()
    buf.write("experiment_id,scenario,step,action,target_link,network_state,policy,reachable,path,total_cost,hops,delay_ms,bandwidth_mbps,computation_time_ms,switched,switch_reason\n")

    for s in report.steps:
        evt = s.event
        state = s.networkStateSummary.replace(",", ";")
        for p_name, m in s.policyMetrics.items():
            path_str = " -> ".join(m.path) if m.path else "NONE"
            reason_str = (m.switchReason or "").replace(",", ";").replace('"', "'")
            buf.write(
                f'"{report.experimentId}","{report.scenarioName}",{s.step},"{evt.action}","{evt.targetLinkId or ""}","{state}","{p_name}",{m.reachable},"{path_str}",{m.totalCost},{m.totalHops},{m.totalDelayMs},{m.bottleneckBandwidthMbps},{m.computationTimeMs},{m.switched},"{reason_str}"\n'
            )

    return buf.getvalue()


def get_cached_report(exp_id: str) -> Optional[ResilienceExperimentReport]:
    return _experiment_cache.get(exp_id)
