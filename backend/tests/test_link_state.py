"""
Unit tests for Link State Routing Protocol.
"""

from __future__ import annotations

import pytest
from app.algorithms.link_state import run_link_state
from app.models.schemas import AlgorithmType, RouterId
from app.services import topology_service


@pytest.fixture(autouse=True)
def reset_network():
    topology_service.reset()


def test_link_state_normal():
    links = topology_service.get_links()
    res = run_link_state(RouterId.R1, RouterId.R5, links)

    assert res.success is True
    assert res.algorithm == AlgorithmType.LINK_STATE
    assert res.path[0] == RouterId.R1
    assert res.path[-1] == RouterId.R5
    assert len(res.traces) >= 3  # Hello + LSA Flooding + SPF traces
    assert res.traces[0].actionType == "visit"
    assert res.traces[1].actionType == "flood"
    assert res.messagesExchanged > 0


def test_link_state_uses_current_active_topology():
    # Break R1-R3 and R1-R4
    topology_service.fail_link("R1-R3")
    topology_service.fail_link("R1-R4")

    links = topology_service.get_links()
    res = run_link_state(RouterId.R1, RouterId.R5, links)

    # Only remaining path from R1 is R1 -> R2 -> R3 -> R5
    assert res.success is True
    assert res.path[1] == RouterId.R2
    assert "R1-R3" not in res.links
    assert "R1-R4" not in res.links
