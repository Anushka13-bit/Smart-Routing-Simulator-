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
    simulatedFailureRisk: float = 0.0  # 0.0 to 1.0 simulated failure risk estimate

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

    @field_validator("simulatedFailureRisk")
    @classmethod
    def risk_range(cls, v: float) -> float:
        if not (0.0 <= v <= 1.0):
            raise ValueError("simulatedFailureRisk must be between 0.0 and 1.0")
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
    algorithm: AlgorithmType | str
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

    # Research & Stability Extensions
    costBreakdown: Optional[dict[str, Any]] = None
    linkBreakdowns: Optional[list[dict[str, Any]]] = None
    stabilityAction: Optional[str] = None
    switchReason: Optional[str] = None
    alternativeRoutes: Optional[list[dict[str, Any]]] = None

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
    simulatedFailureRisk: Optional[float] = None

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

    @field_validator("simulatedFailureRisk")
    @classmethod
    def risk_range(cls, v: Optional[float]) -> Optional[float]:
        if v is not None and not (0.0 <= v <= 1.0):
            raise ValueError("simulatedFailureRisk must be between 0.0 and 1.0")
        return v


# ---------------------------------------------------------------------------
# Research & Resilience Policy Schemas (FAMM-RS)
# ---------------------------------------------------------------------------


class MetricWeights(BaseModel):
    w_delay: float = Field(default=0.3, ge=0.0, le=1.0, description="Weight for normalized propagation delay")
    w_congestion: float = Field(default=0.3, ge=0.0, le=1.0, description="Weight for congestion penalty")
    w_bandwidth: float = Field(default=0.25, ge=0.0, le=1.0, description="Weight for bandwidth penalty")
    w_risk: float = Field(default=0.15, ge=0.0, le=1.0, description="Weight for simulated failure risk")

    def normalized(self) -> "MetricWeights":
        """Return a copy where all weights sum exactly to 1.0."""
        total = self.w_delay + self.w_congestion + self.w_bandwidth + self.w_risk
        if total <= 0:
            return MetricWeights(w_delay=0.3, w_congestion=0.3, w_bandwidth=0.25, w_risk=0.15)
        return MetricWeights(
            w_delay=round(self.w_delay / total, 6),
            w_congestion=round(self.w_congestion / total, 6),
            w_bandwidth=round(self.w_bandwidth / total, 6),
            w_risk=round(self.w_risk / total, 6),
        )


class HysteresisConfig(BaseModel):
    enabled: bool = True
    threshold: float = Field(
        default=0.15,
        ge=0.0,
        le=1.0,
        description="Minimum relative score improvement required: (J_active - J_cand) / J_active >= threshold",
    )
    min_absolute_improvement: float = Field(
        default=0.02,
        ge=0.0,
        description="Minimum absolute score improvement required: J_active - J_cand >= min_absolute_improvement",
    )


class PolicyConfiguration(BaseModel):
    weights: MetricWeights = Field(default_factory=MetricWeights)
    hysteresis: HysteresisConfig = Field(default_factory=HysteresisConfig)
    referenceBandwidthMbps: float = 1000.0
    referenceMaxDelayMs: float = 100.0


class RouteStabilityRecord(BaseModel):
    step: int
    timestamp: str
    source: str
    destination: str
    activeRouteBefore: list[str]
    candidateRoute: list[str]
    activeRouteAfter: list[str]
    activeCostBefore: Optional[float] = None
    candidateCost: Optional[float] = None
    activeCostAfter: Optional[float] = None
    costDifference: float = 0.0
    relativeImprovement: float = 0.0
    switched: bool
    reason: str
    policy: str = "proposed-famm-rs"


class ScenarioEvent(BaseModel):
    step: int
    action: str  # "fail_link" | "restore_link" | "set_congestion" | "set_delay" | "set_risk" | "none"
    targetLinkId: Optional[str] = None
    value: Optional[float] = None
    description: str


class PolicyStepMetric(BaseModel):
    policy: str
    reachable: bool
    path: list[str]
    links: list[str]
    totalCost: float
    totalHops: int
    totalDelayMs: float
    bottleneckBandwidthMbps: float
    computationTimeMs: float
    switched: bool
    switchReason: Optional[str] = None


class ExperimentStepResult(BaseModel):
    step: int
    event: ScenarioEvent
    networkStateSummary: str
    policyMetrics: dict[str, PolicyStepMetric]


class PolicyOverallSummary(BaseModel):
    policy: str
    reachabilityPercent: float
    averageCost: float
    averageDelayMs: float
    totalSwitches: int
    averageComputationTimeMs: float
    costInflationVersusOptimal: float
    stabilityScore: float


class ResilienceExperimentRequest(BaseModel):
    scenario: str = "single_failure"  # "single_failure" | "double_failure" | "congestion_oscillation" | "link_restoration" | "network_partition" | "synthetic_graph"
    source: RouterId = RouterId.R1
    destination: RouterId = RouterId.R5
    trials: int = 1
    randomSeed: Optional[int] = 42
    hysteresisThreshold: float = 0.15
    weights: Optional[MetricWeights] = None
    targetLinkId: Optional[str] = "R3-R5"
    secondTargetLinkId: Optional[str] = "R1-R3"
    topologySize: Optional[int] = 5


class ResilienceExperimentReport(BaseModel):
    experimentId: str
    scenarioName: str
    description: str
    source: str
    destination: str
    randomSeed: Optional[int] = None
    trials: int = 1
    steps: list[ExperimentStepResult]
    summaries: dict[str, PolicyOverallSummary]
    criticalLinks: list[str] = []
    timestamp: str


class CriticalLinkItem(BaseModel):
    linkId: str
    source: str
    target: str
    currentStatus: str
    disconnectsNetwork: bool
    reachabilityRatio: float
    costInflationFactor: float
    criticalityScore: float
    classification: str


class CriticalLinkAnalysisResponse(BaseModel):
    analyzedAt: str
    totalLinks: int
    criticalLinks: list[CriticalLinkItem]
    recommendation: str


# ---------------------------------------------------------------------------
# Standard error response
# ---------------------------------------------------------------------------


class ErrorResponse(BaseModel):
    detail: str
    code: Optional[str] = None
