// src/components/history/ExperimentHistoryView.tsx
import React, { useState } from 'react';
import {
  History,
  Trash2,
  Play,
  Filter,
  FileJson,
  FileSpreadsheet,
} from 'lucide-react';
import type { ExperimentRecord } from '../../types/network';

interface ExperimentHistoryViewProps {
  history: ExperimentRecord[];
  onClearHistory: () => void;
  onReplayExperiment: (record: ExperimentRecord) => void;
}

export const ExperimentHistoryView: React.FC<ExperimentHistoryViewProps> = ({
  history,
  onClearHistory,
  onReplayExperiment,
}) => {
  const [filterAlgorithm, setFilterAlgorithm] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  const filteredHistory = history.filter((item) => {
    if (filterAlgorithm !== 'all' && item.algorithm !== filterAlgorithm) return false;
    if (filterStatus !== 'all' && item.status !== filterStatus) return false;
    return true;
  });

  // Export as JSON
  const handleExportJSON = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(history, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `routing_simulation_history_${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  // Export as CSV
  const handleExportCSV = () => {
    const headers = ['ID', 'Timestamp', 'Algorithm', 'Source', 'Destination', 'Path', 'TotalCost', 'Hops', 'DelayMs', 'Status', 'Mode'];
    const rows = history.map((item) => [
      item.id,
      item.timestamp,
      item.algorithm,
      item.source,
      item.destination,
      `"${item.path.join(' -> ')}"`,
      item.totalCost,
      item.totalHops,
      item.totalDelayMs,
      item.status,
      item.mode,
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', encodedUri);
    downloadAnchor.setAttribute('download', `routing_simulation_history_${Date.now()}.csv`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-slate-900/90 rounded-2xl border border-slate-800 p-6 backdrop-blur-md shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
          <div>
            <div className="flex items-center gap-2">
              <History className="w-5 h-5 text-cyan-400" />
              <h2 className="text-xl font-bold text-white">Simulation Log & Experiment History</h2>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Review and audit previous routing iterations, compare failover states, and export session logs for your project report.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleExportJSON}
              disabled={history.length === 0}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-mono disabled:opacity-40 transition-all border border-slate-700"
            >
              <FileJson className="w-4 h-4 text-cyan-400" />
              <span>Export JSON</span>
            </button>

            <button
              onClick={handleExportCSV}
              disabled={history.length === 0}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-mono disabled:opacity-40 transition-all border border-slate-700"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
              <span>Export CSV</span>
            </button>

            <button
              onClick={onClearHistory}
              disabled={history.length === 0}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-rose-950/60 hover:bg-rose-900 text-rose-300 text-xs font-mono disabled:opacity-40 transition-all border border-rose-800/60"
            >
              <Trash2 className="w-4 h-4 text-rose-400" />
              <span>Clear History</span>
            </button>
          </div>
        </div>

        {/* Filters Strip */}
        <div className="mt-4 flex flex-wrap items-center gap-4 text-xs font-mono">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-500" />
            <span className="text-slate-400">Algorithm:</span>
            <select
              value={filterAlgorithm}
              onChange={(e) => setFilterAlgorithm(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1 text-cyan-300 focus:outline-none focus:border-cyan-500"
            >
              <option value="all">All Algorithms</option>
              <option value="dijkstra">Dijkstra</option>
              <option value="bellman-ford">Bellman-Ford</option>
              <option value="distance-vector">Distance Vector</option>
              <option value="link-state">Link State</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-slate-400">Status:</span>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1 text-cyan-300 focus:outline-none focus:border-cyan-500"
            >
              <option value="all">All Statuses</option>
              <option value="SUCCESS">SUCCESS</option>
              <option value="NO_ROUTE">NO_ROUTE</option>
            </select>
          </div>

          <div className="text-slate-500 ml-auto">
            Showing {filteredHistory.length} of {history.length} records
          </div>
        </div>
      </div>

      {/* History Table */}
      <div className="bg-slate-900/90 rounded-2xl border border-slate-800 p-6 backdrop-blur-md shadow-xl overflow-x-auto">
        {filteredHistory.length > 0 ? (
          <table className="w-full text-left font-mono text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 text-[11px] uppercase">
                <th className="pb-3 pl-2">Timestamp</th>
                <th className="pb-3">Algorithm</th>
                <th className="pb-3">Endpoints</th>
                <th className="pb-3">Path Computed</th>
                <th className="pb-3 text-center">Cost</th>
                <th className="pb-3 text-center">Hops</th>
                <th className="pb-3 text-center">Delay</th>
                <th className="pb-3 text-center">Mode</th>
                <th className="pb-3 text-center">Status</th>
                <th className="pb-3 text-right pr-2">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {filteredHistory.map((item) => (
                <tr key={item.id} className="hover:bg-slate-800/30 transition-colors">
                  <td className="py-3 pl-2 text-slate-400 text-[11px]">
                    {new Date(item.timestamp).toLocaleTimeString()}
                  </td>
                  <td className="py-3">
                    <span className="font-bold text-white uppercase text-[11px]">
                      {item.algorithm}
                    </span>
                  </td>
                  <td className="py-3 text-cyan-300 font-bold">
                    {item.source} ➔ {item.destination}
                  </td>
                  <td className="py-3 font-semibold text-slate-200">
                    {item.path.length > 0 ? item.path.join(' ➔ ') : 'None'}
                  </td>
                  <td className="py-3 text-center text-cyan-400 font-bold">
                    {item.totalCost === Infinity ? '∞' : item.totalCost}
                  </td>
                  <td className="py-3 text-center text-white">{item.totalHops}</td>
                  <td className="py-3 text-center text-amber-300">{item.totalDelayMs} ms</td>
                  <td className="py-3 text-center">
                    <span className="text-[10px] uppercase font-bold text-slate-400 px-1.5 py-0.5 rounded bg-slate-800">
                      {item.mode}
                    </span>
                  </td>
                  <td className="py-3 text-center">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      item.status === 'SUCCESS'
                        ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                        : 'bg-rose-950 text-rose-300 border border-rose-800'
                    }`}>
                      {item.status}
                    </span>
                  </td>
                  <td className="py-3 text-right pr-2">
                    <button
                      onClick={() => onReplayExperiment(item)}
                      className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-300 text-xs font-medium transition-colors inline-flex items-center gap-1"
                      title="Load this route onto the active topology"
                    >
                      <Play className="w-3 h-3 fill-current" />
                      <span>Replay</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="text-center py-12 text-slate-400 text-xs">
            <History className="w-8 h-8 text-slate-600 mx-auto mb-2" />
            <p>No experiment runs recorded yet.</p>
            <p className="text-[11px] text-slate-500 mt-1">
              Calculate routes or simulate link cuts to generate audit records.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
