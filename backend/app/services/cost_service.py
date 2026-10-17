"""
Cost calculation service supporting both the baseline 3-metric model and
the extended 4-metric Failure-Aware Multi-Metric (FAMM) cost formulation.

All metrics are *simulated* — they are not collected from Cisco Packet Tracer
or physical hardware devices.

Formula (dimensionless, normalized, range [0, 1]):
    normalized_delay(e)              = min(delay_ms / MAX_DELAY_MS, 1.0)
    normalized_congestion(e)         = min(max(congestion_percent / 100.0, 0.0), 1.0)
    normalized_bandwidth_penalty(e)  = 1.0 - min(bandwidth_mbps / MAX_BW_MBPS, 1.0)
    normalized_failure_risk(e)       = min(max(simulated_failure_risk, 0.0), 1.0)

    J(e) = w_delay      * normalized_delay(e)
         + w_congestion * normalized_congestion(e)
         + w_bandwidth  * normalized_bandwidth_penalty(e)
         + w_risk       * normalized_failure_risk(e)

where all weights are non-negative and sum to 1.0.
"""

from __future__ import annotations

import os
import threading
from typing import Optional

from app.models.schemas import MetricWeights, PolicyConfiguration

_lock = threading.Lock()

# ---------------------------------------------------------------------------
# Default weights and normalisation constants (from environment or defaults)
# ---------------------------------------------------------------------------

DEFAULT_WEIGHT_BW: float = float(os.getenv("COST_WEIGHT_BW", "0.25"))
DEFAULT_WEIGHT_DELAY: float = float(os.getenv("COST_WEIGHT_DELAY", "0.30"))
DEFAULT_WEIGHT_CONG: float = float(os.getenv("COST_WEIGHT_CONG", "0.30"))
DEFAULT_WEIGHT_RISK: float = float(os.getenv("COST_WEIGHT_RISK", "0.15"))

# Baseline fallback (legacy 3-metric backward-compatible weights)
LEGACY_WEIGHT_BW: float = 0.4
LEGACY_WEIGHT_DELAY: float = 0.3
LEGACY_WEIGHT_CONG: float = 0.3

MAX_BW_MBPS: float = max(float(os.getenv("COST_MAX_BW_MBPS", "1000")), 1.0)
MAX_DELAY_MS: float = max(float(os.getenv("COST_MAX_DELAY_MS", "100")), 1.0)

# Global policy configuration state
_current_policy_config = PolicyConfiguration(
    weights=MetricWeights(
        w_delay=DEFAULT_WEIGHT_DELAY,
        w_congestion=DEFAULT_WEIGHT_CONG,
        w_bandwidth=DEFAULT_WEIGHT_BW,
        w_risk=DEFAULT_WEIGHT_RISK,
    ).normalized(),
    referenceBandwidthMbps=MAX_BW_MBPS,
    referenceMaxDelayMs=MAX_DELAY_MS,
)


def get_policy_config() -> PolicyConfiguration:
    """Return a deep copy of the current policy configuration."""
    with _lock:
        return _current_policy_config.model_copy(deep=True)


def update_policy_config(config: PolicyConfiguration) -> PolicyConfiguration:
    """Update the global policy configuration."""
    global _current_policy_config
    with _lock:
        norm_weights = config.weights.normalized()
        _current_policy_config = PolicyConfiguration(
            weights=norm_weights,
            hysteresis=config.hysteresis.model_copy(deep=True),
            referenceBandwidthMbps=max(config.referenceBandwidthMbps, 1.0),
            referenceMaxDelayMs=max(config.referenceMaxDelayMs, 1.0),
        )
        return _current_policy_config.model_copy(deep=True)


def calculate_cost(
    bandwidth_mbps: float,
    delay_ms: float,
    congestion_percent: float,
    simulated_failure_risk: float = 0.0,
    weights: Optional[MetricWeights] = None,
    reference_bw: Optional[float] = None,
    reference_max_delay: Optional[float] = None,
) -> float:
    """Return the normalised link cost (a float in the range [0, 1]).

    Parameters
    ----------
    bandwidth_mbps:
        Link bandwidth in Mbps. Must be > 0.
    delay_ms:
        One-way propagation delay in milliseconds. Must be >= 0.
    congestion_percent:
        Current congestion as a percentage (0–100).
    simulated_failure_risk:
        Simulated failure risk estimate (0.0 to 1.0).
    weights:
        Optional MetricWeights. If None and simulated_failure_risk is 0,
        uses current global policy weights.
    reference_bw:
        Reference bandwidth for penalty normalization (default 1000 Mbps).
    reference_max_delay:
        Reference maximum delay for delay normalization (default 100 ms).
    """
    ref_bw = reference_bw or MAX_BW_MBPS
    ref_delay = reference_max_delay or MAX_DELAY_MS

    bw_penalty = 1.0 - min(max(bandwidth_mbps, 0.0) / ref_bw, 1.0)
    delay_penalty = min(max(delay_ms, 0.0) / ref_delay, 1.0)
    congestion_penalty = min(max(congestion_percent / 100.0, 0.0), 1.0)
    risk_penalty = min(max(simulated_failure_risk, 0.0), 1.0)

    if weights is not None:
        w = weights.normalized()
    else:
        with _lock:
            w = _current_policy_config.weights

    cost = (
        w.w_bandwidth * bw_penalty
        + w.w_delay * delay_penalty
        + w.w_congestion * congestion_penalty
        + w.w_risk * risk_penalty
    )

    return round(cost, 6)


def cost_breakdown(
    bandwidth_mbps: float,
    delay_ms: float,
    congestion_percent: float,
    simulated_failure_risk: float = 0.0,
    weights: Optional[MetricWeights] = None,
    reference_bw: Optional[float] = None,
    reference_max_delay: Optional[float] = None,
) -> dict:
    """Return a detailed breakdown of each cost component and metric weights."""
    ref_bw = reference_bw or MAX_BW_MBPS
    ref_delay = reference_max_delay or MAX_DELAY_MS

    bw_penalty = 1.0 - min(max(bandwidth_mbps, 0.0) / ref_bw, 1.0)
    delay_penalty = min(max(delay_ms, 0.0) / ref_delay, 1.0)
    congestion_penalty = min(max(congestion_percent / 100.0, 0.0), 1.0)
    risk_penalty = min(max(simulated_failure_risk, 0.0), 1.0)

    if weights is not None:
        w = weights.normalized()
    else:
        with _lock:
            w = _current_policy_config.weights

    total_cost = (
        w.w_bandwidth * bw_penalty
        + w.w_delay * delay_penalty
        + w.w_congestion * congestion_penalty
        + w.w_risk * risk_penalty
    )

    return {
        "bandwidth_penalty": round(bw_penalty, 6),
        "delay_penalty": round(delay_penalty, 6),
        "congestion_penalty": round(congestion_penalty, 6),
        "risk_penalty": round(risk_penalty, 6),
        "weight_bw": round(w.w_bandwidth, 4),
        "weight_delay": round(w.w_delay, 4),
        "weight_congestion": round(w.w_congestion, 4),
        "weight_risk": round(w.w_risk, 4),
        "total_cost": round(total_cost, 6),
    }
