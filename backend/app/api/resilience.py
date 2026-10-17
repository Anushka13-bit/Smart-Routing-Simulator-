"""
Resilience and Research Experiment API endpoints.

Exposes:
- Policy configuration (metric weights, hysteresis thresholds)
- Route evaluation with route-stability hysteresis control
- Stability audit history
- Automated resilience experiment execution
- Critical-link vulnerability analysis
- Structured experiment data export (JSON & CSV)
"""

from __future__ import annotations

from typing import Optional
from fastapi import APIRouter, HTTPException, Query, Response

from app.algorithms.proposed_policy import run_proposed_policy
from app.models.schemas import (
    CriticalLinkAnalysisResponse,
    HysteresisConfig,
    MetricWeights,
    PolicyConfiguration,
    ResilienceExperimentReport,
    ResilienceExperimentRequest,
    RouteResult,
    RouteStabilityRecord,
    RouterId,
)
from app.services import cost_service, experiment_runner, stability_service, topology_service

router = APIRouter(prefix="/resilience", tags=["Resilience & Research"])


@router.get("/policy/config", response_model=PolicyConfiguration)
def get_policy_configuration():
    """Retrieve current FAMM-RS policy weights and hysteresis parameters."""
    return cost_service.get_policy_config()


@router.post("/policy/config", response_model=PolicyConfiguration)
def update_policy_configuration(config: PolicyConfiguration):
    """Update FAMM-RS policy weights and hysteresis thresholds."""
    try:
        updated = cost_service.update_policy_config(config)
        return updated
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to update policy configuration: {str(e)}")


@router.post("/evaluate", response_model=RouteResult)
def evaluate_resilient_route(
    source: RouterId = Query(RouterId.R1, description="Source router ID"),
    destination: RouterId = Query(RouterId.R5, description="Destination router ID"),
    enable_hysteresis: bool = Query(True, description="Enforce hysteresis route-stability control"),
    threshold_override: Optional[float] = Query(None, description="Optional hysteresis threshold override (0.0 to 1.0)"),
):
    """
    Compute FAMM route from source to destination and evaluate against currently active route
    using route-stability hysteresis rules.
    """
    links = topology_service.get_links()
    cfg = cost_service.get_policy_config()
    weights = cfg.weights

    # 1. Run multi-metric FAMM optimization
    cand_res = run_proposed_policy(
        source=source,
        destination=destination,
        links=links,
        weights=weights,
        reference_bw=cfg.referenceBandwidthMbps,
        reference_max_delay=cfg.referenceMaxDelayMs,
    )

    # 2. Apply hysteresis evaluation
    hyst_cfg = HysteresisConfig(
        enabled=enable_hysteresis,
        threshold=threshold_override if threshold_override is not None else cfg.hysteresis.threshold,
        min_absolute_improvement=cfg.hysteresis.min_absolute_improvement,
    )

    stability_service.increment_step()
    effective_result, _ = stability_service.evaluate_with_hysteresis(
        source=source,
        destination=destination,
        candidate_result=cand_res,
        links=links,
        hysteresis_override=hyst_cfg,
    )

    return effective_result


@router.get("/stability/history", response_model=list[RouteStabilityRecord])
def get_stability_history(limit: int = Query(50, ge=1, le=500)):
    """Retrieve audit log of recent route stability determinations and switch reasons."""
    return stability_service.get_stability_history(limit=limit)


@router.post("/stability/reset")
def reset_stability():
    """Reset stability state and clear audit records."""
    stability_service.reset_stability_state()
    return {"success": True, "message": "Route stability manager reset successfully."}


@router.post("/experiments/run", response_model=ResilienceExperimentReport)
def run_experiment(req: ResilienceExperimentRequest):
    """
    Execute an automated network resilience benchmark scenario.
    Compares Static Dijkstra, Adaptive FAMM without Hysteresis, and FAMM-RS with Hysteresis.
    """
    try:
        report = experiment_runner.run_resilience_experiment(req)
        return report
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Experiment runner error: {str(e)}")


@router.get("/critical-links", response_model=CriticalLinkAnalysisResponse)
def get_critical_links():
    """
    Execute simulated link removal analysis to identify network bridges,
    bottlenecks, and high-vulnerability links.
    """
    try:
        return experiment_runner.analyze_critical_links()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Critical link analysis error: {str(e)}")


@router.get("/experiments/{exp_id}/export/csv")
def export_experiment_csv(exp_id: str):
    """Download experiment step data as CSV."""
    report = experiment_runner.get_cached_report(exp_id)
    if not report:
        raise HTTPException(status_code=404, detail=f"Experiment '{exp_id}' not found in cache.")

    csv_data = experiment_runner.export_experiment_csv(report)
    return Response(
        content=csv_data,
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={exp_id}.csv"},
    )


@router.get("/experiments/{exp_id}/export/json")
def export_experiment_json(exp_id: str):
    """Download experiment report as JSON."""
    report = experiment_runner.get_cached_report(exp_id)
    if not report:
        raise HTTPException(status_code=404, detail=f"Experiment '{exp_id}' not found in cache.")

    return report
