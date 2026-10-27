// src/components/comparison/AlgorithmComparisonView.tsx
import React, { useMemo } from 'react';
import {
  Zap,
  AlertTriangle,
  Scale,
} from 'lucide-react';
import type {
  RouterId,
  RouterNodeData,
  NetworkLink,
} from '../../types/network';
import { compareAllAlgorithms } from '../../services/routingEngine';

interface AlgorithmComparisonViewProps {
  routers: RouterNodeData[];
  links: NetworkLink[];
  selectedSource: RouterId;
  selectedDestination: RouterId;
  setSelectedSource: (id: RouterId) => void;
  setSelectedDestination: (id: RouterId) => void;
}

export const AlgorithmComparisonView: React.FC<AlgorithmComparisonViewProps> = ({
  routers,
  links,
  selectedSource,
  selectedDestination,
  setSelectedSource,
  setSelectedDestination,
}) => {
  // Compare all 4 algorithms with current topology state
  const comparisonResults = useMemo(() => {
    return compareAllAlgorithms(selectedSource, selectedDestination, links, routers);
  }, [selectedSource, selectedDestination, links, routers]);

  const chartColors = ['#06B6D4', '#3B82F6', '#8B5CF6', '#10B981'];

  return (
    <div className="space-y-6">
      {/* Header & Source/Destination Selector */}
      <div className="bg-slate-900/90 rounded-2xl border border-slate-800 p-6 backdrop-blur-md shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-slate-800">
          <div>
            <div className="flex items-center gap-2">
              <Scale className="w-5 h-5 text-cyan-400" />
              <h2 className="text-xl font-bold text-white">Multi-Algorithm Benchmark & Comparison</h2>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Simultaneous evaluation of Dijkstra, Bellman-Ford, Distributed Distance Vector, and OSPF Link-State on current topology.
            </p>
          </div>

          {/* Quick Endpoint Switcher */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800 text-xs font-mono">
              <span className="text-slate-400">Src:</span>
              <select
                value={selectedSource}
                onChange={(e) => setSelectedSource(e.target.value as RouterId)}
                className="bg-transparent text-emerald-400 font-bold focus:outline-none cursor-pointer"
              >
                {routers.map((r) => (
                  <option key={r.id} value={r.id} className="bg-slate-900 text-white">
                    {r.id}
                  </option>
                ))}
              </select>
            </div>

            <span className="text-slate-500 font-mono">➔</span>

            <div className="flex items-center gap-1.5 bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800 text-xs font-mono">
              <span className="text-slate-400">Dst:</span>
              <select
                value={selectedDestination}
                onChange={(e) => setSelectedDestination(e.target.value as RouterId)}
                className="bg-transparent text-violet-400 font-bold focus:outline-none cursor-pointer"
              >
                {routers.map((r) => (
                  <option key={r.id} value={r.id} className="bg-slate-900 text-white">
                    {r.id}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="mt-4 text-xs font-mono text-cyan-300 flex items-center gap-2">
          <Zap className="w-4 h-4 text-cyan-400" />
          <span>Active Test Vector: Evaluating route from {selectedSource} to {selectedDestination} across all engines.</span>
        </div>
      </div>

      {/* 4 Cards Side-by-Side Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {comparisonResults.map((item, index) => {
          const accentColor = chartColors[index % chartColors.length];

          return (
            <div
              key={item.algorithm}
              className="bg-slate-900/85 rounded-2xl border border-slate-800 p-5 backdrop-blur-md shadow-xl flex flex-col justify-between hover:border-slate-700 transition-all"
            >
              <div>
                {/* Header */}
                <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                  <div>
                    <h3 className="font-bold text-sm text-white">{item.name}</h3>
                    <span className="text-[10px] font-mono text-cyan-400 block mt-0.5">
                      {item.protocolBasis}
                    </span>
                  </div>
                  <span
                    className="w-3 h-3 rounded-full shadow-lg"
                    style={{ backgroundColor: accentColor }}
                  />
                </div>

                {/* Path Calculated */}
                <div className="mt-4 bg-slate-950/70 p-3 rounded-xl border border-slate-800">
                  <span className="text-[10px] font-mono uppercase text-slate-400 block mb-1">
                    Path Result
                  </span>
                  {item.status === 'success' ? (
                    <div className="text-xs font-mono font-bold text-white flex items-center gap-1.5 flex-wrap">
                      {item.path.join(' ➔ ')}
                    </div>
                  ) : (
                    <div className="text-xs font-mono text-rose-400 font-bold flex items-center gap-1">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      <span>NO PATH (Partition)</span>
                    </div>
                  )}
                </div>

                {/* Performance Metrics Table */}
                <div className="mt-4 space-y-2 text-xs font-mono">
                  <div className="flex justify-between py-1 border-b border-slate-800/60">
                    <span className="text-slate-400">Total Metric Cost:</span>
                    <span className="font-bold text-cyan-300">
                      {item.totalCost === Infinity ? '∞' : item.totalCost}
                    </span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-800/60">
                    <span className="text-slate-400">Total Hops:</span>
                    <span className="text-white font-bold">{item.totalHops}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-800/60">
                    <span className="text-slate-400">Estimated Delay:</span>
                    <span className="text-amber-300 font-bold">{item.totalDelayMs} ms</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-800/60">
                    <span className="text-slate-400">Execution Latency:</span>
                    <span className="text-emerald-400 font-bold">{item.executionTimeMs} ms</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-800/60">
                    <span className="text-slate-400">Convergence Passes:</span>
                    <span className="text-purple-400 font-bold">{item.convergenceRounds}</span>
                  </div>
                </div>

                {/* Complexities */}
                <div className="mt-4 bg-slate-950/40 p-2.5 rounded-lg border border-slate-800/60 text-[11px] font-mono space-y-1">
                  <div>
                    <span className="text-slate-500">Time: </span>
                    <span className="text-slate-300">{item.timeComplexity}</span>
                  </div>
                  <div>
                    <span className="text-slate-500">Space: </span>
                    <span className="text-slate-300">{item.spaceComplexity}</span>
                  </div>
                </div>
              </div>

              {/* Key Architectural Feature Note */}
              <div className="mt-4 pt-3 border-t border-slate-800 text-[11px] text-slate-400 leading-snug">
                {item.keyFeature}
              </div>
            </div>
          );
        })}
      </div>

    </div>
  );
};
