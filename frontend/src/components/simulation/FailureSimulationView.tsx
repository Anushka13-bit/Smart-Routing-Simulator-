// src/components/simulation/FailureSimulationView.tsx
import React, { useMemo } from 'react';
import {
  Flame,
  RotateCcw,
  AlertOctagon,
  CheckCircle2,
  AlertTriangle,
  Activity,
} from 'lucide-react';
import type {
  RouterId,
  RoutingAlgorithmType,
  RouteResult,
  RouterNodeData,
  NetworkLink,
} from '../../types/network';
import { runDijkstra } from '../../services/routingEngine';

interface FailureSimulationViewProps {
  routers: RouterNodeData[];
  links: NetworkLink[];
  currentRoute?: RouteResult | null;
  selectedSource: RouterId;
  selectedDestination: RouterId;
  selectedAlgorithm?: RoutingAlgorithmType;
  onToggleLinkFail?: (linkId: string) => void;
  onSetBulkLinkStatus?: (failedLinkIds: string[]) => void;
  onResetAllLinks: () => void;
}

export const FailureSimulationView: React.FC<FailureSimulationViewProps> = ({
  routers,
  links,
  currentRoute: _currentRoute,
  selectedSource,
  selectedDestination,
  selectedAlgorithm: _selectedAlgorithm,
  onToggleLinkFail: _onToggleLinkFail,
  onSetBulkLinkStatus: _onSetBulkLinkStatus,
  onResetAllLinks,
}) => {
  // Baseline route when ALL links are active
  const baselineRoute = useMemo(() => {
    const allActiveLinks = links.map((l) => ({ ...l, status: 'active' as const }));
    return runDijkstra(selectedSource, selectedDestination, allActiveLinks, routers);
  }, [selectedSource, selectedDestination, links, routers]);

  // Current route with current link states
  const activeRoute = useMemo(() => {
    return runDijkstra(selectedSource, selectedDestination, links, routers);
  }, [selectedSource, selectedDestination, links, routers]);

  const failedLinks = links.filter((l) => l.status === 'failed');

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-slate-900/90 rounded-2xl border border-slate-800 p-6 backdrop-blur-md shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
          <div>
            <div className="flex items-center gap-2">
              <Flame className="w-5 h-5 text-rose-500" />
              <h2 className="text-xl font-bold text-white">Dynamic Link Failure & Resiliency Simulator</h2>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Simulate physical fiber cuts, hardware faults, and observe real-time dynamic rerouting and failover metrics.
            </p>
          </div>

          <button
            onClick={onResetAllLinks}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-mono font-medium border border-slate-700 transition-all"
          >
            <RotateCcw className="w-4 h-4 text-cyan-400" />
            <span>Restore All 6 Links</span>
          </button>
        </div>

        {/* Status Strip */}
        <div className="mt-4 flex flex-wrap items-center gap-3 text-xs font-mono">
          <div className="bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800 flex items-center gap-2">
            <span className="text-slate-400">Failed Links:</span>
            <span className={`font-bold ${failedLinks.length > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
              {failedLinks.length} / {links.length}
            </span>
          </div>

          <div className="bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800 flex items-center gap-2">
            <span className="text-slate-400">Connectivity:</span>
            <span className={`font-bold ${activeRoute.success ? 'text-emerald-400' : 'text-rose-400 animate-pulse'}`}>
              {activeRoute.success ? 'REACHABLE' : 'PARTITIONED'}
            </span>
          </div>
        </div>
      </div>

      {/* Reroute Comparison Cards: Baseline vs Current State */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Baseline Healthy Path */}
        <div className="bg-slate-900/85 rounded-2xl border border-slate-800 p-6 backdrop-blur-md shadow-xl">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
              <h3 className="font-bold text-sm text-white">Nominal Healthy Path (100% Up)</h3>
            </div>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800">
              IDEAL BASELINE
            </span>
          </div>

          <div className="mt-4 p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 font-mono text-sm font-bold text-cyan-300">
            {baselineRoute.path.join(' ➔ ')}
          </div>

          <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs font-mono">
            <div className="bg-slate-950/50 p-2 rounded-lg border border-slate-800">
              <span className="text-[10px] text-slate-500 block">Metric Cost</span>
              <span className="text-emerald-400 font-bold">{baselineRoute.totalCost}</span>
            </div>
            <div className="bg-slate-950/50 p-2 rounded-lg border border-slate-800">
              <span className="text-[10px] text-slate-500 block">Hop Count</span>
              <span className="text-white font-bold">{baselineRoute.totalHops}</span>
            </div>
            <div className="bg-slate-950/50 p-2 rounded-lg border border-slate-800">
              <span className="text-[10px] text-slate-500 block">Delay</span>
              <span className="text-amber-300 font-bold">{baselineRoute.totalDelayMs} ms</span>
            </div>
          </div>
        </div>

        {/* Current Failover Path */}
        <div className={`p-6 rounded-2xl border backdrop-blur-md shadow-xl ${
          activeRoute.success
            ? 'bg-slate-900/85 border-cyan-500/40'
            : 'bg-rose-950/20 border-rose-500/50'
        }`}>
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              {activeRoute.success ? (
                <Activity className="w-5 h-5 text-cyan-400" />
              ) : (
                <AlertOctagon className="w-5 h-5 text-rose-500 animate-pulse" />
              )}
              <h3 className="font-bold text-sm text-white">Active Post-Failure Route</h3>
            </div>
            <span className={`text-[10px] font-mono px-2 py-0.5 rounded ${
              activeRoute.success
                ? 'bg-cyan-950 text-cyan-300 border border-cyan-800'
                : 'bg-rose-950 text-rose-300 border border-rose-800'
            }`}>
              {activeRoute.success ? 'DYNAMIC FAILOVER' : 'UNREACHABLE'}
            </span>
          </div>

          <div className="mt-4 p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 font-mono text-sm font-bold text-white">
            {activeRoute.success ? (
              activeRoute.path.join(' ➔ ')
            ) : (
              <span className="text-rose-400 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                Network partitioned: {selectedDestination} is unreachable
              </span>
            )}
          </div>

          <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs font-mono">
            <div className="bg-slate-950/50 p-2 rounded-lg border border-slate-800">
              <span className="text-[10px] text-slate-500 block">Metric Cost</span>
              <span className={`font-bold ${activeRoute.totalCost > baselineRoute.totalCost ? 'text-amber-400' : 'text-emerald-400'}`}>
                {activeRoute.totalCost === Infinity ? '∞' : activeRoute.totalCost}
              </span>
            </div>
            <div className="bg-slate-950/50 p-2 rounded-lg border border-slate-800">
              <span className="text-[10px] text-slate-500 block">Hop Count</span>
              <span className="text-white font-bold">{activeRoute.totalHops}</span>
            </div>
            <div className="bg-slate-950/50 p-2 rounded-lg border border-slate-800">
              <span className="text-[10px] text-slate-500 block">Delay</span>
              <span className="text-amber-300 font-bold">{activeRoute.totalDelayMs} ms</span>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
};
