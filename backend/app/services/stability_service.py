"""
Route Stability and Hysteresis Management Service (FAMM-RS Feature 2).

Manages active routes across simulation steps, preventing route oscillation
under metric fluctuations by enforcing a deterministic hysteresis threshold:

Rules:
1. If the active route becomes invalid or any link fails, immediately switch
   to a valid alternative route if one exists.
2. If the active route remains valid, switch to a candidate alternative only
   if the candidate improves the score by at least the configurable threshold:
       (J(P_active) - J(P_cand)) / J(P_active) >= threshold
   and J(P_active) - J(P_cand) >= min_absolute_improvement.
3. If hysteresis is disabled (threshold = 0 or enabled = False), any strict
   cost improvement triggers a switch (used for fair baseline comparison).
4. Every decision records simulation step, timestamps, previous path, candidate path,
   score difference, and explicit human-readable justification.
"""

from __future__ import annotations

import copy
import threading
from datetime import datetime, timezone
from typing import Optional

from app.models.schemas import (
    HysteresisConfig,
    NetworkLink,
    RouteResult,
    RouterId,
    RouteStabilityRecord,
)
from app.services.cost_service import calculate_cost, get_policy_config
from app.utils.graph_utils import find_link_id

_lock = threading.Lock()

# State: (source, destination) -> dict of active path state
_active_routes: dict[tuple[str, str], dict] = {}
# History of stability evaluations
_stability_records: list[RouteStabilityRecord] = []
_current_step: int = 0


def get_current_step() -> int:
    with _lock:
        return _current_step


def increment_step() -> int:
    global _current_step
    with _lock:
        _current_step += 1
        return _current_step


def reset_stability_state() -> None:
    """Clear all active route state and audit history."""
    global _active_routes, _stability_records, _current_step
    with _lock:
        _active_routes.clear()
        _stability_records.clear()
        _current_step = 0


def get_active_route(source: str, destination: str) -> Optional[dict]:
    with _lock:
        st = _active_routes.get((source, destination))
        return copy.deepcopy(st) if st else None


def get_all_active_routes() -> dict[str, dict]:
    with _lock:
        return {f"{k[0]}->{k[1]}": copy.deepcopy(v) for k, v in _active_routes.items()}


def get_stability_history(limit: int = 100) -> list[RouteStabilityRecord]:
    with _lock:
        return copy.deepcopy(_stability_records[-limit:])


def _recompute_path_cost(
    path: list[RouterId | str],
    links: list[NetworkLink],
) -> tuple[Optional[float], bool]:
    """
    Check if a path is still valid (all links active) and recompute its composite cost.
    Returns (cost, is_valid). If invalid or disconnected, returns (None, False).
    """
    if not path or len(path) < 2:
        return (0.0, True) if len(path) == 1 else (None, False)

    link_map = {l.id: l for l in links}
    total_cost = 0.0

    for i in range(len(path) - 1):
        u = path[i]
        v = path[i + 1]
        u_rid = RouterId(u) if isinstance(u, str) and u in RouterId.__members__ else u
        v_rid = RouterId(v) if isinstance(v, str) and v in RouterId.__members__ else v
        lid = find_link_id(u_rid, v_rid, links)
        if not lid or lid not in link_map:
            return None, False
        lk = link_map[lid]
        if lk.status.value != "active":
            return None, False
        total_cost += lk.cost

    return round(total_cost, 6), True


