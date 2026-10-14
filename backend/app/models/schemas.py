"""
Pydantic models / schemas for the Smart Routing Simulator backend.

Every field name is intentionally aligned with the TypeScript types in
src/types/network.ts so that JSON serialisation requires zero renaming.
"""

from __future__ import annotations

from enum import Enum
from typing import Any, Optional

from pydantic import BaseModel, Field, field_validator


# ---------------------------------------------------------------------------
# Enumerations
# ---------------------------------------------------------------------------


class RouterId(str, Enum):
    R1 = "R1"
    R2 = "R2"
    R3 = "R3"
    R4 = "R4"
    R5 = "R5"


class AlgorithmType(str, Enum):
    DIJKSTRA = "dijkstra"
    BELLMAN_FORD = "bellman-ford"
    DISTANCE_VECTOR = "distance-vector"
    LINK_STATE = "link-state"


class LinkStatus(str, Enum):
    ACTIVE = "active"
    FAILED = "failed"


class RouterStatus(str, Enum):
    ACTIVE = "active"
    DEGRADED = "degraded"
    ISOLATED = "isolated"


# ---------------------------------------------------------------------------
# Router / Link topology models  (matches RouterNodeData & NetworkLink in TS)
# ---------------------------------------------------------------------------


class RouterInterface(BaseModel):
    name: str
    connectedTo: RouterId
    status: str  # "up" | "down"
    ip: str


class RouterNodeData(BaseModel):
    id: RouterId
    label: str
    ipAddress: str
    loopback: str
    status: RouterStatus
    description: str
    interfaces: list[RouterInterface]
    cpuUsage: float
    memoryUsage: float


class NetworkLink(BaseModel):
    id: str  # e.g. "R1-R2"
    source: RouterId
    target: RouterId
    cost: float
    bandwidthMbps: float
    delayMs: float
    congestionPercent: float  # 0-100
    status: LinkStatus
    failedAt: Optional[str] = None

    @field_validator("bandwidthMbps")
    @classmethod
    def bw_positive(cls, v: float) -> float:
        if v <= 0:
            raise ValueError("bandwidthMbps must be > 0")
        return v

    @field_validator("delayMs")
    @classmethod
    def delay_non_neg(cls, v: float) -> float:
        if v < 0:
            raise ValueError("delayMs must be >= 0")
        return v

    @field_validator("congestionPercent")
    @classmethod
    def congestion_range(cls, v: float) -> float:
        if not (0.0 <= v <= 100.0):
            raise ValueError("congestionPercent must be between 0 and 100")
        return v


# ---------------------------------------------------------------------------
# Topology response
# ---------------------------------------------------------------------------


class TopologyResponse(BaseModel):
    routers: list[RouterNodeData]
    links: list[NetworkLink]


# ---------------------------------------------------------------------------
# Routing-table (matches RoutingTable / RoutingTableEntry in TS)
# ---------------------------------------------------------------------------


class RoutingTableEntry(BaseModel):
    destination: RouterId
    nextHop: str  # RouterId or "DIRECT"
    metric: float
    interfaceName: str
    protocol: str


class RoutingTable(BaseModel):
    routerId: RouterId
    entries: list[RoutingTableEntry]


# ---------------------------------------------------------------------------
# Step trace (used in RouteResult.traces)
# ---------------------------------------------------------------------------


class StepTrace(BaseModel):
    step: int
    description: str
    currentRouter: Optional[RouterId] = None
    visited: list[RouterId]
    tentativeCosts: dict[RouterId, Optional[float]]
    actionType: str  # "visit" | "relax" | "update" | "converge" | "flood"


# ---------------------------------------------------------------------------
# Route result  (matches RouteResult in TS exactly)
# ---------------------------------------------------------------------------


class RouteResult(BaseModel):
    algorithm: AlgorithmType
    source: RouterId
    destination: RouterId
    path: list[RouterId]
    links: list[str]  # link IDs in order, e.g. ["R1-R3", "R3-R5"]
    totalCost: float
    totalHops: int
    totalDelayMs: float
    bottleneckBandwidthMbps: float
    executionTimeMs: float
    convergenceRounds: int
    messagesExchanged: int
    success: bool
    message: Optional[str] = None
    traces: list[StepTrace]
    timestamp: str

    # Compatibility fields for snake_case spec (Section 10)
    total_cost: Optional[float] = None
    hops: Optional[int] = None
    execution_time_ms: Optional[float] = None
    reachable: Optional[bool] = None
    path_edges: Optional[list[str]] = None
    explanation: Optional[list[str]] = None

    def model_post_init(self, __context: Any) -> None:
        if self.total_cost is None:
            self.total_cost = self.totalCost
        if self.hops is None:
            self.hops = self.totalHops
        if self.execution_time_ms is None:
            self.execution_time_ms = self.executionTimeMs
        if self.reachable is None:
            self.reachable = self.success
        if self.path_edges is None:
            self.path_edges = self.links
        if self.explanation is None:
            self.explanation = [t.description for t in self.traces]


# ---------------------------------------------------------------------------
# Algorithm comparison result  (matches AlgorithmComparisonResult in TS)
# ---------------------------------------------------------------------------


class AlgorithmComparisonResult(BaseModel):
    algorithm: AlgorithmType
    name: str
    path: list[RouterId]
    totalCost: float
    totalHops: int
    totalDelayMs: float
    executionTimeMs: float
    convergenceRounds: int
    messagesExchanged: int
    timeComplexity: str
    spaceComplexity: str
    protocolBasis: str
    keyFeature: str
    status: str  # "success" | "failed"


# ---------------------------------------------------------------------------
# Request bodies
# ---------------------------------------------------------------------------


class CalculateRouteRequest(BaseModel):
    source: RouterId
    destination: RouterId
    algorithm: AlgorithmType


class CompareRequest(BaseModel):
    source: RouterId
    destination: RouterId


class UpdateLinkMetricsRequest(BaseModel):
    """
    All fields are optional so the caller can patch only what changed.
    Validation mirrors the NetworkLink validators.
    """

    cost: Optional[float] = None
    bandwidthMbps: Optional[float] = None
    delayMs: Optional[float] = None
    congestionPercent: Optional[float] = None

    @field_validator("bandwidthMbps")
    @classmethod
    def bw_positive(cls, v: Optional[float]) -> Optional[float]:
        if v is not None and v <= 0:
            raise ValueError("bandwidthMbps must be > 0")
        return v

    @field_validator("delayMs")
    @classmethod
    def delay_non_neg(cls, v: Optional[float]) -> Optional[float]:
        if v is not None and v < 0:
            raise ValueError("delayMs must be >= 0")
        return v

    @field_validator("congestionPercent")
    @classmethod
    def congestion_range(cls, v: Optional[float]) -> Optional[float]:
        if v is not None and not (0.0 <= v <= 100.0):
            raise ValueError("congestionPercent must be between 0 and 100")
        return v


# ---------------------------------------------------------------------------
# Standard error response
# ---------------------------------------------------------------------------


class ErrorResponse(BaseModel):
    detail: str
    code: Optional[str] = None
