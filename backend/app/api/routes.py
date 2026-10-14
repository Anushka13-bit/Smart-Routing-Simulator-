"""
Route calculation and health endpoints.
"""

from __future__ import annotations

from typing import Any
from fastapi import APIRouter, HTTPException, Query

from app.models.schemas import CalculateRouteRequest, RouteResult, RouterId, AlgorithmType
from app.services import routing_service, topology_service

router = APIRouter(tags=["Routing"])


@router.get("/health")
def health_check():
    """Health check endpoint used by the frontend to verify backend connection."""
    return {
        "online": True,
        "message": "Backend API is connected and healthy.",
        "version": "1.0.0",
    }


@router.post("/route", response_model=RouteResult)
def calculate_route(payload: CalculateRouteRequest):
    """
    Compute optimal route between source and destination using the specified algorithm.
    """
    links = topology_service.get_links()
    try:
        result = routing_service.calculate_route(
            algorithm=payload.algorithm,
            source=payload.source,
            destination=payload.destination,
            links=links,
        )
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Routing calculation error: {str(e)}")


@router.get("/route/explain")
def explain_route(
    source: RouterId = Query(..., description="Source router ID"),
    destination: RouterId = Query(..., description="Destination router ID"),
    algorithm: AlgorithmType = Query(AlgorithmType.DIJKSTRA, description="Routing algorithm to explain"),
) -> dict[str, Any]:
    """
    Generate an in-depth educational explanation of a calculated route,
    including link penalties, total metric justification, and alternative checks.
    """
    links = topology_service.get_links()
    route = routing_service.calculate_route(
        algorithm=algorithm,
        source=source,
        destination=destination,
        links=links,
    )
    return routing_service.explain_route(route, links)
