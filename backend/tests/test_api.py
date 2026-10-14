"""
Integration tests for FastAPI endpoints using TestClient.
"""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.services import topology_service

client = TestClient(app)


@pytest.fixture(autouse=True)
def reset_network():
    topology_service.reset()


def test_health_check():
    res = client.get("/api/health")
    assert res.status_code == 200
    data = res.json()
    assert data["online"] is True
    assert "version" in data


def test_get_topology():
    res = client.get("/api/topology")
    assert res.status_code == 200
    data = res.json()
    assert "routers" in data
    assert "links" in data
    assert len(data["routers"]) == 5
    assert len(data["links"]) == 6


def test_calculate_route_endpoint():
    payload = {
        "source": "R1",
        "destination": "R5",
        "algorithm": "dijkstra",
    }
    res = client.post("/api/route", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True
    assert data["source"] == "R1"
    assert data["destination"] == "R5"
    assert len(data["path"]) >= 2
    assert "traces" in data
    assert "totalCost" in data
    # Check snake_case compatibility fields as well
    assert "total_cost" in data
    assert "hops" in data


def test_invalid_source_destination():
    payload = {
        "source": "INVALID",
        "destination": "R5",
        "algorithm": "dijkstra",
    }
    res = client.post("/api/route", json=payload)
    assert res.status_code == 422  # Pydantic validation error


def test_compare_endpoint():
    payload = {
        "source": "R1",
        "destination": "R5",
    }
    res = client.post("/api/compare", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert isinstance(data, list)
    assert len(data) == 4
    algos = [item["algorithm"] for item in data]
    assert "dijkstra" in algos
    assert "bellman-ford" in algos
    assert "distance-vector" in algos
    assert "link-state" in algos


def test_fail_and_restore_link_endpoints():
    # Fail via path parameter
    fail_res = client.post("/api/links/R1-R2/fail")
    assert fail_res.status_code == 200
    assert fail_res.json()["link"]["status"] == "failed"

    # Restore via path parameter
    restore_res = client.post("/api/links/R1-R2/restore")
    assert restore_res.status_code == 200
    assert restore_res.json()["link"]["status"] == "active"


def test_update_metrics_endpoints():
    # PUT /api/links/R1-R2/metrics
    update_res = client.put(
        "/api/links/R1-R2/metrics",
        json={"bandwidthMbps": 800, "delayMs": 12, "congestionPercent": 40},
    )
    assert update_res.status_code == 200
    link = update_res.json()["link"]
    assert link["bandwidthMbps"] == 800
    assert link["delayMs"] == 12
    assert link["congestionPercent"] == 40


def test_routing_table_endpoints():
    res1 = client.get("/api/routers/R1/routing-table")
    assert res1.status_code == 200
    data1 = res1.json()
    assert data1["routerId"] == "R1"
    assert len(data1["entries"]) == 5

    res2 = client.get("/api/routing-table/R1")
    assert res2.status_code == 200
    assert res2.json()["routerId"] == "R1"


def test_reset_endpoints():
    client.post("/api/links/R1-R2/fail")
    reset_res = client.post("/api/reset")
    assert reset_res.status_code == 200
    links = reset_res.json()["links"]
    assert all(l["status"] == "active" for l in links)


def test_explain_route_endpoint():
    res = client.get("/api/route/explain?source=R1&destination=R5&algorithm=dijkstra")
    assert res.status_code == 200
    data = res.json()
    assert data["reachable"] is True
    assert "traversed_links" in data
    assert "is_optimal" in data
