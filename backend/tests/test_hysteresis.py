"""
Unit tests for route stability and hysteresis switching mechanism.
"""

from __future__ import annotations

import pytest
from app.algorithms.proposed_policy import run_proposed_policy
from app.models.schemas import HysteresisConfig, RouterId
from app.services import stability_service, topology_service, cost_service


@pytest.fixture(autouse=True)
def reset_state():
    topology_service.reset()
    stability_service.reset_stability_state()


def test_initial_route_establishment():
    links = topology_service.get_links()
    cand = run_proposed_policy(RouterId.R1, RouterId.R5, links)
    eff, record = stability_service.evaluate_with_hysteresis(
        RouterId.R1, RouterId.R5, cand, links
    )

    assert record.switched is True
    assert "Initial route" in record.reason
    assert eff.path == cand.path


def test_emergency_failover_on_link_sever():
    links = topology_service.get_links()
    # Step 1: establish initial route
    cand_1 = run_proposed_policy(RouterId.R1, RouterId.R5, links)
    stability_service.evaluate_with_hysteresis(RouterId.R1, RouterId.R5, cand_1, links)
    first_path = cand_1.path

    # Step 2: cut R3-R5
    topology_service.fail_link("R3-R5")
    updated_links = topology_service.get_links()

    cand_2 = run_proposed_policy(RouterId.R1, RouterId.R5, updated_links)
    assert "R3-R5" not in cand_2.links

    # Evaluate stability: must trigger immediate emergency failover
    eff, record = stability_service.evaluate_with_hysteresis(
        RouterId.R1, RouterId.R5, cand_2, updated_links
    )
    assert record.switched is True
    assert "EMERGENCY FAILOVER" in record.reason
    # R5 must still be reachable via R4 bypass
    eff_path_strs = [p.value if hasattr(p, "value") else str(p) for p in eff.path]
    assert "R4" in eff_path_strs


def test_hysteresis_dampening_prevents_flapping():
    links = topology_service.get_links()

    # Step 1: Initial route with baseline weights
    cand_1 = run_proposed_policy(RouterId.R1, RouterId.R5, links)
    eff_1, _ = stability_service.evaluate_with_hysteresis(
        RouterId.R1, RouterId.R5, cand_1, links,
        hysteresis_override=HysteresisConfig(enabled=True, threshold=0.20, min_absolute_improvement=0.01),
    )

    # Step 2: Make the R1-R4-R5 path only very slightly cheaper than R1-R3-R5:
    # Reduce R1-R4 congestion from 8% to 4% (small delta) - candidate remains the same if flapping
    # Actually force the candidate to be slightly cheaper via metric manipulation
    # Dramatically reduce the bypass path cost
    topology_service.update_link_metrics("R1-R4", congestion_percent=2.0, delay_ms=2.0)
    topology_service.update_link_metrics("R4-R5", congestion_percent=2.0, delay_ms=2.0)
    # But also make the primary path slightly cheaper so the delta is small
    topology_service.update_link_metrics("R1-R3", congestion_percent=20.0)
    topology_service.update_link_metrics("R3-R5", congestion_percent=18.0)
    updated_links = topology_service.get_links()

    cand_2 = run_proposed_policy(RouterId.R1, RouterId.R5, updated_links)
    eff_2, record_2 = stability_service.evaluate_with_hysteresis(
        RouterId.R1, RouterId.R5, cand_2, updated_links,
        hysteresis_override=HysteresisConfig(enabled=True, threshold=0.25, min_absolute_improvement=0.08),
    )

    # Must remain stable (either "optimal" if same path, or suppressed if candidate is a diff cheaper path below threshold)
    assert record_2.switched is False
    # Reason should be one of the retention reasons
    assert any(phrase in record_2.reason for phrase in [
        "HYSTERESIS SUPPRESSED",
        "remains optimal",
        "lower or equal",
    ])


def test_disabled_hysteresis_switches_on_any_improvement():
    links = topology_service.get_links()

    cand_1 = run_proposed_policy(RouterId.R1, RouterId.R5, links)
    stability_service.evaluate_with_hysteresis(RouterId.R1, RouterId.R5, cand_1, links)

    # Make R1-R4-R5 MUCH cheaper
    topology_service.update_link_metrics("R1-R4", delay_ms=1.0, congestion_percent=1.0, bandwidth_mbps=1000.0)
    topology_service.update_link_metrics("R4-R5", delay_ms=1.0, congestion_percent=1.0, bandwidth_mbps=1000.0)
    # Make R1-R3 expensive
    topology_service.update_link_metrics("R1-R3", congestion_percent=95.0, delay_ms=90.0)
    updated_links = topology_service.get_links()

    cand_2 = run_proposed_policy(RouterId.R1, RouterId.R5, updated_links)

    # Evaluate with hysteresis disabled
    eff_2, record_2 = stability_service.evaluate_with_hysteresis(
        RouterId.R1, RouterId.R5, cand_2, updated_links,
        hysteresis_override=HysteresisConfig(enabled=False, threshold=0.0),
    )

    assert record_2.switched is True
    assert "Hysteresis disabled" in record_2.reason
