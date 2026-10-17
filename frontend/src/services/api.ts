// src/services/api.ts
import axios from 'axios';
import type { AxiosInstance } from 'axios';
import type {
  RouterId,
  RoutingAlgorithmType,
  RouteResult,
  AlgorithmComparisonResult,
  NetworkLink,
  RouterNodeData,
  RoutingTable,
  PolicyConfiguration,
  RouteStabilityRecord,
  ResilienceExperimentReport,
  CriticalLinkAnalysisResponse,
} from '../types/network';

// Get base URL from environment variable, fallback to standard FastAPI default
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000';

export const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 8000,
  headers: {
    'Content-Type': 'application/json',
  },
});

export interface ApiTopologyResponse {
  routers: RouterNodeData[];
  links: NetworkLink[];
}

export interface CalculateRouteRequest {
  source: RouterId;
  destination: RouterId;
  algorithm: RoutingAlgorithmType;
}

export interface UpdateLinkMetricsRequest {
  cost?: number;
  bandwidthMbps?: number;
  delayMs?: number;
  congestionPercent?: number;
  simulatedFailureRisk?: number;
}

export interface ResilienceExperimentRequest {
  scenarioName: 'single-link-failure' | 'cascading-failure' | 'congestion-oscillation' | 'synthetic-mesh';
  source?: RouterId;
  destination?: RouterId;
  randomSeed?: number;
  syntheticNodeCount?: number;
  syntheticDensity?: number;
}

export const NetworkApiService = {
  // Check if FastAPI backend is online
  async checkHealth(): Promise<{ online: boolean; message: string; version?: string }> {
    try {
      const response = await apiClient.get('/api/health');
      return {
        online: true,
        message: 'Backend API is connected and healthy.',
        version: response.data?.version || '1.0.0',
      };
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Cannot reach FastAPI backend server.';
      return {
        online: false,
        message: msg,
      };
    }
  },

  // Fetch current topology
  async getTopology(): Promise<ApiTopologyResponse> {
    const response = await apiClient.get<ApiTopologyResponse>('/api/topology');
    return response.data;
  },

  // Compute a single route using selected algorithm
  async calculateRoute(payload: CalculateRouteRequest): Promise<RouteResult> {
    const response = await apiClient.post<RouteResult>('/api/route', payload);
    return response.data;
  },

  // Compare all routing algorithms
  async compareAlgorithms(source: RouterId, destination: RouterId): Promise<AlgorithmComparisonResult[]> {
    const response = await apiClient.post<AlgorithmComparisonResult[]>('/api/compare', {
      source,
      destination,
    });
    return response.data;
  },

  // Fail a link
  async failLink(linkId: string): Promise<{ success: boolean; link: NetworkLink }> {
    const response = await apiClient.post<{ success: boolean; link: NetworkLink }>(`/api/links/${linkId}/fail`);
    return response.data;
  },

  // Restore a link
  async restoreLink(linkId: string): Promise<{ success: boolean; link: NetworkLink }> {
    const response = await apiClient.post<{ success: boolean; link: NetworkLink }>(`/api/links/${linkId}/restore`);
    return response.data;
  },

  // Update link metrics (cost, delay, bandwidth, congestion, risk)
  async updateLinkMetrics(linkId: string, metrics: UpdateLinkMetricsRequest): Promise<{ success: boolean; link: NetworkLink }> {
    const response = await apiClient.put<{ success: boolean; link: NetworkLink }>(`/api/links/${linkId}/metrics`, metrics);
    return response.data;
  },

  // Fetch routing table for a specific router
  async getRoutingTable(routerId: RouterId): Promise<RoutingTable> {
    const response = await apiClient.get<RoutingTable>(`/api/routers/${routerId}/routing-table`);
    return response.data;
  },

  // Reset topology to factory defaults
  async resetTopology(): Promise<ApiTopologyResponse> {
    const response = await apiClient.post<ApiTopologyResponse>('/api/reset');
    return response.data;
  },

  // --- Resilience & Research Endpoints ---

  async getPolicyConfig(): Promise<PolicyConfiguration> {
    const response = await apiClient.get<PolicyConfiguration>('/api/resilience/policy/config');
    return response.data;
  },

  async updatePolicyConfig(config: PolicyConfiguration): Promise<PolicyConfiguration> {
    const response = await apiClient.post<PolicyConfiguration>('/api/resilience/policy/config', config);
    return response.data;
  },

  async evaluateResilientRoute(
    source: RouterId = 'R1',
    destination: RouterId = 'R5',
    enableHysteresis: boolean = true,
    thresholdOverride?: number
  ): Promise<RouteResult> {
    const params = new URLSearchParams({
      source,
      destination,
      enable_hysteresis: String(enableHysteresis),
    });
    if (thresholdOverride !== undefined) {
      params.append('threshold_override', String(thresholdOverride));
    }
    const response = await apiClient.post<RouteResult>(`/api/resilience/evaluate?${params.toString()}`);
    return response.data;
  },

  async getStabilityHistory(limit: number = 50): Promise<RouteStabilityRecord[]> {
    const response = await apiClient.get<RouteStabilityRecord[]>(`/api/resilience/stability/history?limit=${limit}`);
    return response.data;
  },

  async resetStability(): Promise<{ success: boolean; message: string }> {
    const response = await apiClient.post<{ success: boolean; message: string }>('/api/resilience/stability/reset');
    return response.data;
  },

  async runExperiment(req: ResilienceExperimentRequest): Promise<ResilienceExperimentReport> {
    const response = await apiClient.post<ResilienceExperimentReport>('/api/resilience/experiments/run', req);
    return response.data;
  },

  async getCriticalLinks(): Promise<CriticalLinkAnalysisResponse> {
    const response = await apiClient.get<CriticalLinkAnalysisResponse>('/api/resilience/critical-links');
    return response.data;
  },

  getExperimentCsvUrl(expId: string): string {
    return `${API_BASE_URL}/api/resilience/experiments/${expId}/export/csv`;
  },

  async getExperimentJson(expId: string): Promise<ResilienceExperimentReport> {
    const response = await apiClient.get<ResilienceExperimentReport>(`/api/resilience/experiments/${expId}/export/json`);
    return response.data;
  },
};

