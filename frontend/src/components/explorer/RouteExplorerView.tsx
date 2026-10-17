// src/components/explorer/RouteExplorerView.tsx
import React, { useState } from 'react';
import {
  GitBranch,
  Play,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  Server,
} from 'lucide-react';
import type {
  RouterId,
  RoutingAlgorithmType,
  RouteResult,
  RouterNodeData,
  NetworkLink,
  RoutingTable,
} from '../../types/network';
import { generateRoutingTable } from '../../services/routingEngine';

interface RouteExplorerViewProps {
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
  loading: boolean;
}

export const RouteExplorerView: React.FC<RouteExplorerViewProps> = ({
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
  loading,
}) => {
  const [inspectRouterTable, setInspectRouterTable] = useState<RouterId>(selectedSource);
  const [activeTab, setActiveTab] = useState<'traces' | 'routingTable'>('traces');

  // Compute live routing table for inspected router
  const currentRoutingTable: RoutingTable = generateRoutingTable(inspectRouterTable, links, routers);

  return (
    <div className="space-y-6">
      {/* Configuration Header Card */}
      <div className="bg-slate-900/90 rounded-2xl border border-slate-800 p-6 backdrop-blur-md shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-slate-800">
          <div>
            <div className="flex items-center gap-2">
              <GitBranch className="w-5 h-5 text-cyan-400" />
              <h2 className="text-xl font-bold text-white">Route Explorer & Protocol Tracer</h2>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Select endpoints, run the chosen shortest path engine, and step through intermediate relaxation passes.
            </p>
          </div>

          <button
            onClick={onCalculateRoute}
            disabled={loading}
            className="px-6 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-bold text-xs sm:text-sm font-sans flex items-center justify-center gap-2 transition-all shadow-glow-cyan disabled:opacity-50"
          >
            {loading ? (
              <>
                <span className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin"></span>
                <span>Computing...</span>
              </>
            ) : (
              <>
                <Play className="w-4 h-4 fill-current" />
                <span>Calculate Path</span>
              </>
            )}
          </button>
        </div>

        {/* Inputs Form */}
        <div className="mt-5 grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Source Selection */}
          <div className="bg-slate-950/60 p-3.5 rounded-xl border border-slate-800">
            <label className="text-[11px] font-mono uppercase text-slate-400 block mb-1.5 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
              Source Node
            </label>
            <select
              value={selectedSource}
              onChange={(e) => setSelectedSource(e.target.value as RouterId)}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-emerald-400 font-mono font-bold focus:outline-none focus:border-emerald-500"
            >
              {routers.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.id} — {r.ipAddress}
                </option>
              ))}
            </select>
          </div>

          {/* Destination Selection */}
          <div className="bg-slate-950/60 p-3.5 rounded-xl border border-slate-800">
            <label className="text-[11px] font-mono uppercase text-slate-400 block mb-1.5 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-violet-400"></span>
              Destination Node
            </label>
            <select
              value={selectedDestination}
              onChange={(e) => setSelectedDestination(e.target.value as RouterId)}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-violet-400 font-mono font-bold focus:outline-none focus:border-violet-500"
            >
              {routers.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.id} — {r.ipAddress}
                </option>
              ))}
            </select>
          </div>

          {/* Routing Algorithm */}
          <div className="bg-slate-950/60 p-3.5 rounded-xl border border-slate-800">
            <label className="text-[11px] font-mono uppercase text-slate-400 block mb-1.5 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-cyan-400"></span>
              Routing Algorithm
            </label>
            <select
              value={selectedAlgorithm}
              onChange={(e) => setSelectedAlgorithm(e.target.value as RoutingAlgorithmType)}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-cyan-300 font-mono font-bold focus:outline-none focus:border-cyan-500"
            >
              <option value="dijkstra">Dijkstra's Algorithm (SPF)</option>
              <option value="bellman-ford">Bellman-Ford Algorithm</option>
              <option value="distance-vector">Distance Vector (Distributed)</option>
              <option value="link-state">Link State Protocol (OSPF)</option>
              <option value="proposed-famm-rs">FAMM-RS (Proposed Multi-Metric & Hysteresis)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Route Result Card */}
      {currentRoute && (
        <div className={`p-6 rounded-2xl border backdrop-blur-md shadow-xl transition-all ${
          currentRoute.success
            ? 'bg-slate-900/90 border-cyan-500/40 shadow-glow-cyan/20'
            : 'bg-slate-900/90 border-rose-500/40 shadow-glow-rose/20'
        }`}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800">
            <div className="flex items-center gap-2">
              {currentRoute.success ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
              ) : (
                <AlertCircle className="w-5 h-5 text-rose-400" />
              )}
              <h3 className="font-bold text-base text-white">
                {currentRoute.success
                  ? `Computed Shortest Path: ${currentRoute.path.join(' ➔ ')}`
                  : 'Path Resolution Failed'}
              </h3>
            </div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-1 rounded-full text-xs font-mono font-semibold bg-slate-800 text-cyan-300 border border-slate-700">
                {currentRoute.algorithm.toUpperCase()}
              </span>
              <span className="text-xs font-mono text-slate-400">
                Computed in {currentRoute.executionTimeMs} ms
              </span>
            </div>
          </div>

          {currentRoute.success ? (
            <div className="mt-5 space-y-4">
              {/* Hop Breakdown Timeline */}
              <div className="flex flex-wrap items-center gap-3 p-4 rounded-xl bg-slate-950/70 border border-slate-800">
                {currentRoute.path.map((routerId, idx) => {
                  const routerData = routers.find((r) => r.id === routerId);
                  const isSrc = idx === 0;
                  const isDst = idx === currentRoute.path.length - 1;

                  return (
                    <React.Fragment key={routerId}>
                      <div className={`p-3 rounded-xl border flex items-center gap-3 ${
                        isSrc
                          ? 'bg-emerald-950/40 border-emerald-500/50 text-emerald-300'
                          : isDst
                          ? 'bg-violet-950/40 border-violet-500/50 text-violet-300'
                          : 'bg-slate-900 border-slate-700 text-slate-200'
                      }`}>
                        <div className="font-mono">
                          <div className="font-extrabold text-sm flex items-center gap-1.5">
                            <Server className="w-4 h-4" />
                            <span>{routerId}</span>
                          </div>
                          <div className="text-[10px] text-slate-400">{routerData?.ipAddress}</div>
                        </div>
                        <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full ${
                          isSrc ? 'bg-emerald-500/20 text-emerald-400' : isDst ? 'bg-violet-500/20 text-violet-400' : 'bg-slate-800 text-slate-400'
                        }`}>
                          {isSrc ? 'SOURCE' : isDst ? 'DESTINATION' : `HOP ${idx}`}
                        </span>
                      </div>

                      {idx < currentRoute.path.length - 1 && (
                        <div className="flex flex-col items-center">
                          <span className="text-[10px] font-mono text-cyan-400">
                            {links.find((l) => l.id === currentRoute.links[idx])?.cost ? `+${links.find((l) => l.id === currentRoute.links[idx])?.cost} cost` : ''}
                          </span>
                          <ArrowRight className="w-5 h-5 text-cyan-400" />
                        </div>
                      )}
                    </React.Fragment>
                  );
                })}
              </div>

              {/* Metrics Summary Strip */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                <div className="bg-slate-950/50 p-3 rounded-xl border border-slate-800 text-center">
                  <span className="text-[10px] font-mono uppercase text-slate-400 block">Total Metric Cost</span>
                  <span className="text-xl font-bold font-mono text-cyan-400">{currentRoute.totalCost}</span>
                </div>
                <div className="bg-slate-950/50 p-3 rounded-xl border border-slate-800 text-center">
                  <span className="text-[10px] font-mono uppercase text-slate-400 block">Total Hop Count</span>
                  <span className="text-xl font-bold font-mono text-white">{currentRoute.totalHops}</span>
                </div>
                <div className="bg-slate-950/50 p-3 rounded-xl border border-slate-800 text-center">
                  <span className="text-[10px] font-mono uppercase text-slate-400 block">Estimated Delay</span>
                  <span className="text-xl font-bold font-mono text-amber-300">{currentRoute.totalDelayMs} ms</span>
                </div>
                <div className="bg-slate-950/50 p-3 rounded-xl border border-slate-800 text-center">
                  <span className="text-[10px] font-mono uppercase text-slate-400 block">Min Bandwidth</span>
                  <span className="text-xl font-bold font-mono text-emerald-300">{currentRoute.bottleneckBandwidthMbps} Mbps</span>
                </div>
                <div className="bg-slate-950/50 p-3 rounded-xl border border-slate-800 text-center">
                  <span className="text-[10px] font-mono uppercase text-slate-400 block">Convergence Passes</span>
                  <span className="text-xl font-bold font-mono text-purple-400">{currentRoute.convergenceRounds}</span>
                </div>
              </div>

              {/* FAMM-RS Research Metrics Strip if present */}
              {(currentRoute.stabilityAction || currentRoute.linkBreakdowns) && (
                <div className="mt-4 p-4 rounded-xl bg-slate-950/70 border border-cyan-800/60">
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-bold text-cyan-400 uppercase tracking-wider">
                        FAMM-RS Multi-Metric & Stability Analysis
                      </span>
                      {currentRoute.stabilityAction && (
                        <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-bold uppercase ${
                          currentRoute.stabilityAction === 'EMERGENCY_FAILOVER'
                            ? 'bg-amber-500/20 text-amber-300 border border-amber-600'
                            : currentRoute.stabilityAction === 'SIGNIFICANT_IMPROVEMENT_SWITCH'
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-600'
                            : 'bg-blue-500/20 text-blue-300 border border-blue-600'
                        }`}>
                          {currentRoute.stabilityAction.replace(/_/g, ' ')}
                        </span>
                      )}
                    </div>
                    {currentRoute.switchReason && (
                      <span className="text-xs text-slate-400 font-mono italic">
                        {currentRoute.switchReason}
                      </span>
                    )}
                  </div>

                  {currentRoute.linkBreakdowns && currentRoute.linkBreakdowns.length > 0 && (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs font-mono text-slate-300">
                        <thead className="bg-slate-900 text-[10px] text-slate-400 uppercase">
                          <tr>
                            <th className="py-1.5 px-2">Link</th>
                            <th className="py-1.5 px-2">Bandwidth Penalty</th>
                            <th className="py-1.5 px-2">Delay Penalty</th>
                            <th className="py-1.5 px-2">Congestion Penalty</th>
                            <th className="py-1.5 px-2">Risk Penalty</th>
                            <th className="py-1.5 px-2 text-right">Composite Cost</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/60">
                          {currentRoute.linkBreakdowns.map((bd, i) => (
                            <tr key={i} className="hover:bg-slate-900/40">
                              <td className="py-1 px-2 font-bold text-cyan-300">{bd.link_id}</td>
                              <td className="py-1 px-2 text-emerald-400">{(bd.weight_bw * bd.bandwidth_penalty).toFixed(3)}</td>
                              <td className="py-1 px-2 text-amber-400">{(bd.weight_delay * bd.delay_penalty).toFixed(3)}</td>
                              <td className="py-1 px-2 text-rose-400">{(bd.weight_congestion * bd.congestion_penalty).toFixed(3)}</td>
                              <td className="py-1 px-2 text-purple-400">{(bd.weight_risk * bd.risk_penalty).toFixed(3)}</td>
                              <td className="py-1 px-2 text-right font-bold text-white">{bd.total_cost.toFixed(4)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="mt-4 p-4 rounded-xl bg-rose-950/30 border border-rose-900/60 text-xs text-rose-300 font-mono">
              {currentRoute.message} Please check link states in the Failure Simulation tab or topology view.
            </div>
          )}
        </div>
      )}

      {/* Bottom Inspection: Step Traces vs Routing Table */}
      <div className="bg-slate-900/90 rounded-2xl border border-slate-800 p-6 backdrop-blur-md shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('traces')}
              className={`px-4 py-2 rounded-xl text-xs font-mono font-semibold transition-all ${
                activeTab === 'traces'
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/50'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Step-by-Step Algorithm Trace ({currentRoute?.traces.length || 0} Steps)
            </button>
            <button
              onClick={() => setActiveTab('routingTable')}
              className={`px-4 py-2 rounded-xl text-xs font-mono font-semibold transition-all ${
                activeTab === 'routingTable'
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/50'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Router Forwarding / Routing Table
            </button>
          </div>

          {activeTab === 'routingTable' && (
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono text-slate-400">Inspect Vantage Node:</span>
              <select
                value={inspectRouterTable}
                onChange={(e) => setInspectRouterTable(e.target.value as RouterId)}
                className="bg-slate-950 border border-slate-700 text-cyan-300 font-mono text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-cyan-500"
              >
                {routers.map((r) => (
                  <option key={r.id} value={r.id}>
                    Router {r.id}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* View 1: Step-by-Step Algorithm Traces */}
        {activeTab === 'traces' && (
          <div className="mt-5 overflow-x-auto">
            {currentRoute && currentRoute.traces.length > 0 ? (
              <table className="w-full text-left font-mono text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 text-[11px] uppercase">
                    <th className="pb-3 pl-2">Step</th>
                    <th className="pb-3">Action Type</th>
                    <th className="pb-3">Step Explanation</th>
                    <th className="pb-3">Visited / In-Scope</th>
                    <th className="pb-3 text-right pr-2">Tentative Distances [R1..R5]</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-slate-300">
                  {currentRoute.traces.map((trace) => {
                    let badgeColor = 'bg-slate-800 text-slate-400';
                    if (trace.actionType === 'visit') badgeColor = 'bg-cyan-950 text-cyan-300 border border-cyan-800';
                    if (trace.actionType === 'relax') badgeColor = 'bg-amber-950 text-amber-300 border border-amber-800';
                    if (trace.actionType === 'update') badgeColor = 'bg-blue-950 text-blue-300 border border-blue-800';
                    if (trace.actionType === 'flood') badgeColor = 'bg-purple-950 text-purple-300 border border-purple-800';
                    if (trace.actionType === 'converge') badgeColor = 'bg-emerald-950 text-emerald-300 border border-emerald-800';

                    return (
                      <tr key={trace.step} className="hover:bg-slate-800/30 transition-colors">
                        <td className="py-2.5 pl-2 text-cyan-400 font-bold">#{trace.step}</td>
                        <td className="py-2.5">
                          <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-semibold ${badgeColor}`}>
                            {trace.actionType}
                          </span>
                        </td>
                        <td className="py-2.5 max-w-md font-sans text-xs text-slate-200">
                          {trace.description}
                        </td>
                        <td className="py-2.5 text-slate-400">
                          {trace.visited.join(', ') || 'None'}
                        </td>
                        <td className="py-2.5 text-right pr-2 font-mono text-[11px]">
                          {Object.entries(trace.tentativeCosts).map(([rId, cost]) => (
                            <span key={rId} className="inline-block ml-2">
                              <span className="text-slate-500">{rId}:</span>{' '}
                              <span className={cost === Infinity ? 'text-slate-600' : 'text-cyan-300 font-semibold'}>
                                {cost === Infinity ? '∞' : cost}
                              </span>
                            </span>
                          ))}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              <div className="text-center py-8 text-xs text-slate-400">
                Click "Calculate Path" above to execute and trace algorithm steps.
              </div>
            )}
          </div>
        )}

        {/* View 2: Router Routing Table */}
        {activeTab === 'routingTable' && (
          <div className="mt-5 overflow-x-auto">
            <div className="mb-3 text-xs text-slate-400 font-mono">
              Displaying Forwarding Information Base (FIB) computed from Router{' '}
              <strong className="text-cyan-400 font-bold">{inspectRouterTable}</strong>'s perspective:
            </div>
            <table className="w-full text-left font-mono text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 text-[11px] uppercase">
                  <th className="pb-3 pl-2">Destination Network</th>
                  <th className="pb-3">Next Hop Router</th>
                  <th className="pb-3">Egress Interface</th>
                  <th className="pb-3">Routing Metric</th>
                  <th className="pb-3">Protocol Origin</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-300">
                {currentRoutingTable.entries.map((entry) => (
                  <tr key={entry.destination} className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-3 pl-2 font-bold text-white flex items-center gap-2">
                      <Server className="w-3.5 h-3.5 text-cyan-400" />
                      <span>{entry.destination}</span>
                    </td>
                    <td className="py-3">
                      <span className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                        entry.nextHop === 'DIRECT'
                          ? 'bg-slate-800 text-slate-300'
                          : 'bg-cyan-950 text-cyan-300 border border-cyan-800'
                      }`}>
                        {entry.nextHop}
                      </span>
                    </td>
                    <td className="py-3 text-slate-300">{entry.interfaceName}</td>
                    <td className="py-3">
                      <span className={`font-bold ${entry.metric === Infinity ? 'text-rose-400' : 'text-emerald-400'}`}>
                        {entry.metric === Infinity ? 'UNREACHABLE (∞)' : entry.metric}
                      </span>
                    </td>
                    <td className="py-3 text-slate-400">{entry.protocol}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
