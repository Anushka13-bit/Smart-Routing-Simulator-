"""
Cost calculation service.

All metrics are *simulated* — they are not collected from Cisco Packet Tracer
or any physical device.

Formula (normalised, dimensionless, range ≈ 0–1):
    bandwidth_penalty  = 1 - (bw / MAX_BW)
    delay_penalty      = delay / MAX_DELAY
    congestion_penalty = congestion / 100

    link_cost = 0.4 * bandwidth_penalty
              + 0.3 * delay_penalty
              + 0.3 * congestion_penalty

Weights and normalization maxima are configurable via environment variables
COST_WEIGHT_BW, COST_WEIGHT_DELAY, COST_WEIGHT_CONG,
COST_MAX_BW_MBPS, COST_MAX_DELAY_MS.

The formula is applied ONCE when a link is created or updated and stored
as the link's ``cost`` field.  All routing algorithms consume that stored
value, guaranteeing consistent, deterministic normalisation across every
algorithm within a single comparison run.
"""

from __future__ import annotations

import os


# ---------------------------------------------------------------------------
# Configurable weights and normalisation constants
# ---------------------------------------------------------------------------

WEIGHT_BW: float = float(os.getenv("COST_WEIGHT_BW", "0.4"))
WEIGHT_DELAY: float = float(os.getenv("COST_WEIGHT_DELAY", "0.3"))
WEIGHT_CONG: float = float(os.getenv("COST_WEIGHT_CONG", "0.3"))

# Guard against division by zero in normalisation
MAX_BW_MBPS: float = max(float(os.getenv("COST_MAX_BW_MBPS", "1000")), 1.0)
MAX_DELAY_MS: float = max(float(os.getenv("COST_MAX_DELAY_MS", "100")), 1.0)


def calculate_cost(
    bandwidth_mbps: float,
    delay_ms: float,
    congestion_percent: float,
) -> float:
    """Return the normalised link cost (a float in the range [0, 1]).

    Parameters
    ----------
    bandwidth_mbps:
        Link bandwidth in Mbps.  Must be > 0.
    delay_ms:
        One-way propagation delay in milliseconds.  Must be >= 0.
    congestion_percent:
        Current congestion as a percentage (0–100).

    Returns
    -------
    float
        The dimensionless link cost, rounded to six decimal places.
    """
    # Normalise each metric to [0, 1]
    bandwidth_penalty: float = 1.0 - min(bandwidth_mbps / MAX_BW_MBPS, 1.0)
    delay_penalty: float = min(delay_ms / MAX_DELAY_MS, 1.0)
    congestion_penalty: float = congestion_percent / 100.0

    cost = (
        WEIGHT_BW * bandwidth_penalty
        + WEIGHT_DELAY * delay_penalty
        + WEIGHT_CONG * congestion_penalty
    )

    return round(cost, 6)


def cost_breakdown(
    bandwidth_mbps: float,
    delay_ms: float,
    congestion_percent: float,
) -> dict:
    """Return a detailed breakdown of each cost component.

    Useful for the frontend's explanation panel.
    """
    bw_pen = 1.0 - min(bandwidth_mbps / MAX_BW_MBPS, 1.0)
    dl_pen = min(delay_ms / MAX_DELAY_MS, 1.0)
    cg_pen = congestion_percent / 100.0

    return {
        "bandwidth_penalty": round(bw_pen, 6),
        "delay_penalty": round(dl_pen, 6),
        "congestion_penalty": round(cg_pen, 6),
        "weight_bw": WEIGHT_BW,
        "weight_delay": WEIGHT_DELAY,
        "weight_congestion": WEIGHT_CONG,
        "total_cost": round(
            WEIGHT_BW * bw_pen + WEIGHT_DELAY * dl_pen + WEIGHT_CONG * cg_pen, 6
        ),
    }
