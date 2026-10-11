// src/components/dashboard/DashboardView.tsx
import React from 'react';
import {
  Server,
  Activity,
  Zap,
  ArrowRight,
  AlertTriangle,
  Play,
  CheckCircle2,
  Clock,
} from 'lucide-react';
import { StatCard } from '../common/StatCard';
import type {
  RouterNodeData,
  NetworkLink,
  RouteResult,
  RouterId,
  RoutingAlgorithmType,
} from '../../types/network';

interface DashboardViewProps {
  routers: RouterNodeData[];
  links: NetworkLink[];
  currentRoute: RouteResult | null;
  selectedSource: RouterId;
  selectedDestination: RouterId;
  selectedAlgorithm: RoutingAlgorithmType;
  setSelectedSource: (id: RouterId) => void;
  setSelectedDestination: (id: RouterId) => void;
  setSelectedAlgorithm: (algo: RoutingAlgorithmType) => void;
  onCalculateRoute: () => void;
  onNavigateToTopology: () => void;
  onNavigateToComparison: () => void;
  onToggleLinkFail: (linkId: string) => void;
  loading: boolean;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  routers,
  links,
  currentRoute,
  selectedSource,
  selectedDestination,
  selectedAlgorithm,
  setSelectedSource,
  setSelectedDestination,
  setSelectedAlgorithm,
  onCalculateRoute,
  onNavigateToTopology,
  onNavigateToComparison,
  onToggleLinkFail,
  loading,
}) => {
  const activeLinksCount = links.filter((l) => l.status === 'active').length;
  const failedLinksCount = links.filter((l) => l.status === 'failed').length;
  const healthPercent = Math.round((activeLinksCount / links.length) * 100);

  const avgDelay = Math.round(
    links.filter((l) => l.status === 'active').reduce((acc, l) => acc + l.delayMs, 0) /
      Math.max(1, activeLinksCount)
  );

  return (
    <div className="space-y-6">
      {/* Top Banner: Operations Status & Network Condition */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-900 via-[#0D1527] to-slate-900 border border-slate-800 p-6 shadow-2xl">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="flex h-2.5 w-2.5 relative">
                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${failedLinksCount === 0 ? 'bg-emerald-400' : 'bg-rose-400'} opacity-75`}></span>
                <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${failedLinksCount === 0 ? 'bg-emerald-500' : 'bg-rose-500'}`}></span>
              </span>
              <span className="text-xs font-mono uppercase tracking-widest text-cyan-400 font-semibold">
                Network Operations Center • Live State
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Autonomous Mesh Routing Dashboard
            </h1>
            <p className="text-sm text-slate-300 max-w-2xl">
              Real-time monitoring and analysis of 5-node core topology. Simulating convergence,
              link failure rerouting, and comparing SPF vs Distance Vector algorithms.
            </p>
          </div>

          {/* Quick Metrics Badges */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="bg-slate-950/70 border border-slate-800 px-4 py-2.5 rounded-xl">
              <span className="text-[10px] font-mono text-slate-400 block uppercase">Health Index</span>
              <span className={`text-xl font-bold font-mono ${healthPercent === 100 ? 'text-emerald-400' : 'text-amber-400'}`}>
                {healthPercent}%
              </span>
            </div>
            <div className="bg-slate-950/70 border border-slate-800 px-4 py-2.5 rounded-xl">
              <span className="text-[10px] font-mono text-slate-400 block uppercase">Avg Link Latency</span>
              <span className="text-xl font-bold font-mono text-cyan-300">
                {avgDelay} ms
              </span>
            </div>
            <button
              onClick={onNavigateToTopology}
              className="px-4 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold text-xs font-mono transition-all shadow-glow-cyan flex items-center gap-1.5"
            >
              <span>Inspect Topology</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* 4 Stat Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Active Core Routers"
          value={`${routers.length} / 5`}
          subtext="R1, R2, R3, R4, R5 connected"
          icon={Server}
          variant="cyan"
          badge="100% Online"
        />

        <StatCard
          label="Inter-Router Links"
          value={`${activeLinksCount} / ${links.length}`}
          subtext={failedLinksCount > 0 ? `${failedLinksCount} Link(s) in Fail State` : 'All physical links healthy'}
          icon={Activity}
          variant={failedLinksCount === 0 ? 'emerald' : 'rose'}
          badge={failedLinksCount === 0 ? 'Fully Connected' : 'Degraded Redundancy'}
        />

        <StatCard
          label="Current Active Route"
          value={currentRoute?.success ? currentRoute.path.join(' ➔ ') : 'No Active Path'}
          subtext={currentRoute?.success ? `Cost: ${currentRoute.totalCost} • ${currentRoute.totalHops} Hops` : 'Select endpoints to calculate'}
          icon={Zap}
          variant={currentRoute?.success ? 'violet' : 'rose'}
          badge={currentRoute ? currentRoute.algorithm.toUpperCase() : 'STANDBY'}
        />

        <StatCard
          label="Route Execution Time"
          value={currentRoute ? `${currentRoute.executionTimeMs} ms` : '—'}
          subtext={currentRoute ? `${currentRoute.convergenceRounds} Convergence Passes` : 'Algorithm compute latency'}
          icon={Clock}
          variant="amber"
          badge="Fast Convergence"
        />
      </div>

      {/* Main Interactive Controls & Current Path Card */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Quick Route Dispatcher (lg:col-span-5) */}
        <div className="lg:col-span-5 bg-slate-900/80 rounded-2xl border border-slate-800 p-6 backdrop-blur-md shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Zap className="w-5 h-5 text-cyan-400" />
                <h3 className="font-bold text-base text-white">Route Calculation Engine</h3>
              </div>
              <span className="text-xs font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                Interactive
              </span>
            </div>

            {/* Select Source & Destination */}
            <div className="mt-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-mono uppercase text-slate-400 block mb-1.5">
                    Source Node
                  </label>
                  <select
                    value={selectedSource}
                    onChange={(e) => setSelectedSource(e.target.value as RouterId)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-emerald-400 font-mono font-bold focus:outline-none focus:border-emerald-500"
                  >
                    {routers.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.id} ({r.ipAddress})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-mono uppercase text-slate-400 block mb-1.5">
                    Destination Node
                  </label>
                  <select
                    value={selectedDestination}
                    onChange={(e) => setSelectedDestination(e.target.value as RouterId)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-violet-400 font-mono font-bold focus:outline-none focus:border-violet-500"
                  >
                    {routers.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.id} ({r.ipAddress})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Algorithm Picker */}
              <div>
                <label className="text-xs font-mono uppercase text-slate-400 block mb-1.5">
                  Routing Algorithm
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: 'dijkstra', name: "Dijkstra's SPF" },
                    { id: 'bellman-ford', name: 'Bellman-Ford' },
                    { id: 'distance-vector', name: 'Distance Vector' },
                    { id: 'link-state', name: 'Link State (OSPF)' },
                  ].map((algo) => (
                    <button
                      key={algo.id}
                      type="button"
                      onClick={() => setSelectedAlgorithm(algo.id as RoutingAlgorithmType)}
                      className={`px-3 py-2 rounded-xl text-xs font-medium text-left transition-all ${
                        selectedAlgorithm === algo.id
                          ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/50 shadow-glow-cyan/20'
                          : 'bg-slate-950/60 text-slate-400 border border-slate-800 hover:border-slate-700 hover:text-slate-200'
                      }`}
                    >
                      {algo.name}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-6 border-t border-slate-800/80 mt-6 space-y-2.5">
            <button
              onClick={onCalculateRoute}
              disabled={loading}
              className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-bold text-sm font-sans flex items-center justify-center gap-2 transition-all shadow-glow-cyan disabled:opacity-50"
            >
              {loading ? (
                <>
                  <span className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin"></span>
                  <span>Calculating Route...</span>
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 fill-current" />
                  <span>Compute Optimal Route</span>
                </>
              )}
            </button>

            <button
              onClick={onNavigateToComparison}
              className="w-full py-2.5 px-4 rounded-xl bg-slate-800/80 hover:bg-slate-800 text-slate-300 hover:text-white font-medium text-xs font-mono transition-all border border-slate-700/60 flex items-center justify-center gap-1.5"
            >
              <span>Compare All 4 Algorithms Side-by-Side</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Right Column: Path Analysis & Active Links Table (lg:col-span-7) */}
        <div className="lg:col-span-7 space-y-6">
          {/* Active Calculated Route Details */}
          {currentRoute?.success ? (
            <div className="bg-slate-900/80 rounded-2xl border border-cyan-500/30 p-6 backdrop-blur-md shadow-xl shadow-cyan-950/30">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-cyan-400" />
                  <h3 className="font-bold text-base text-white">Active Forwarding Path</h3>
                </div>
                <span className="text-xs font-mono px-2.5 py-0.5 rounded-full bg-cyan-950 text-cyan-300 border border-cyan-800">
                  {currentRoute.algorithm.toUpperCase()} RESULT
                </span>
              </div>

              {/* Hop Sequence Visual */}
              <div className="mt-4 flex flex-wrap items-center gap-2.5 p-3.5 rounded-xl bg-slate-950/70 border border-slate-800">
                {currentRoute.path.map((routerId, idx) => (
                  <React.Fragment key={routerId}>
                    <div className="flex items-center gap-1.5 bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-700">
                      <span className="text-xs font-mono font-bold text-cyan-300">{routerId}</span>
                      <span className="text-[10px] text-slate-500 font-mono">
                        {idx === 0 ? '(SRC)' : idx === currentRoute.path.length - 1 ? '(DST)' : `(HOP ${idx})`}
                      </span>
                    </div>
                    {idx < currentRoute.path.length - 1 && (
                      <ArrowRight className="w-4 h-4 text-cyan-400 animate-pulse" />
                    )}
                  </React.Fragment>
                ))}
              </div>

              {/* Metrics Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 text-center">
                <div className="bg-slate-950/50 p-2.5 rounded-xl border border-slate-800">
                  <span className="text-[10px] font-mono uppercase text-slate-400 block">Total Metric (Cost)</span>
                  <span className="text-lg font-bold font-mono text-cyan-400">{currentRoute.totalCost}</span>
                </div>
                <div className="bg-slate-950/50 p-2.5 rounded-xl border border-slate-800">
                  <span className="text-[10px] font-mono uppercase text-slate-400 block">Total Hops</span>
                  <span className="text-lg font-bold font-mono text-white">{currentRoute.totalHops}</span>
                </div>
                <div className="bg-slate-950/50 p-2.5 rounded-xl border border-slate-800">
                  <span className="text-[10px] font-mono uppercase text-slate-400 block">Cumulative Delay</span>
                  <span className="text-lg font-bold font-mono text-amber-300">{currentRoute.totalDelayMs} ms</span>
                </div>
                <div className="bg-slate-950/50 p-2.5 rounded-xl border border-slate-800">
                  <span className="text-[10px] font-mono uppercase text-slate-400 block">Bottleneck BW</span>
                  <span className="text-lg font-bold font-mono text-emerald-300">{currentRoute.bottleneckBandwidthMbps} Mbps</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-slate-900/80 rounded-2xl border border-rose-500/30 p-6 backdrop-blur-md shadow-xl text-center py-10">
              <AlertTriangle className="w-10 h-10 text-rose-400 mx-auto mb-2 animate-bounce" />
              <h4 className="text-base font-bold text-white">No Path Currently Available</h4>
              <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
                {currentRoute?.message || 'Link failures have partitioned the network or no calculation has been run yet.'}
              </p>
            </div>
          )}

          {/* Quick Physical Links Matrix */}
          <div className="bg-slate-900/80 rounded-2xl border border-slate-800 p-5 backdrop-blur-md">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="font-bold text-sm text-white">Physical Links & Failover Controls</h3>
              <span className="text-[11px] font-mono text-slate-400">Click button to toggle failure</span>
            </div>

            <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
              {links.map((link) => {
                const isFailed = link.status === 'failed';
                const isUsedInRoute = currentRoute?.links.includes(link.id);

                return (
                  <div
                    key={link.id}
                    className={`p-3 rounded-xl border transition-all flex items-center justify-between ${
                      isFailed
                        ? 'bg-rose-950/30 border-rose-500/40 text-rose-300'
                        : isUsedInRoute
                        ? 'bg-cyan-950/30 border-cyan-500/40 text-cyan-200'
                        : 'bg-slate-950/60 border-slate-800 text-slate-300'
                    }`}
                  >
                    <div>
                      <div className="font-mono font-bold text-xs flex items-center gap-1.5">
                        <span>{link.id}</span>
                        {isUsedInRoute && !isFailed && (
                          <span className="text-[9px] bg-cyan-500/20 text-cyan-300 px-1 rounded">ACTIVE</span>
                        )}
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                        Cost: {link.cost} • {link.delayMs}ms
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => onToggleLinkFail(link.id)}
                      className={`px-2 py-1 rounded text-[10px] font-mono font-semibold transition-all ${
                        isFailed
                          ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                          : 'bg-rose-600/80 hover:bg-rose-500 text-white'
                      }`}
                    >
                      {isFailed ? 'Restore' : 'Cut Link'}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
