"""
Unit tests for Dijkstra's Algorithm.
"""

from __future__ import annotations

import pytest
from app.algorithms.dijkstra import run_dijkstra
from app.models.schemas import AlgorithmType, NetworkLink, RouterId
from app.services import topology_service


@pytest.fixture(autouse=True)
def reset_network():
    topology_service.reset()


def test_dijkstra_normal_r1_to_r5():
    links = topology_service.get_links()
    res = run_dijkstra(RouterId.R1, RouterId.R5, links)

    assert res.success is True
    assert res.algorithm == AlgorithmType.DIJKSTRA
    assert res.source == RouterId.R1
    assert res.destination == RouterId.R5
    assert len(res.path) >= 2
    assert res.path[0] == RouterId.R1
    assert res.path[-1] == RouterId.R5
    assert res.totalCost > 0
    assert res.totalHops == len(res.path) - 1
    assert res.executionTimeMs >= 0


def test_dijkstra_source_equals_destination():
    links = topology_service.get_links()
    res = run_dijkstra(RouterId.R2, RouterId.R2, links)

    assert res.success is True
    assert res.path == [RouterId.R2]
    assert res.totalCost == 0.0
    assert res.totalHops == 0
    assert res.links == []


def test_dijkstra_unreachable_when_partitioned():
    # Break all links connected to R5: R4-R5 and R3-R5
    topology_service.fail_link("R4-R5")
    topology_service.fail_link("R3-R5")

    links = topology_service.get_links()
    res = run_dijkstra(RouterId.R1, RouterId.R5, links)

    assert res.success is False
    assert res.path == []
    assert res.totalCost == float("inf")
    assert res.totalHops == 0
    assert "unreachable" in res.message.lower()


def test_dijkstra_cost_equals_sum_of_links():
    links = topology_service.get_links()
    res = run_dijkstra(RouterId.R1, RouterId.R5, links)

    assert res.success is True
    link_map = {l.id: l.cost for l in links}
    sum_cost = sum(link_map[lid] for lid in res.links)
    assert round(res.totalCost, 4) == round(sum_cost, 4)
