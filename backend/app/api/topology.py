"""
Topology endpoints: GET /api/topology, POST /api/reset, POST /api/topology/reset
"""

from __future__ import annotations

from fastapi import APIRouter
from app.models.schemas import TopologyResponse
from app.services import topology_service

router = APIRouter(tags=["Topology"])


@router.get("/topology", response_model=TopologyResponse)
def get_topology():
    """Return the current topology: routers, links, link parameters, statuses, and calculated costs."""
    routers = topology_service.get_routers()
    links = topology_service.get_links()
    return TopologyResponse(routers=routers, links=links)


@router.post("/reset", response_model=TopologyResponse)
def reset_topology_frontend_alias():
    """Reset network topology to default settings (frontend contract)."""
    routers, links = topology_service.reset()
    return TopologyResponse(routers=routers, links=links)


@router.post("/topology/reset", response_model=TopologyResponse)
def reset_topology_spec_alias():
    """Reset network topology to default settings (spec contract)."""
    routers, links = topology_service.reset()
    return TopologyResponse(routers=routers, links=links)
