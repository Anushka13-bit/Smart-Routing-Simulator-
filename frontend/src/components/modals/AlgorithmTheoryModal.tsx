// src/components/modals/AlgorithmTheoryModal.tsx
import React, { useState } from 'react';
import {
  X,
  BookOpen,
  CheckCircle2,
  AlertTriangle,
  Code,
} from 'lucide-react';
import { ALGORITHM_DESCRIPTIONS } from '../../services/mockData';
import type { RoutingAlgorithmType } from '../../types/network';

interface AlgorithmTheoryModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AlgorithmTheoryModal: React.FC<AlgorithmTheoryModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [selectedAlgo, setSelectedAlgo] = useState<RoutingAlgorithmType>('dijkstra');

  if (!isOpen) return null;

  const currentInfo = ALGORITHM_DESCRIPTIONS[selectedAlgo];

  const pseudocodeMap: Record<RoutingAlgorithmType, string> = {
    dijkstra: `function Dijkstra(Graph, source):
    dist[source] = 0
    create priority_queue Q
    for each vertex v in Graph:
        if v != source:
            dist[v] = infinity
            prev[v] = undefined
        Q.insert(v, dist[v])

    while Q is not empty:
        u = Q.extract_min()
        for each unvisited neighbor v of u:
            alt = dist[u] + cost(u, v)
            if alt < dist[v]:
                dist[v] = alt
                prev[v] = u
                Q.decrease_priority(v, alt)
    return dist, prev`,
    'bellman-ford': `function BellmanFord(Graph, source):
    // Step 1: Initialize distances
    for each vertex v in Graph:
        dist[v] = infinity
        prev[v] = undefined
    dist[source] = 0

    // Step 2: Relax edges repeatedly |V| - 1 times
    for i from 1 to |V| - 1:
        for each edge (u, v) in Graph.edges:
            if dist[u] + weight(u, v) < dist[v]:
                dist[v] = dist[u] + weight(u, v)
                prev[v] = u

    // Step 3: Check for negative-weight cycles
    for each edge (u, v) in Graph.edges:
        if dist[u] + weight(u, v) < dist[v]:
            error "Graph contains a negative-weight cycle"
    return dist, prev`,
    'distance-vector': `// Bellman-Ford distributed equation at node x:
// Dx(y) = min_v { c(x,v) + Dv(y) }

Initialization at each node x:
for all destinations y:
    Dx(y) = c(x,y)  // infinity if not direct neighbor
Send distance vector Dx to all neighbors

Loop forever:
    Wait until link cost c(x,v) changes or receive update from neighbor v
    for each destination y:
        Dx(y) = min_v { c(x,v) + Dv(y) }
    if Dx(y) changed for any destination:
        Send new distance vector Dx to all neighbors`,
    'link-state': `// OSPF / Link State Two-Phase Process:
Phase 1: Reliable Flooding
    1. Each node discovers neighbors using Hello packets.
    2. Constructs Link State Advertisement (LSA): [Node ID, (Neighbor, Metric)...]
    3. Reliable flooding of LSA using Link State Update (LSU) packets.
    4. All nodes achieve an identical Link State Database (LSDB).

Phase 2: Shortest Path First (SPF) Calculation
    Each node independently runs Dijkstra's algorithm using the LSDB as graph.
    Computes Shortest Path Tree (SPT) rooted at itself.
    Populates forwarding table: Next-Hop for each destination prefix.`,
    'proposed-famm-rs': `// FAMM-RS: Failure-Aware Multi-Metric Routing with Route Stability Hysteresis
1. Composite Link Cost Function:
    c_FAMM(e) = w_bw * (BW_ref / bw(e))
              + w_delay * (delay(e) / Delay_max)
              + w_cong * (congestion(e) / 100)^2
              + w_risk * simulated_risk(e)

2. Optimal Candidate Computation:
    R_cand = argmin_{P in Paths(S, D)} sum_{e in P} c_FAMM(e)

3. Route-Stability Hysteresis Control:
    if active_route is None or active_route is broken (link down):
        active_route = R_cand   // Emergency failover immediate switch
    else:
        cost_curr = Cost(active_route)
        cost_cand = Cost(R_cand)
        Delta_cost = cost_curr - cost_cand
        
        // Switch ONLY if relative improvement exceeds hysteresis threshold theta
        if (Delta_cost / cost_curr) > theta and Delta_cost >= delta_min:
            active_route = R_cand   // Significant improvement: switch route
        else:
            maintain active_route   // Dampen control-plane flap / oscillation`,
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-[#0D1322] border border-slate-700/80 rounded-2xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-800 bg-slate-900/60">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Routing Protocols & Algorithm Theory</h2>
              <p className="text-xs text-slate-400 font-mono">
                Computer Networks (CS304) • Principles, Convergence & Complexity
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Algorithm Tabs */}
        <div className="flex items-center px-6 pt-4 border-b border-slate-800/80 gap-2 overflow-x-auto bg-slate-950/40">
          {(['dijkstra', 'bellman-ford', 'distance-vector', 'link-state', 'proposed-famm-rs'] as RoutingAlgorithmType[]).map((algoKey) => (
            <button
              key={algoKey}
              onClick={() => setSelectedAlgo(algoKey)}
              className={`pb-3 px-3 text-xs font-mono font-semibold transition-all border-b-2 whitespace-nowrap ${
                selectedAlgo === algoKey
                  ? 'border-cyan-400 text-cyan-300'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              {ALGORITHM_DESCRIPTIONS[algoKey].name}
            </button>
          ))}
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 text-sm">
          {/* Header Info Banner */}
          <div className="bg-slate-900/80 p-4 rounded-xl border border-slate-800">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
              <span className="text-xs font-mono text-cyan-400 font-bold uppercase tracking-wider">
                {currentInfo.category}
              </span>
              <span className="text-xs font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                Protocols: {currentInfo.protocol}
              </span>
            </div>
            <p className="text-slate-300 text-xs sm:text-sm leading-relaxed">{currentInfo.summary}</p>

            <div className="mt-3 flex flex-wrap gap-4 pt-3 border-t border-slate-800 text-xs font-mono">
              <div>
                <span className="text-slate-400">Time Complexity: </span>
                <span className="text-cyan-300 font-bold">{currentInfo.complexity}</span>
              </div>
              <div>
                <span className="text-slate-400">Space Complexity: </span>
                <span className="text-purple-300 font-bold">{currentInfo.spaceComplexity}</span>
              </div>
            </div>
          </div>

          {/* Pseudocode Block */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Code className="w-4 h-4 text-cyan-400" />
              <h4 className="font-bold text-xs uppercase tracking-wider text-slate-300 font-mono">
                Formal Pseudocode / Protocol Specification
              </h4>
            </div>
            <pre className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-cyan-200 overflow-x-auto leading-relaxed">
              <code>{pseudocodeMap[selectedAlgo]}</code>
            </pre>
          </div>

          {/* Pros & Cons Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-emerald-950/20 border border-emerald-500/30 p-4 rounded-xl">
              <h4 className="font-bold text-xs uppercase tracking-wider text-emerald-400 font-mono mb-2.5 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" />
                <span>Advantages & Strengths</span>
              </h4>
              <ul className="space-y-1.5 text-xs text-slate-300">
                {currentInfo.pros.map((pro: string, i: number) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="text-emerald-400 font-bold">•</span>
                    <span>{pro}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="bg-rose-950/20 border border-rose-500/30 p-4 rounded-xl">
              <h4 className="font-bold text-xs uppercase tracking-wider text-rose-400 font-mono mb-2.5 flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4" />
                <span>Limitations & Trade-offs</span>
              </h4>
              <ul className="space-y-1.5 text-xs text-slate-300">
                {currentInfo.cons.map((con: string, i: number) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="text-rose-400 font-bold">•</span>
                    <span>{con}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-900/60 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-medium text-xs font-mono transition-colors"
          >
            Close Theory Guide
          </button>
        </div>
      </div>
    </div>
  );
};
