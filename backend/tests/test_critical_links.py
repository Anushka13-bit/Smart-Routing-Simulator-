"""
Unit tests for critical-link analysis and API endpoints.
"""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.services import experiment_runner, topology_service

client = TestClient(app)


@pytest.fixture(autouse=True)
def reset_network():
    topology_service.reset()


def test_critical_links_analysis():
    links = topology_service.get_links()
    res = experiment_runner.analyze_critical_links(links)

    assert res.totalLinks == len(links)
    assert len(res.criticalLinks) == len(links)
    # Check that critical links are sorted descending by criticality score
    scores = [item.criticalityScore for item in res.criticalLinks]
    assert scores == sorted(scores, reverse=True)
    assert len(res.recommendation) > 10


def test_get_policy_config_api():
    res = client.get("/api/resilience/policy/config")
    assert res.status_code == 200
    data = res.json()
    assert "weights" in data
    assert "hysteresis" in data
    assert "referenceBandwidthMbps" in data


def test_evaluate_resilient_route_api():
    res = client.post("/api/resilience/evaluate?source=R1&destination=R5&enable_hysteresis=true")
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True
    assert data["source"] == "R1"
    assert data["destination"] == "R5"
    assert "stabilityAction" in data


def test_run_experiment_api():
    payload = {
        "scenario": "single_failure",
        "source": "R1",
        "destination": "R5",
        "targetLinkId": "R3-R5",
    }
    res = client.post("/api/resilience/experiments/run", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert "experimentId" in data
    assert len(data["steps"]) == 5
    assert "summaries" in data

    # Test export endpoints
    exp_id = data["experimentId"]
    res_csv = client.get(f"/api/resilience/experiments/{exp_id}/export/csv")
    assert res_csv.status_code == 200
    assert "text/csv" in res_csv.headers["content-type"]

    res_json = client.get(f"/api/resilience/experiments/{exp_id}/export/json")
    assert res_json.status_code == 200


def test_critical_links_api():
    res = client.get("/api/resilience/critical-links")
    assert res.status_code == 200
    data = res.json()
    assert "criticalLinks" in data
    assert len(data["criticalLinks"]) > 0
