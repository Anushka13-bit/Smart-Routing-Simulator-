"""
Routing table endpoints:
- GET /api/routers/{routerId}/routing-table (frontend contract)
- GET /api/routing-table/{router_id} (spec contract)
"""

from __future__ import annotations

from fastapi import APIRouter, HTTPException

from app.models.schemas import RouterId, RoutingTable
from app.services import routing_service, topology_service

router = APIRouter(tags=["Routing Tables"])


@router.get("/routers/{router_id}/routing-table", response_model=RoutingTable)
def get_routing_table_frontend(router_id: RouterId):
    """Return computed forwarding table for the specified router (frontend path)."""
    links = topology_service.get_links()
    routers = topology_service.get_routers()
    return routing_service.generate_routing_table(router_id, links, routers)


@router.get("/routing-table/{router_id}", response_model=RoutingTable)
def get_routing_table_spec(router_id: RouterId):
    """Return computed forwarding table for the specified router (spec path)."""
    links = topology_service.get_links()
    routers = topology_service.get_routers()
    return routing_service.generate_routing_table(router_id, links, routers)
