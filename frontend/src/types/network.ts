// src/types/network.ts

export type RouterId = 'R1' | 'R2' | 'R3' | 'R4' | 'R5';

export type RoutingAlgorithmType = 'dijkstra' | 'bellman-ford' | 'distance-vector' | 'link-state';

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
