"""
Unit tests for link failures, restoration, and parameter updates.
"""

from __future__ import annotations

import pytest
from app.algorithms.dijkstra import run_dijkstra
from app.models.schemas import LinkStatus, RouterId
from app.services import topology_service


@pytest.fixture(autouse=True)
def reset_network():
    topology_service.reset()


def test_break_and_restore_link():
    # Verify initial path
    initial_links = topology_service.get_links()
    res_initial = run_dijkstra(RouterId.R1, RouterId.R5, initial_links)
    assert res_initial.success is True

    # Break R4-R5
    failed = topology_service.fail_link("R4-R5")
    assert failed is not None
    assert failed.status == LinkStatus.FAILED

    # Recalculate route
    links_after_break = topology_service.get_links()
    res_after_break = run_dijkstra(RouterId.R1, RouterId.R5, links_after_break)
    assert res_after_break.success is True
    assert "R4-R5" not in res_after_break.links

    # Restore R4-R5
    restored = topology_service.restore_link("R4-R5")
    assert restored is not None
    assert restored.status == LinkStatus.ACTIVE

    # Recalculate route after restoration
    links_after_restore = topology_service.get_links()
    res_after_restore = run_dijkstra(RouterId.R1, RouterId.R5, links_after_restore)
    assert res_after_restore.success is True
    assert res_after_restore.totalCost == res_initial.totalCost


def test_modify_congestion_updates_cost():
    initial_link = topology_service.get_link_by_id("R1-R2")
    assert initial_link is not None
    initial_cost = initial_link.cost

    # Increase congestion from 18% to 90%
    updated = topology_service.update_link_metrics("R1-R2", congestion_percent=90.0)
    assert updated is not None
    assert updated.congestionPercent == 90.0
    assert updated.cost > initial_cost


def test_modify_bandwidth_updates_cost():
    initial_link = topology_service.get_link_by_id("R1-R2")
    assert initial_link is not None
    initial_cost = initial_link.cost

    # Reduce bandwidth from 1000 Mbps to 100 Mbps (higher penalty)
    updated = topology_service.update_link_metrics("R1-R2", bandwidth_mbps=100.0)
    assert updated is not None
    assert updated.bandwidthMbps == 100.0
    assert updated.cost > initial_cost


def test_modify_delay_updates_cost():
    initial_link = topology_service.get_link_by_id("R1-R2")
    assert initial_link is not None
    initial_cost = initial_link.cost

    # Increase delay from 5ms to 50ms (higher penalty)
    updated = topology_service.update_link_metrics("R1-R2", delay_ms=50.0)
    assert updated is not None
    assert updated.delayMs == 50.0
    assert updated.cost > initial_cost


def test_reset_restores_original_topology():
    topology_service.fail_link("R1-R2")
    topology_service.update_link_metrics("R2-R3", congestion_percent=95.0)

    # Perform reset
    routers, links = topology_service.reset()
    assert all(l.status == LinkStatus.ACTIVE for l in links)

    r1_r2 = next(l for l in links if l.id == "R1-R2")
    assert r1_r2.status == LinkStatus.ACTIVE

    r2_r3 = next(l for l in links if l.id == "R2-R3")
    assert r2_r3.congestionPercent == 12.0
