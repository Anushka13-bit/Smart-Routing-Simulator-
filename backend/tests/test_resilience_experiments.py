"""
Unit tests for automated resilience experiments and reproducible scenario benchmarks.
"""

from __future__ import annotations

import pytest
from app.models.schemas import ResilienceExperimentRequest, RouterId
from app.services import experiment_runner, topology_service


@pytest.fixture(autouse=True)
def reset_network():
    topology_service.reset()


def test_single_failure_experiment():
    req = ResilienceExperimentRequest(
        scenario="single_failure",
        source=RouterId.R1,
        destination=RouterId.R5,
        targetLinkId="R3-R5",
        hysteresisThreshold=0.15,
    )
    report = experiment_runner.run_resilience_experiment(req)

    assert report.scenarioName == "Single-Link Failure and Restoration"
    assert len(report.steps) == 5
    assert "dijkstra_static" in report.summaries
    assert "adaptive_no_hysteresis" in report.summaries
    assert "famm_rs_hysteresis" in report.summaries

    # Step 2 had the failure: verify failover happened across all policies
    step_2 = report.steps[1]
    assert step_2.event.action == "fail_link"
    assert step_2.policyMetrics["famm_rs_hysteresis"].reachable is True
    assert "R3-R5" not in step_2.policyMetrics["famm_rs_hysteresis"].links


def test_congestion_oscillation_experiment_hysteresis_difference():
    req = ResilienceExperimentRequest(
        scenario="congestion_oscillation",
        source=RouterId.R1,
        destination=RouterId.R5,
        hysteresisThreshold=0.25,
    )
    report = experiment_runner.run_resilience_experiment(req)

    # In oscillation, adaptive without hysteresis should have more switches than FAMM-RS with hysteresis
    switches_no_hyst = report.summaries["adaptive_no_hysteresis"].totalSwitches
    switches_with_hyst = report.summaries["famm_rs_hysteresis"].totalSwitches

    assert switches_with_hyst <= switches_no_hyst


def test_synthetic_graph_generation_and_experiment():
    nodes, links = experiment_runner.generate_synthetic_topology(num_nodes=8, seed=123)
    assert len(nodes) == 8
    assert len(links) >= 8

    req = ResilienceExperimentRequest(
        scenario="synthetic_graph",
        source=RouterId.R1,
        destination=RouterId.R5,
        topologySize=8,
        randomSeed=123,
    )
    report = experiment_runner.run_resilience_experiment(req)
    assert report.trials == 1
    assert len(report.steps) >= 3


def test_csv_export():
    req = ResilienceExperimentRequest(scenario="single_failure")
    report = experiment_runner.run_resilience_experiment(req)
    csv_str = experiment_runner.export_experiment_csv(report)

    assert "experiment_id" in csv_str
    assert "famm_rs_hysteresis" in csv_str
    assert "dijkstra_static" in csv_str
