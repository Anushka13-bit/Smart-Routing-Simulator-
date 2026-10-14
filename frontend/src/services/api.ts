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
} from '../types/network';

// Get base URL from environment variable, fallback to standard FastAPI default
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000';

export const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 4000,
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

  // Compare all 4 routing algorithms
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

  // Update link metrics (cost, delay, bandwidth, congestion)
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
};
