"""
Unit tests for Bellman-Ford Algorithm.
"""

from __future__ import annotations

import pytest
from app.algorithms.bellman_ford import run_bellman_ford
from app.models.schemas import AlgorithmType, RouterId
from app.services import topology_service


@pytest.fixture(autouse=True)
def reset_network():
    topology_service.reset()


def test_bellman_ford_normal():
    links = topology_service.get_links()
    res = run_bellman_ford(RouterId.R1, RouterId.R5, links)

    assert res.success is True
    assert res.algorithm == AlgorithmType.BELLMAN_FORD
    assert res.path[0] == RouterId.R1
    assert res.path[-1] == RouterId.R5
    assert res.convergenceRounds <= 4  # |V|-1 for 5 routers
    assert res.totalCost > 0
    assert res.totalHops == len(res.path) - 1


def test_bellman_ford_source_equals_dest():
    links = topology_service.get_links()
    res = run_bellman_ford(RouterId.R3, RouterId.R3, links)

    assert res.success is True
    assert res.path == [RouterId.R3]
    assert res.totalCost == 0.0


def test_bellman_ford_unreachable():
    topology_service.fail_link("R4-R5")
    topology_service.fail_link("R3-R5")

    links = topology_service.get_links()
    res = run_bellman_ford(RouterId.R1, RouterId.R5, links)

    assert res.success is False
    assert res.path == []
    assert res.totalCost == float("inf")
