// src/components/simulation/FailureSimulationView.tsx
import React, { useMemo } from 'react';
import {
  Flame,
  RotateCcw,
  AlertOctagon,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  ShieldAlert,
  Activity,
  Sparkles,
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
  onToggleLinkFail: (linkId: string) => void;
  onSetBulkLinkStatus: (failedLinkIds: string[]) => void;
  onResetAllLinks: () => void;
}

export const FailureSimulationView: React.FC<FailureSimulationViewProps> = ({
  routers,
  links,
  currentRoute: _currentRoute,
  selectedSource,
  selectedDestination,
  selectedAlgorithm: _selectedAlgorithm,
  onToggleLinkFail,
  onSetBulkLinkStatus,
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

  // Pre-configured test scenarios
  const scenarios = [
    {
      id: 'all-healthy',
      title: 'Optimal Baseline (All Links UP)',
      description: 'All 6 links fully active. Standard optimal shortest path is used.',
      failedIds: [],
      badge: 'HEALTHY',
      badgeColor: 'text-emerald-400 bg-emerald-950 border-emerald-800',
    },
    {
      id: 'backbone-cut',
      title: 'Backbone Link Cut (R3–R5 Down)',
      description: 'Primary link to destination router R5 breaks. Forces reroute via transit router R4 (R1 ➔ R4 ➔ R5).',
      failedIds: ['R3-R5'],
      badge: 'CRITICAL REROUTE',
      badgeColor: 'text-amber-400 bg-amber-950 border-amber-800',
    },
    {
      id: 'gateway-cut',
      title: 'Ingress Link Cut (R1–R3 Down)',
      description: 'Core ingress link severed. Algorithm evaluates alternate path via secondary bypass R4.',
      failedIds: ['R1-R3'],
      badge: 'BYPASS TEST',
      badgeColor: 'text-cyan-400 bg-cyan-950 border-cyan-800',
    },
    {
      id: 'partition',
      title: 'Total Network Partition (R3–R5 & R4–R5 Down)',
      description: 'Both ingress paths into R5 are severed. Destination becomes completely unreachable (cost = ∞).',
      failedIds: ['R3-R5', 'R4-R5'],
      badge: 'BLACK HOLE / PARTITION',
      badgeColor: 'text-rose-400 bg-rose-950 border-rose-800',
    },
    {
      id: 'secondary-cut',
      title: 'Redundancy Loss (R1–R4 Down)',
      description: 'Backup link down; primary path remains active but failover resilience is eliminated.',
      failedIds: ['R1-R4'],
      badge: 'REDUNDANCY LOSS',
      badgeColor: 'text-purple-400 bg-purple-950 border-purple-800',
    },
  ];

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

      {/* Preset Scenarios Gallery */}
      <div className="bg-slate-900/90 rounded-2xl border border-slate-800 p-6 backdrop-blur-md shadow-xl">
        <div className="flex items-center gap-2 mb-4">
          <Sparkles className="w-5 h-5 text-amber-400" />
          <h3 className="font-bold text-base text-white">Curated Test Scenarios & Disaster Simulations</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {scenarios.map((scenario) => {
            const isCurrentlySelected =
              scenario.failedIds.length === failedLinks.length &&
              scenario.failedIds.every((id) => failedLinks.some((l) => l.id === id));

            return (
              <div
                key={scenario.id}
                className={`p-4 rounded-xl border transition-all flex flex-col justify-between ${
                  isCurrentlySelected
                    ? 'bg-cyan-950/30 border-cyan-500/60 shadow-glow-cyan/20'
                    : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className={`text-[10px] font-mono px-2 py-0.5 rounded border ${scenario.badgeColor}`}>
                      {scenario.badge}
                    </span>
                    {isCurrentlySelected && (
                      <span className="text-[10px] font-mono text-cyan-400 font-bold">CURRENT</span>
                    )}
                  </div>
                  <h4 className="font-bold text-sm text-white">{scenario.title}</h4>
                  <p className="text-xs text-slate-400 mt-1 leading-snug">{scenario.description}</p>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-800/80">
                  <button
                    onClick={() => onSetBulkLinkStatus(scenario.failedIds)}
                    className="w-full py-2 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-300 font-mono text-xs font-semibold transition-colors flex items-center justify-center gap-1.5"
                  >
                    <span>Load Scenario</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Interactive Individual Link Toggles */}
      <div className="bg-slate-900/90 rounded-2xl border border-slate-800 p-6 backdrop-blur-md shadow-xl">
        <h3 className="font-bold text-base text-white mb-4 flex items-center gap-2">
          <ShieldAlert className="w-5 h-5 text-cyan-400" />
          <span>Manual Link Fault Injection Matrix</span>
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {links.map((link) => {
            const isFailed = link.status === 'failed';

            return (
              <div
                key={link.id}
                className={`p-4 rounded-xl border transition-all ${
                  isFailed
                    ? 'bg-rose-950/30 border-rose-500/50 shadow-glow-rose/10'
                    : 'bg-slate-950/60 border-slate-800'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="font-mono font-bold text-base text-white flex items-center gap-2">
                    <span>{link.id}</span>
                    <span className="text-xs text-slate-400">({link.source} ⟷ {link.target})</span>
                  </div>
                  <span className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold ${
                    isFailed ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40' : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                  }`}>
                    {isFailed ? 'FAILED' : 'ACTIVE'}
                  </span>
                </div>

                <div className="mt-3 text-xs font-mono text-slate-400 space-y-1">
                  <div className="flex justify-between">
                    <span>Cost:</span>
                    <span className="text-cyan-400">{link.cost}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Delay:</span>
                    <span className="text-amber-300">{link.delayMs} ms</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Bandwidth:</span>
                    <span className="text-slate-300">{link.bandwidthMbps} Mbps</span>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-800">
                  <button
                    onClick={() => onToggleLinkFail(link.id)}
                    className={`w-full py-2 px-3 rounded-lg text-xs font-mono font-bold transition-all flex items-center justify-center gap-1.5 ${
                      isFailed
                        ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                        : 'bg-rose-600/80 hover:bg-rose-500 text-white'
                    }`}
                  >
                    {isFailed ? (
                      <>
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Restore Link</span>
                      </>
                    ) : (
                      <>
                        <Flame className="w-3.5 h-3.5" />
                        <span>Trigger Link Cut</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
