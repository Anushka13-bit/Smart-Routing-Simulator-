// src/types/network.ts

export type RouterId = 'R1' | 'R2' | 'R3' | 'R4' | 'R5';

export type RoutingAlgorithmType = 'dijkstra' | 'bellman-ford' | 'distance-vector' | 'link-state' | 'proposed-famm-rs';

export interface RouterNodeData {
  id: RouterId;
  label: string;
  ipAddress: string;
  loopback: string;
  status: 'active' | 'degraded' | 'isolated';
  description: string;
  interfaces: {
    name: string;
    connectedTo: RouterId;
    status: 'up' | 'down';
    ip: string;
  }[];
  cpuUsage: number;
  memoryUsage: number;
}

export interface NetworkLink {
  id: string; // e.g., 'R1-R2'
  source: RouterId;
  target: RouterId;
  cost: number;
  bandwidthMbps: number;
  delayMs: number;
  congestionPercent: number; // 0 - 100
  status: 'active' | 'failed';
  failedAt?: string;
  simulatedFailureRisk?: number; // 0.0 to 1.0 (simulated risk estimate)
}

export interface RoutingTableEntry {
  destination: RouterId;
  nextHop: RouterId | 'DIRECT';
  metric: number;
  interfaceName: string;
  protocol: string;
}

export interface RoutingTable {
  routerId: RouterId;
  entries: RoutingTableEntry[];
}

export interface StepTrace {
  step: number;
  description: string;
  currentRouter?: RouterId;
  visited: RouterId[];
  tentativeCosts: Record<RouterId, number | null>;
  actionType: 'visit' | 'relax' | 'update' | 'converge' | 'flood';
}

export interface RouteResult {
  algorithm: RoutingAlgorithmType;
  source: RouterId;
  destination: RouterId;
  path: RouterId[];
  links: string[]; // link IDs in order e.g. ['R1-R3', 'R3-R5']
  totalCost: number;
  totalHops: number;
  totalDelayMs: number;
  bottleneckBandwidthMbps: number;
  executionTimeMs: number;
  convergenceRounds: number;
  messagesExchanged: number;
  success: boolean;
  message?: string;
  traces: StepTrace[];
  timestamp: string;
  // FAMM-RS Extended fields
  costBreakdown?: Record<string, unknown>;
  linkBreakdowns?: LinkCostBreakdown[];
  stabilityAction?: string;
  switchReason?: string;
  alternativeRoutes?: AlternativeRoute[];
}

export interface LinkCostBreakdown {
  link_id: string;
  source: string;
  target: string;
  bandwidth_mbps: number;
  delay_ms: number;
  congestion_percent: number;
  simulated_failure_risk: number;
  bandwidth_penalty: number;
  delay_penalty: number;
  congestion_penalty: number;
  risk_penalty: number;
  weight_bw: number;
  weight_delay: number;
  weight_congestion: number;
  weight_risk: number;
  total_cost: number;
}

export interface AlternativeRoute {
  path: RouterId[];
  links: string[];
  totalCost: number;
  totalHops: number;
}

export interface AlgorithmComparisonResult {
  algorithm: RoutingAlgorithmType;
  name: string;
  path: RouterId[];
  totalCost: number;
  totalHops: number;
  totalDelayMs: number;
  executionTimeMs: number;
  convergenceRounds: number;
  messagesExchanged: number;
  timeComplexity: string;
  spaceComplexity: string;
  protocolBasis: string;
  keyFeature: string;
  status: 'success' | 'failed';
}

export interface ExperimentRecord {
  id: string;
  timestamp: string;
  source: RouterId;
  destination: RouterId;
  algorithm: RoutingAlgorithmType;
  path: RouterId[];
  totalCost: number;
  totalHops: number;
  totalDelayMs: number;
  status: 'SUCCESS' | 'NO_ROUTE' | 'REROUTED';
  failedLinks: string[];
  mode: 'demo' | 'api';
}

export interface NetworkTopologyState {
  routers: RouterNodeData[];
  links: NetworkLink[];
  failedLinksCount: number;
  activeLinksCount: number;
  healthScore: number; // 0 - 100
}

export interface NetworkHealth {
  status: 'OPTIMAL' | 'DEGRADED' | 'CRITICAL';
  healthScore: number;
  activeLinks: number;
  failedLinks: number;
  averageDelayMs: number;
  averageCongestion: number;
}

// ─── FAMM-RS Research Types ─────────────────────────────────────────────────

export interface MetricWeights {
  w_delay: number;
  w_congestion: number;
  w_bandwidth: number;
  w_risk: number;
}

export interface HysteresisConfig {
  enabled: boolean;
  threshold: number;
  min_absolute_improvement: number;
}

export interface PolicyConfiguration {
  weights: MetricWeights;
  hysteresis: HysteresisConfig;
  referenceBandwidthMbps: number;
  referenceMaxDelayMs: number;
}

export interface RouteStabilityRecord {
  step: number;
  timestamp: string;
  source: string;
  destination: string;
  activeRouteBefore: string[];
  candidateRoute: string[];
  activeRouteAfter: string[];
  activeCostBefore: number | null;
  candidateCost: number | null;
  activeCostAfter: number | null;
  costDifference: number;
  relativeImprovement: number;
  switched: boolean;
  reason: string;
  policy: string;
}

export interface PolicyStepMetric {
  policy: string;
  reachable: boolean;
  path: string[];
  links: string[];
  totalCost: number;
  totalHops: number;
  totalDelayMs: number;
  bottleneckBandwidthMbps: number;
  computationTimeMs: number;
  switched: boolean;
  switchReason: string | null;
}

export interface ScenarioEvent {
  step: number;
  action: string;
  targetLinkId: string | null;
  value: number | null;
  description: string;
}

export interface ExperimentStepResult {
  step: number;
  event: ScenarioEvent;
  networkStateSummary: string;
  policyMetrics: Record<string, PolicyStepMetric>;
}

export interface PolicyOverallSummary {
  policy: string;
  reachabilityPercent: number;
  averageCost: number;
  averageDelayMs: number;
  totalSwitches: number;
  averageComputationTimeMs: number;
  costInflationVersusOptimal: number;
  stabilityScore: number;
}

export interface ResilienceExperimentReport {
  experimentId: string;
  scenarioName: string;
  description: string;
  source: string;
  destination: string;
  randomSeed: number | null;
  trials: number;
  steps: ExperimentStepResult[];
  summaries: Record<string, PolicyOverallSummary>;
  criticalLinks: string[];
  timestamp: string;
}

export interface CriticalLinkItem {
  linkId: string;
  source: string;
  target: string;
  currentStatus: string;
  disconnectsNetwork: boolean;
  reachabilityRatio: number;
  costInflationFactor: number;
  criticalityScore: number;
  classification: 'CRITICAL_BRIDGE' | 'MAJOR_BOTTLENECK' | 'REDUNDANT';
}

export interface CriticalLinkAnalysisResponse {
  analyzedAt: string;
  totalLinks: number;
  criticalLinks: CriticalLinkItem[];
  recommendation: string;
}
