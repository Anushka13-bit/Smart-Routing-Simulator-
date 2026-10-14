"""
Comparison endpoint: POST /api/compare
"""

from __future__ import annotations

from fastapi import APIRouter, HTTPException

from app.models.schemas import AlgorithmComparisonResult, CompareRequest
from app.services import routing_service, topology_service

router = APIRouter(tags=["Comparison"])


@router.post("/compare", response_model=list[AlgorithmComparisonResult])
def compare_all(payload: CompareRequest):
    """
    Execute all 4 algorithms (Dijkstra, Bellman-Ford, Distance Vector, Link State)
    on the identical active topology snapshot and return comprehensive comparison metrics.
    """
    links = topology_service.get_links()
    try:
        results = routing_service.compare_algorithms(
            source=payload.source,
            destination=payload.destination,
            links=links,
        )
        return results
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Comparison execution error: {str(e)}")
