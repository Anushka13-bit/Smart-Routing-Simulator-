"""
Unit tests for Distance Vector Algorithm.
"""

from __future__ import annotations

import pytest
from app.algorithms.distance_vector import run_distance_vector
from app.models.schemas import AlgorithmType, RouterId
from app.services import topology_service


@pytest.fixture(autouse=True)
def reset_network():
    topology_service.reset()


def test_distance_vector_normal_convergence():
    links = topology_service.get_links()
    res = run_distance_vector(RouterId.R1, RouterId.R5, links)

    assert res.success is True
    assert res.algorithm == AlgorithmType.DISTANCE_VECTOR
    assert res.path[0] == RouterId.R1
    assert res.path[-1] == RouterId.R5
    assert res.convergenceRounds > 0
    assert res.messagesExchanged > 0
    assert res.totalCost > 0
    assert "converged" in res.message.lower()


def test_distance_vector_source_equals_dest():
    links = topology_service.get_links()
    res = run_distance_vector(RouterId.R1, RouterId.R1, links)

    assert res.success is True
    assert res.path == [RouterId.R1]
    assert res.totalCost == 0.0


def test_distance_vector_unreachable():
    topology_service.fail_link("R4-R5")
    topology_service.fail_link("R3-R5")

    links = topology_service.get_links()
    res = run_distance_vector(RouterId.R1, RouterId.R5, links)

    assert res.success is False
    assert res.path == []
    assert res.totalCost == float("inf")