def evaluate_with_hysteresis(
    source: RouterId,
    destination: RouterId,
    candidate_result: RouteResult,
    links: list[NetworkLink],
    hysteresis_override: Optional[HysteresisConfig] = None,
    step: Optional[int] = None,
) -> tuple[RouteResult, RouteStabilityRecord]:
    """
    Apply route stability hysteresis control to candidate route result.

    Returns:
        (effective_route_result, stability_record)
    """
    with _lock:
        cfg = hysteresis_override or get_policy_config().hysteresis
        eval_step = step if step is not None else _current_step
        src_str = source.value if hasattr(source, "value") else str(source)
        dst_str = destination.value if hasattr(destination, "value") else str(destination)
        key = (src_str, dst_str)

        active_state = _active_routes.get(key)
        now_ts = datetime.now(timezone.utc).isoformat()

        cand_path_str = [r.value if hasattr(r, "value") else str(r) for r in candidate_result.path]

        # Case 1: Candidate is completely unreachable
        if not candidate_result.success or not candidate_result.path:
            # Active path is also severed
            _active_routes.pop(key, None)
            record = RouteStabilityRecord(
                step=eval_step,
                timestamp=now_ts,
                source=src_str,
                destination=dst_str,
                activeRouteBefore=active_state.get("path_str", []) if active_state else [],
                candidateRoute=[],
                activeRouteAfter=[],
                activeCostBefore=active_state.get("cost") if active_state else None,
                candidateCost=None,
                activeCostAfter=None,
                costDifference=0.0,
                relativeImprovement=0.0,
                switched=bool(active_state),
                reason="Destination unreachable: no active physical path available in network",
                policy="proposed-famm-rs",
            )
            _stability_records.append(record)
            candidate_result.stabilityAction = "UNREACHABLE"
            candidate_result.switchReason = record.reason
            return candidate_result, record

        # Case 2: No active route previously established
        if not active_state:
            _active_routes[key] = {
                "path": candidate_result.path,
                "path_str": cand_path_str,
                "links": candidate_result.links,
                "cost": candidate_result.totalCost,
                "updated_at": now_ts,
                "step": eval_step,
                "full_result": candidate_result,
            }
            record = RouteStabilityRecord(
                step=eval_step,
                timestamp=now_ts,
                source=src_str,
                destination=dst_str,
                activeRouteBefore=[],
                candidateRoute=cand_path_str,
                activeRouteAfter=cand_path_str,
                activeCostBefore=None,
                candidateCost=candidate_result.totalCost,
                activeCostAfter=candidate_result.totalCost,
                costDifference=0.0,
                relativeImprovement=0.0,
                switched=True,
                reason="Initial route established for source-destination pair",
                policy="proposed-famm-rs",
            )
            _stability_records.append(record)
            candidate_result.stabilityAction = "INITIAL_ROUTE"
            candidate_result.switchReason = record.reason
            return candidate_result, record

        # Case 3: Prior active route exists -> verify if it is still operational
        prev_path = active_state["path"]
        prev_path_str = active_state["path_str"]
        prev_cost, is_valid = _recompute_path_cost(prev_path, links)

        # 3a. Active path suffered a link failure -> immediate emergency switch!
        if not is_valid or prev_cost is None:
            _active_routes[key] = {
                "path": candidate_result.path,
                "path_str": cand_path_str,
                "links": candidate_result.links,
                "cost": candidate_result.totalCost,
                "updated_at": now_ts,
                "step": eval_step,
                "full_result": candidate_result,
            }
            record = RouteStabilityRecord(
                step=eval_step,
                timestamp=now_ts,
                source=src_str,
                destination=dst_str,
                activeRouteBefore=prev_path_str,
                candidateRoute=cand_path_str,
                activeRouteAfter=cand_path_str,
                activeCostBefore=None,
                candidateCost=candidate_result.totalCost,
                activeCostAfter=candidate_result.totalCost,
                costDifference=0.0,
                relativeImprovement=1.0,
                switched=True,
                reason="EMERGENCY FAILOVER: Active route severed by link failure; immediately switched to backup path",
                policy="proposed-famm-rs",
            )
            _stability_records.append(record)
            candidate_result.stabilityAction = "FAILOVER_SWITCH"
            candidate_result.switchReason = record.reason
            return candidate_result, record

        # 3b. Active path is still valid. Compare candidate vs active cost.
        active_state["cost"] = prev_cost  # update to live cost
        delta_cost = prev_cost - candidate_result.totalCost
        rel_improvement = (delta_cost / prev_cost) if prev_cost > 0 else 0.0

        # Candidate is identical path -> no route switch
        if cand_path_str == prev_path_str:
            record = RouteStabilityRecord(
                step=eval_step,
                timestamp=now_ts,
                source=src_str,
                destination=dst_str,
                activeRouteBefore=prev_path_str,
                candidateRoute=cand_path_str,
                activeRouteAfter=prev_path_str,
                activeCostBefore=prev_cost,
                candidateCost=candidate_result.totalCost,
                activeCostAfter=prev_cost,
                costDifference=0.0,
                relativeImprovement=0.0,
                switched=False,
                reason="Active route remains optimal; no routing switch needed",
                policy="proposed-famm-rs",
            )
            _stability_records.append(record)
            candidate_result.stabilityAction = "MAINTAIN_ACTIVE"
            candidate_result.switchReason = record.reason
            return candidate_result, record

        # Candidate has worse or equal cost -> definitely keep active
        if delta_cost <= 0:
            record = RouteStabilityRecord(
                step=eval_step,
                timestamp=now_ts,
                source=src_str,
                destination=dst_str,
                activeRouteBefore=prev_path_str,
                candidateRoute=cand_path_str,
                activeRouteAfter=prev_path_str,
                activeCostBefore=prev_cost,
                candidateCost=candidate_result.totalCost,
                activeCostAfter=prev_cost,
                costDifference=round(delta_cost, 6),
                relativeImprovement=round(rel_improvement, 6),
                switched=False,
                reason=f"Active route cost ({prev_cost:.4f}) is lower or equal to candidate ({candidate_result.totalCost:.4f}); retained",
                policy="proposed-famm-rs",
            )
            _stability_records.append(record)
            candidate_result.stabilityAction = "MAINTAIN_ACTIVE"
            candidate_result.switchReason = record.reason
            return candidate_result, record

        # Candidate is cheaper: evaluate hysteresis threshold!
        if not cfg.enabled or cfg.threshold <= 0:
            # Hysteresis disabled: switch whenever cheaper
            _active_routes[key] = {
                "path": candidate_result.path,
                "path_str": cand_path_str,
                "links": candidate_result.links,
                "cost": candidate_result.totalCost,
                "updated_at": now_ts,
                "step": eval_step,
                "full_result": candidate_result,
            }
            record = RouteStabilityRecord(
                step=eval_step,
                timestamp=now_ts,
                source=src_str,
                destination=dst_str,
                activeRouteBefore=prev_path_str,
                candidateRoute=cand_path_str,
                activeRouteAfter=cand_path_str,
                activeCostBefore=prev_cost,
                candidateCost=candidate_result.totalCost,
                activeCostAfter=candidate_result.totalCost,
                costDifference=round(delta_cost, 6),
                relativeImprovement=round(rel_improvement, 6),
                switched=True,
                reason=f"Hysteresis disabled: candidate path improved cost by {delta_cost:.4f} ({rel_improvement*100:.1f}%); switch accepted",
                policy="adaptive_no_hysteresis",
            )
            _stability_records.append(record)
            candidate_result.stabilityAction = "SWITCHED_NO_HYSTERESIS"
            candidate_result.switchReason = record.reason
            return candidate_result, record

        # Hysteresis enabled: check threshold criteria
        threshold_met = (
            rel_improvement >= cfg.threshold
            and delta_cost >= cfg.min_absolute_improvement
        )

        if threshold_met:
            # Candidate improvement exceeds threshold -> switch accepted!
            _active_routes[key] = {
                "path": candidate_result.path,
                "path_str": cand_path_str,
                "links": candidate_result.links,
                "cost": candidate_result.totalCost,
                "updated_at": now_ts,
                "step": eval_step,
                "full_result": candidate_result,
            }
            record = RouteStabilityRecord(
                step=eval_step,
                timestamp=now_ts,
                source=src_str,
                destination=dst_str,
                activeRouteBefore=prev_path_str,
                candidateRoute=cand_path_str,
                activeRouteAfter=cand_path_str,
                activeCostBefore=prev_cost,
                candidateCost=candidate_result.totalCost,
                activeCostAfter=candidate_result.totalCost,
                costDifference=round(delta_cost, 6),
                relativeImprovement=round(rel_improvement, 6),
                switched=True,
                reason=(
                    f"SWITCH ACCEPTED: Candidate improvement {rel_improvement*100:.1f}% "
                    f"(ΔJ={delta_cost:.4f}) exceeds hysteresis threshold {cfg.threshold*100:.1f}%. "
                    f"Switching from {' → '.join(prev_path_str)} to {' → '.join(cand_path_str)}."
                ),
                policy="proposed-famm-rs",
            )
            _stability_records.append(record)
            candidate_result.stabilityAction = "HYSTERESIS_SWITCH_ACCEPTED"
            candidate_result.switchReason = record.reason
            return candidate_result, record
        else:
            # Candidate improvement is below threshold -> SUPPRESS SWITCH to prevent flapping!
            # We return previous active route result with an updated timestamp and explanation
            record = RouteStabilityRecord(
                step=eval_step,
                timestamp=now_ts,
                source=src_str,
                destination=dst_str,
                activeRouteBefore=prev_path_str,
                candidateRoute=cand_path_str,
                activeRouteAfter=prev_path_str,
                activeCostBefore=prev_cost,
                candidateCost=candidate_result.totalCost,
                activeCostAfter=prev_cost,
                costDifference=round(delta_cost, 6),
                relativeImprovement=round(rel_improvement, 6),
                switched=False,
                reason=(
                    f"HYSTERESIS SUPPRESSED: Candidate improves score by only {rel_improvement*100:.1f}% "
                    f"(ΔJ={delta_cost:.4f} < threshold {cfg.threshold*100:.1f}%). "
                    f"Retaining active route {' → '.join(prev_path_str)} to prevent route flapping."
                ),
                policy="proposed-famm-rs",
            )
            _stability_records.append(record)

            # Construct suppressed output based on previous active route
            prev_result = active_state.get("full_result")
            if prev_result:
                effective_res = prev_result.model_copy(deep=True)
                effective_res.totalCost = prev_cost
            else:
                effective_res = candidate_result.model_copy(deep=True)

            effective_res.stabilityAction = "HYSTERESIS_SUPPRESSED"
            effective_res.switchReason = record.reason
            return effective_res, record
