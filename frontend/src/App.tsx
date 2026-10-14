// src/App.tsx
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Navbar, type ActiveTab } from './components/common/Navbar';
import { DashboardView } from './components/dashboard/DashboardView';
import { NetworkTopology } from './components/topology/NetworkTopology';
import { RouteExplorerView } from './components/explorer/RouteExplorerView';
import { AlgorithmComparisonView } from './components/comparison/AlgorithmComparisonView';
import { FailureSimulationView } from './components/simulation/FailureSimulationView';
import { LinkMetricsView } from './components/metrics/LinkMetricsView';
import { ExperimentHistoryView } from './components/history/ExperimentHistoryView';
import { AlgorithmTheoryModal } from './components/modals/AlgorithmTheoryModal';
import { ToastContainer, type ToastMessage } from './components/common/Toast';
import { INITIAL_ROUTERS, INITIAL_LINKS } from './services/mockData';
import {
  runDijkstra,
  runBellmanFord,
  runDistanceVector,
  runLinkState,
} from './services/routingEngine';
import { NetworkApiService } from './services/api';
import type {
  RouterId,
  RoutingAlgorithmType,
  RouteResult,
  NetworkLink,
  RouterNodeData,
  ExperimentRecord,
} from './types/network';

const INITIAL_HISTORY: ExperimentRecord[] = [
  {
    id: 'exp-101',
    timestamp: new Date(Date.now() - 3600000 * 2).toISOString(),
    source: 'R1',
    destination: 'R5',
    algorithm: 'dijkstra',
    path: ['R1', 'R3', 'R5'],
    totalCost: 8,
    totalHops: 2,
    totalDelayMs: 12,
    status: 'SUCCESS',
    failedLinks: [],
    mode: 'demo',
  },
  {
    id: 'exp-102',
    timestamp: new Date(Date.now() - 3600000).toISOString(),
    source: 'R1',
    destination: 'R5',
    algorithm: 'bellman-ford',
    path: ['R1', 'R3', 'R5'],
    totalCost: 8,
    totalHops: 2,
    totalDelayMs: 12,
    status: 'SUCCESS',
    failedLinks: [],
    mode: 'demo',
  },
  {
    id: 'exp-103',
    timestamp: new Date(Date.now() - 1800000).toISOString(),
    source: 'R1',
    destination: 'R5',
    algorithm: 'dijkstra',
    path: ['R1', 'R4', 'R5'],
    totalCost: 9,
    totalHops: 2,
    totalDelayMs: 16,
    status: 'REROUTED',
    failedLinks: ['R3-R5'],
    mode: 'demo',
  },
];

