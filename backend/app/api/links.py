"""
Link failure, restoration, and parameter update endpoints.
Supports both frontend routes (/links/{linkId}/...) and spec routes (/links/fail, /links/restore, PATCH /links/{link_id}).
"""

from __future__ import annotations

from typing import Optional
from pydantic import BaseModel
from fastapi import APIRouter, HTTPException, Path

from app.models.schemas import NetworkLink, RouterId, UpdateLinkMetricsRequest
from app.services import topology_service
from app.utils.graph_utils import find_link_id

router = APIRouter(prefix="/links", tags=["Links"])


class LinkToggleRequest(BaseModel):
    link_id: Optional[str] = None
    linkId: Optional[str] = None
    source: Optional[RouterId] = None
    target: Optional[RouterId] = None


class LinkActionResponse(BaseModel):
    success: bool
    link: NetworkLink


def _resolve_link_id(req: LinkToggleRequest) -> str:
    target_id = req.link_id or req.linkId
    if not target_id and req.source and req.target:
        all_links = topology_service.get_links()
        target_id = find_link_id(req.source, req.target, all_links)
    if not target_id:
        raise HTTPException(status_code=400, detail="Must provide link_id/linkId or source and target endpoints.")
    return target_id


# ---------------------------------------------------------------------------
# 1. Fail Link
# ---------------------------------------------------------------------------


@router.post("/{link_id}/fail", response_model=LinkActionResponse)
def fail_link_by_path(link_id: str = Path(..., description="Link identifier e.g. R1-R2")):
    """Fail a link by path parameter (frontend contract)."""
    updated = topology_service.fail_link(link_id)
    if not updated:
        raise HTTPException(status_code=404, detail=f"Link '{link_id}' not found.")
    return LinkActionResponse(success=True, link=updated)


@router.post("/fail", response_model=LinkActionResponse)
def fail_link_by_body(req: LinkToggleRequest):
    """Fail a link by JSON body with link_id or endpoints (spec contract)."""
    link_id = _resolve_link_id(req)
    updated = topology_service.fail_link(link_id)
    if not updated:
        raise HTTPException(status_code=404, detail=f"Link '{link_id}' not found.")
    return LinkActionResponse(success=True, link=updated)


# ---------------------------------------------------------------------------
# 2. Restore Link
# ---------------------------------------------------------------------------


@router.post("/{link_id}/restore", response_model=LinkActionResponse)
def restore_link_by_path(link_id: str = Path(..., description="Link identifier e.g. R1-R2")):
    """Restore a broken link by path parameter (frontend contract)."""
    updated = topology_service.restore_link(link_id)
    if not updated:
        raise HTTPException(status_code=404, detail=f"Link '{link_id}' not found.")
    return LinkActionResponse(success=True, link=updated)


@router.post("/restore", response_model=LinkActionResponse)
def restore_link_by_body(req: LinkToggleRequest):
    """Restore a broken link by JSON body with link_id or endpoints (spec contract)."""
    link_id = _resolve_link_id(req)
    updated = topology_service.restore_link(link_id)
    if not updated:
        raise HTTPException(status_code=404, detail=f"Link '{link_id}' not found.")
    return LinkActionResponse(success=True, link=updated)


# ---------------------------------------------------------------------------
# 3. Update Link Metrics
# ---------------------------------------------------------------------------


@router.put("/{link_id}/metrics", response_model=LinkActionResponse)
def update_metrics_put(
    link_id: str,
    updates: UpdateLinkMetricsRequest,
):
    """Update link metrics (bandwidth, delay, congestion, simulated risk) via PUT (frontend contract)."""
    updated = topology_service.update_link_metrics(
        link_id=link_id,
        cost=updates.cost,
        bandwidth_mbps=updates.bandwidthMbps,
        delay_ms=updates.delayMs,
        congestion_percent=updates.congestionPercent,
        simulated_failure_risk=updates.simulatedFailureRisk,
    )
    if not updated:
        raise HTTPException(status_code=404, detail=f"Link '{link_id}' not found.")
    return LinkActionResponse(success=True, link=updated)


@router.patch("/{link_id}", response_model=LinkActionResponse)
def update_metrics_patch(
    link_id: str,
    updates: UpdateLinkMetricsRequest,
):
    """Update link metrics via PATCH (spec contract)."""
    updated = topology_service.update_link_metrics(
        link_id=link_id,
        cost=updates.cost,
        bandwidth_mbps=updates.bandwidthMbps,
        delay_ms=updates.delayMs,
        congestion_percent=updates.congestionPercent,
        simulated_failure_risk=updates.simulatedFailureRisk,
    )
    if not updated:
        raise HTTPException(status_code=404, detail=f"Link '{link_id}' not found.")
    return LinkActionResponse(success=True, link=updated)
