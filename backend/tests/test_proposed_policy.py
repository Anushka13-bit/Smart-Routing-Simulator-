"""
Unit tests for the proposed Failure-Aware Multi-Metric (FAMM) routing policy.
"""

from __future__ import annotations

import pytest
from app.algorithms.proposed_policy import run_proposed_policy
from app.models.schemas import MetricWeights, RouterId
from app.services import cost_service, topology_service


@pytest.fixture(autouse=True)
def reset_network():
    topology_service.reset()


def test_proposed_policy_normal_route():
    links = topology_service.get_links()
    res = run_proposed_policy(RouterId.R1, RouterId.R5, links)

    assert res.success is True
    assert res.source == RouterId.R1
    assert res.destination == RouterId.R5
    assert len(res.path) >= 2
    assert res.path[0] == RouterId.R1
    assert res.path[-1] == RouterId.R5
    assert res.totalCost > 0
    assert res.costBreakdown is not None
    assert len(res.linkBreakdowns) == len(res.links)


def test_proposed_policy_failed_link_exclusion():
    # Break R3-R5
    topology_service.fail_link("R3-R5")
    links = topology_service.get_links()

    res = run_proposed_policy(RouterId.R1, RouterId.R5, links)
    assert res.success is True
    # R3-R5 must NOT be in the selected route
    assert "R3-R5" not in res.links
    # Must failover to R1-R4-R5 bypass route
    assert RouterId.R4 in res.path


def test_proposed_policy_weight_sensitivity():
    links = topology_service.get_links()

    # Heavy delay weighting
    delay_weights = MetricWeights(w_delay=0.8, w_congestion=0.1, w_bandwidth=0.05, w_risk=0.05)
    res_delay = run_proposed_policy(RouterId.R1, RouterId.R5, links, weights=delay_weights)
    assert res_delay.success is True

    # Heavy congestion weighting
    cong_weights = MetricWeights(w_delay=0.1, w_congestion=0.8, w_bandwidth=0.05, w_risk=0.05)
    res_cong = run_proposed_policy(RouterId.R1, RouterId.R5, links, weights=cong_weights)
    assert res_cong.success is True


def test_proposed_policy_unreachable_partition():
    # Sever all paths to R5: R3-R5 and R4-R5
    topology_service.fail_link("R3-R5")
    topology_service.fail_link("R4-R5")
    links = topology_service.get_links()

    res = run_proposed_policy(RouterId.R1, RouterId.R5, links)
    assert res.success is False
    assert res.path == []
    assert "unreachable" in res.message.lower()


def test_proposed_policy_source_equals_dest():
    links = topology_service.get_links()
    res = run_proposed_policy(RouterId.R2, RouterId.R2, links)
    assert res.success is True
    assert res.path == [RouterId.R2]
    assert res.totalCost == 0.0
    assert res.totalHops == 0