export const App: React.FC = () => {
  // Navigation
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');

  // Network State
  const [routers, setRouters] = useState<RouterNodeData[]>(INITIAL_ROUTERS);
  const [links, setLinks] = useState<NetworkLink[]>(INITIAL_LINKS);

  // Endpoint & Engine Selection (Default: Source R1, Destination R5, Dijkstra)
  const [selectedSource, setSelectedSource] = useState<RouterId>('R1');
  const [selectedDestination, setSelectedDestination] = useState<RouterId>('R5');
  const [selectedAlgorithm, setSelectedAlgorithm] = useState<RoutingAlgorithmType>('dijkstra');

  // Computed Routing Output
  const [currentRoute, setCurrentRoute] = useState<RouteResult | null>(null);

  // Backend Integration / Demo Mode
  const [isApiMode, setIsApiMode] = useState<boolean>(false);
  const [backendOnline, setBackendOnline] = useState<boolean>(false);
  const [backendChecking, setBackendChecking] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);

  // Modals & Notifications
  const [isTheoryOpen, setIsTheoryOpen] = useState<boolean>(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  // Simulation Audit History
  const [history, setHistory] = useState<ExperimentRecord[]>(() => {
    try {
      const saved = localStorage.getItem('routing_sim_history');
      if (saved) {
        return JSON.parse(saved);
      }
    } catch {
      // Fallback
    }
    return INITIAL_HISTORY;
  });

  // Save history to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('routing_sim_history', JSON.stringify(history));
    } catch {
      // Ignore
    }
  }, [history]);

  // Toast Helper
  const addToast = useCallback(
    (type: 'success' | 'error' | 'info', title: string, description?: string) => {
      const newToast: ToastMessage = {
        id: `toast-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
        type,
        title,
        description,
      };
      setToasts((prev) => [...prev, newToast]);

      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== newToast.id));
      }, 4500);
    },
    []
  );

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // Health check FastAPI Backend
  const checkBackendHealth = useCallback(async () => {
    setBackendChecking(true);
    const health = await NetworkApiService.checkHealth();
    setBackendOnline(health.online);
    setBackendChecking(false);
    return health.online;
  }, []);

  // Check health on mount and every 30s if in API mode
  useEffect(() => {
    checkBackendHealth();
    const interval = setInterval(() => {
      if (isApiMode) {
        checkBackendHealth();
      }
    }, 30000);
    return () => clearInterval(interval);
  }, [checkBackendHealth, isApiMode]);

  // When switching modes, notify user
  const handleToggleMode = useCallback(
    async (targetMode: boolean) => {
      setIsApiMode(targetMode);
      if (targetMode) {
        const online = await checkBackendHealth();
        if (online) {
          addToast(
            'success',
            'Connected to FastAPI Backend',
            'Now communicating with live REST API at http://127.0.0.1:8000'
          );
          // Try to sync topology from backend
          try {
            const remoteTopology = await NetworkApiService.getTopology();
            if (remoteTopology?.routers && remoteTopology?.links) {
              setRouters(remoteTopology.routers);
              setLinks(remoteTopology.links);
            }
          } catch {
            // Keep local
          }
        } else {
          addToast(
            'error',
            'FastAPI Backend Unavailable',
            'Server at http://127.0.0.1:8000 is offline. Real API calls will fail until the server starts.'
          );
        }
      } else {
        addToast(
          'info',
          'Switched to Client Simulation (Demo Mode)',
          'All routing calculations and link failures run directly in the high-performance browser engine.'
        );
      }
    },
    [checkBackendHealth, addToast]
  );

  // Compute Route Logic
  const handleCalculateRoute = useCallback(
    async (
      src: RouterId = selectedSource,
      dst: RouterId = selectedDestination,
      algo: RoutingAlgorithmType = selectedAlgorithm
    ) => {
      setLoading(true);

      if (isApiMode) {
        try {
          const result = await NetworkApiService.calculateRoute({
            source: src,
            destination: dst,
            algorithm: algo,
          });

          setCurrentRoute(result);
          setLoading(false);

          // Record in history
          const record: ExperimentRecord = {
            id: `exp-${Date.now()}`,
            timestamp: new Date().toISOString(),
            source: src,
            destination: dst,
            algorithm: algo,
            path: result.path,
            totalCost: result.totalCost,
            totalHops: result.totalHops,
            totalDelayMs: result.totalDelayMs,
            status: result.success ? 'SUCCESS' : 'NO_ROUTE',
            failedLinks: links.filter((l) => l.status === 'failed').map((l) => l.id),
            mode: 'api',
          };
          setHistory((prev) => [record, ...prev]);

          if (result.success) {
            addToast(
              'success',
              `Route Computed (${algo.toUpperCase()}) [FastAPI]`,
              `Path: ${result.path.join(' ➔ ')} • Metric: ${result.totalCost} • Hops: ${result.totalHops}`
            );
          } else {
            addToast(
              'error',
              'FastAPI: Destination Unreachable',
              result.message || 'No valid path found in current topology.'
            );
          }
          return;
        } catch (error: unknown) {
          setLoading(false);
          const errMessage = error instanceof Error ? error.message : 'API Request Failed';
          addToast(
            'error',
            'FastAPI Calculation Failed',
            `${errMessage}. Falling back to demo mode is recommended.`
          );
          return;
        }
      }

      // Demo / Local Mode
      let result: RouteResult;
      if (algo === 'dijkstra') {
        result = runDijkstra(src, dst, links, routers);
      } else if (algo === 'bellman-ford') {
        result = runBellmanFord(src, dst, links, routers);
      } else if (algo === 'distance-vector') {
        result = runDistanceVector(src, dst, links, routers);
      } else {
        result = runLinkState(src, dst, links, routers);
      }

      setCurrentRoute(result);
      setLoading(false);

      // Record in history
      const record: ExperimentRecord = {
        id: `exp-${Date.now()}`,
        timestamp: new Date().toISOString(),
        source: src,
        destination: dst,
        algorithm: algo,
        path: result.path,
        totalCost: result.totalCost,
        totalHops: result.totalHops,
        totalDelayMs: result.totalDelayMs,
        status: result.success ? 'SUCCESS' : 'NO_ROUTE',
        failedLinks: links.filter((l) => l.status === 'failed').map((l) => l.id),
        mode: 'demo',
      };
      setHistory((prev) => [record, ...prev]);

      if (result.success) {
        addToast(
          'success',
          `Optimal Path Found (${algo.toUpperCase()})`,
          `Path: ${result.path.join(' ➔ ')} • Metric: ${result.totalCost} • Latency: ${result.totalDelayMs}ms`
        );
      } else {
        addToast(
          'error',
          'Destination Unreachable',
          'Current link cuts prevent packet transmission to destination.'
        );
      }
    },
    [
      selectedSource,
      selectedDestination,
      selectedAlgorithm,
      isApiMode,
      links,
      routers,
      addToast,
    ]
  );

  // Compute initial route on mount
  useEffect(() => {
    const initialRoute = runDijkstra('R1', 'R5', INITIAL_LINKS, INITIAL_ROUTERS);
    setCurrentRoute(initialRoute);
  }, []);

  // Toggle Link Failure (Fail / Restore)
  const handleToggleLinkFail = useCallback(
    async (linkId: string) => {
      const targetLink = links.find((l) => l.id === linkId);
      if (!targetLink) return;

      const willFail = targetLink.status === 'active';

      if (isApiMode) {
        try {
          if (willFail) {
            await NetworkApiService.failLink(linkId);
          } else {
            await NetworkApiService.restoreLink(linkId);
          }
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : 'API failure';
          addToast('error', 'API Link Toggle Failed', msg);
          return;
        }
      }

      const updatedLinks: NetworkLink[] = links.map((l) => {
        if (l.id === linkId) {
          return {
            ...l,
            status: willFail ? 'failed' : 'active',
            failedAt: willFail ? new Date().toISOString() : undefined,
          };
        }
        return l;
      });

      setLinks(updatedLinks);

      addToast(
        willFail ? 'error' : 'success',
        willFail ? `Link ${linkId} Severed!` : `Link ${linkId} Restored!`,
        willFail
          ? `Fiber cut simulated on link ${linkId}. Re-evaluating dynamic forwarding table...`
          : `Physical connectivity restored on link ${linkId}. Re-converging routes...`
      );

      // Recompute route immediately with new link states
      const newRoute = runDijkstra(selectedSource, selectedDestination, updatedLinks, routers);
      setCurrentRoute(newRoute);
    },
    [links, isApiMode, selectedSource, selectedDestination, routers, addToast]
  );

  // Update Link Metrics (Cost, Delay, Bandwidth, Congestion)
  const handleUpdateLinkMetrics = useCallback(
    async (linkId: string, updates: Partial<NetworkLink>) => {
      if (isApiMode) {
        try {
          await NetworkApiService.updateLinkMetrics(linkId, updates);
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : 'Failed to update metrics';
          addToast('error', 'API Update Failed', msg);
          return;
        }
      }

      const updatedLinks = links.map((l) => {
        if (l.id === linkId) {
          return { ...l, ...updates };
        }
        return l;
      });

      setLinks(updatedLinks);

      addToast(
        'info',
        `Link ${linkId} Metrics Updated`,
        `New parameters applied. Route recalculated dynamically.`
      );

      // Recompute route
      const newRoute = runDijkstra(selectedSource, selectedDestination, updatedLinks, routers);
      setCurrentRoute(newRoute);
    },
    [links, isApiMode, selectedSource, selectedDestination, routers, addToast]
  );

  // Bulk set link statuses (for failure simulation scenarios)
  const handleSetBulkLinkStatus = useCallback(
    (failedLinkIds: string[]) => {
      const updatedLinks: NetworkLink[] = links.map((l) => ({
        ...l,
        status: failedLinkIds.includes(l.id) ? 'failed' : 'active',
      }));

      setLinks(updatedLinks);

      addToast(
        'info',
        'Scenario Injected',
        `${failedLinkIds.length} link(s) placed into fail state.`
      );

      const newRoute = runDijkstra(selectedSource, selectedDestination, updatedLinks, routers);
      setCurrentRoute(newRoute);
    },
    [links, selectedSource, selectedDestination, routers, addToast]
  );

  // Reset entire network
  const handleResetNetwork = useCallback(async () => {
    if (isApiMode) {
      try {
        await NetworkApiService.resetTopology();
      } catch {
        // Fallback
      }
    }

    setLinks(INITIAL_LINKS);
    setRouters(INITIAL_ROUTERS);

    const freshRoute = runDijkstra('R1', 'R5', INITIAL_LINKS, INITIAL_ROUTERS);
    setCurrentRoute(freshRoute);
    setSelectedSource('R1');
    setSelectedDestination('R5');

    addToast(
      'success',
      'Network Reset to Factory Defaults',
      'All 6 links are online, metrics set to nominal defaults, source=R1, dest=R5.'
    );
  }, [isApiMode, addToast]);

  // Replay experiment from history
  const handleReplayExperiment = useCallback(
    (record: ExperimentRecord) => {
      setSelectedSource(record.source);
      setSelectedDestination(record.destination);
      setSelectedAlgorithm(record.algorithm);

      // Restore failed links matching this record
      const updatedLinks: NetworkLink[] = links.map((l) => ({
        ...l,
        status: record.failedLinks.includes(l.id) ? 'failed' : 'active',
      }));
      setLinks(updatedLinks);

      // Re-run
      handleCalculateRoute(record.source, record.destination, record.algorithm);
      setActiveTab('explorer');

      addToast(
        'info',
        'Replaying Simulation',
        `Restored vector: ${record.source} ➔ ${record.destination} using ${record.algorithm.toUpperCase()}`
      );
    },
    [links, handleCalculateRoute, addToast]
  );

  // Clear history
  const handleClearHistory = useCallback(() => {
    setHistory([]);
    try {
      localStorage.removeItem('routing_sim_history');
    } catch {
      // Ignore
    }
    addToast('info', 'Simulation History Cleared', 'All stored logs have been deleted.');
  }, [addToast]);

  // Active / failed counts
  const activeLinksCount = useMemo(
    () => links.filter((l) => l.status === 'active').length,
    [links]
  );

  return (
    <div className="min-h-screen bg-[#070B14] text-slate-100 flex flex-col font-sans selection:bg-cyan-500 selection:text-slate-950">
      {/* Navigation Header */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isApiMode={isApiMode}
        setIsApiMode={handleToggleMode}
        backendOnline={backendOnline}
        backendChecking={backendChecking}
        onResetNetwork={handleResetNetwork}
        onOpenTheory={() => setIsTheoryOpen(true)}
        activeLinksCount={activeLinksCount}
        totalLinksCount={links.length}
      />

      {/* Main View Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {activeTab === 'dashboard' && (
          <DashboardView
            routers={routers}
            links={links}
            currentRoute={currentRoute}
            selectedSource={selectedSource}
            selectedDestination={selectedDestination}
            selectedAlgorithm={selectedAlgorithm}
            setSelectedSource={setSelectedSource}
            setSelectedDestination={setSelectedDestination}
            setSelectedAlgorithm={setSelectedAlgorithm}
            onCalculateRoute={() => handleCalculateRoute()}
            onNavigateToTopology={() => setActiveTab('topology')}
            onNavigateToComparison={() => setActiveTab('comparison')}
            onToggleLinkFail={handleToggleLinkFail}
            loading={loading}
          />
        )}

        {activeTab === 'topology' && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900/70 p-4 rounded-xl border border-slate-800">
              <div>
                <h2 className="text-lg font-bold text-white">Interactive Network Topology Graph</h2>
                <p className="text-xs text-slate-400">
                  Drag routers, zoom in/out, click any node or link to inspect properties, or cut links with a single click.
                </p>
              </div>
              <button
                onClick={() => handleCalculateRoute()}
                disabled={loading}
                className="px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs font-mono transition-all shadow-glow-cyan disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                <span>Re-Calculate Active Path</span>
              </button>
            </div>

            <NetworkTopology
              routers={routers}
              links={links}
              currentRoute={currentRoute}
              selectedSource={selectedSource}
              selectedDestination={selectedDestination}
              onToggleLinkFail={handleToggleLinkFail}
              onUpdateLinkMetrics={handleUpdateLinkMetrics}
            />
          </div>
        )}

        {activeTab === 'explorer' && (
          <RouteExplorerView
            routers={routers}
            links={links}
            currentRoute={currentRoute}
            selectedSource={selectedSource}
            selectedDestination={selectedDestination}
            selectedAlgorithm={selectedAlgorithm}
            setSelectedSource={setSelectedSource}
            setSelectedDestination={setSelectedDestination}
            setSelectedAlgorithm={setSelectedAlgorithm}
            onCalculateRoute={() => handleCalculateRoute()}
            loading={loading}
          />
        )}

        {activeTab === 'comparison' && (
          <AlgorithmComparisonView
            routers={routers}
            links={links}
            selectedSource={selectedSource}
            selectedDestination={selectedDestination}
            setSelectedSource={setSelectedSource}
            setSelectedDestination={setSelectedDestination}
          />
        )}

        {activeTab === 'failure' && (
          <FailureSimulationView
            routers={routers}
            links={links}
            currentRoute={currentRoute}
            selectedSource={selectedSource}
            selectedDestination={selectedDestination}
            selectedAlgorithm={selectedAlgorithm}
            onToggleLinkFail={handleToggleLinkFail}
            onSetBulkLinkStatus={handleSetBulkLinkStatus}
            onResetAllLinks={handleResetNetwork}
          />
        )}

        {activeTab === 'metrics' && (
          <LinkMetricsView
            links={links}
            onUpdateMetric={handleUpdateLinkMetrics}
            onResetMetrics={handleResetNetwork}
            currentRoute={currentRoute}
            selectedSource={selectedSource}
            selectedDestination={selectedDestination}
          />
        )}

        {activeTab === 'history' && (
          <ExperimentHistoryView
            history={history}
            onClearHistory={handleClearHistory}
            onReplayExperiment={handleReplayExperiment}
          />
        )}
      </main>

      {/* Cyber NOC Footer */}
      <footer className="mt-auto border-t border-slate-800/80 bg-[#060A12] py-6 text-xs text-slate-500 font-mono">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-cyan-400 shadow-glow-cyan animate-pulse"></span>
            <span className="text-slate-300 font-semibold">Smart Routing Simulator</span>
            <span>• Computer Networks Lab</span>
          </div>

          <div className="flex items-center gap-4 text-[11px]">
            <span>Topology: 5-Node Mesh (R1–R5)</span>
            <span>•</span>
            <span>Algorithms: Dijkstra, Bellman-Ford, DV, Link-State</span>
            <span>•</span>
            <span className={isApiMode ? 'text-blue-400 font-semibold' : 'text-cyan-400 font-semibold'}>
              Mode: {isApiMode ? 'FastAPI REST Service' : 'Client Simulation'}
            </span>
          </div>
        </div>
      </footer>

      {/* Algorithm Theory Educational Modal */}
      <AlgorithmTheoryModal
        isOpen={isTheoryOpen}
        onClose={() => setIsTheoryOpen(false)}
      />

      {/* Notification Toast Stack */}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
};

export default App;
