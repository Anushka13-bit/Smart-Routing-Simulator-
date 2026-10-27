// src/components/metrics/LinkMetricsView.tsx
import React, { useState } from 'react';
import {
  Gauge,
  RotateCcw,
  Sparkles,
  Zap,
  ArrowRight,
  TrendingUp,
} from 'lucide-react';
import type {
  NetworkLink,
  RouteResult,
  RouterId,
} from '../../types/network';

interface LinkMetricsViewProps {
  links: NetworkLink[];
  onUpdateMetric: (linkId: string, updates: Partial<NetworkLink>) => void;
  onResetMetrics: () => void;
  currentRoute: RouteResult | null;
  selectedSource: RouterId;
  selectedDestination: RouterId;
}

export const LinkMetricsView: React.FC<LinkMetricsViewProps> = ({
  links,
  onUpdateMetric,
  onResetMetrics,
  currentRoute,
  selectedSource,
  selectedDestination,
}) => {
  const [selectedPreset, setSelectedPreset] = useState<string>('default');

  const presets = [
    {
      id: 'default',
      name: 'Default Balanced Mesh',
      desc: 'Standard gigabit campus links with low latency (3–10ms) and metric weights (2–7).',
      apply: () => onResetMetrics(),
    },
    {
      id: 'congested-r3',
      name: 'Heavy Congestion on R1-R3',
      desc: 'Simulates peak load on primary link R1-R3: metric weight increased to 12, delay to 35ms.',
      apply: () => {
        onUpdateMetric('R1-R3', { cost: 12, delayMs: 35, congestionPercent: 92 });
      },
    },
    {
      id: 'high-speed-bypass',
      name: '10G Fiber Upgrade on R1-R4-R5',
      desc: 'Secondary bypass upgraded to 10 Gbps fiber: lower metric (cost 1 each, 2ms latency) making it the preferred route!',
      apply: () => {
        onUpdateMetric('R1-R4', { cost: 1, delayMs: 2, bandwidthMbps: 10000 });
        onUpdateMetric('R4-R5', { cost: 1, delayMs: 2, bandwidthMbps: 10000 });
      },
    },
    {
      id: 'satellite-r4',
      name: 'Geostationary Satellite Link on R1-R4',
      desc: 'Simulates high latency space link on R1-R4: latency increased to 120ms, bandwidth limited to 100Mbps.',
      apply: () => {
        onUpdateMetric('R1-R4', { cost: 15, delayMs: 120, bandwidthMbps: 100 });
      },
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-slate-900/90 rounded-2xl border border-slate-800 p-6 backdrop-blur-md shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
          <div>
            <div className="flex items-center gap-2">
              <Gauge className="w-5 h-5 text-cyan-400" />
              <h2 className="text-xl font-bold text-white">Link Metrics & QoS Parameter Tuning</h2>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Adjust metric costs, delay, and bandwidth. Observe how dynamic cost calculations steer packets.
            </p>
          </div>

          <button
            onClick={onResetMetrics}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-mono font-medium border border-slate-700 transition-all"
          >
            <RotateCcw className="w-4 h-4 text-cyan-400" />
            <span>Reset All to Defaults</span>
          </button>
        </div>

        {/* Current Active Path Notification */}
        {currentRoute?.success && (
          <div className="mt-4 p-3 bg-slate-950/80 rounded-xl border border-slate-800 flex items-center justify-between text-xs font-mono">
            <div className="flex items-center gap-2 text-slate-300">
              <Zap className="w-4 h-4 text-cyan-400" />
              <span>
                Active Route ({selectedSource} ➔ {selectedDestination}):{' '}
                <strong className="text-cyan-300">{currentRoute.path.join(' ➔ ')}</strong>
              </span>
            </div>
            <span className="text-slate-400">
              Total Cost: <strong className="text-cyan-400">{currentRoute.totalCost}</strong> •{' '}
              Delay: <strong className="text-amber-300">{currentRoute.totalDelayMs}ms</strong>
            </span>
          </div>
        )}
      </div>

      {/* Metric Preset Scenarios */}
      <div className="bg-slate-900/90 rounded-2xl border border-slate-800 p-6 backdrop-blur-md shadow-xl">
        <div className="flex items-center gap-2 mb-4">
          <Sparkles className="w-5 h-5 text-amber-400" />
          <h3 className="font-bold text-base text-white">Traffic & Quality-of-Service (QoS) Scenarios</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {presets.map((preset) => (
            <div
              key={preset.id}
              className={`p-4 rounded-xl border flex flex-col justify-between transition-all ${
                selectedPreset === preset.id
                  ? 'border-cyan-500/50 bg-cyan-950/20 shadow-glow-cyan/20'
                  : 'border-slate-800 bg-slate-950/60 hover:border-slate-700'
              }`}
            >
              <div>
                <h4 className="font-bold text-xs text-white flex items-center gap-1.5">
                  <TrendingUp className="w-3.5 h-3.5 text-cyan-400" />
                  <span>{preset.name}</span>
                </h4>
                <p className="text-[11px] text-slate-400 mt-1.5 leading-snug">{preset.desc}</p>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-800">
                <button
                  onClick={() => {
                    setSelectedPreset(preset.id);
                    preset.apply();
                  }}
                  className="w-full py-1.5 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-300 font-mono text-xs font-semibold transition-all flex items-center justify-center gap-1"
                >
                  <span>Apply Scenario</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Individual Link Sliders & Inputs Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {links.map((link) => {
          const isPartOfActiveRoute = currentRoute?.links.includes(link.id);

          return (
            <div
              key={link.id}
              className={`p-5 rounded-2xl border backdrop-blur-md shadow-xl transition-all ${
                isPartOfActiveRoute
                  ? 'bg-slate-900/90 border-cyan-500/40 shadow-glow-cyan/15'
                  : 'bg-slate-900/80 border-slate-800'
              }`}
            >
              {/* Card Header */}
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-base text-white">{link.id}</span>
                  <span className="text-xs font-mono text-slate-400">
                    ({link.source} ⟷ {link.target})
                  </span>
                </div>
                {isPartOfActiveRoute && (
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-950 text-cyan-300 border border-cyan-800 font-semibold">
                    IN ROUTE
                  </span>
                )}
              </div>

              {/* Sliders Form */}
              <div className="mt-4 space-y-4 text-xs font-mono">
                {/* 1. Cost Metric Slider */}
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-slate-400 flex items-center gap-1">
                      <span>Routing Metric Cost:</span>
                    </label>
                    <span className="text-cyan-400 font-bold text-sm">{link.cost}</span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="25"
                    step="1"
                    value={link.cost}
                    onChange={(e) => onUpdateMetric(link.id, { cost: parseInt(e.target.value) })}
                    className="w-full accent-cyan-400 cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-slate-600 mt-0.5">
                    <span>1 (Fast)</span>
                    <span>25 (High penalty)</span>
                  </div>
                </div>

                {/* 2. Delay Latency Slider */}
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-slate-400">Delay / Latency:</label>
                    <span className="text-amber-300 font-bold text-sm">{link.delayMs} ms</span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="100"
                    step="1"
                    value={link.delayMs}
                    onChange={(e) => onUpdateMetric(link.id, { delayMs: parseInt(e.target.value) })}
                    className="w-full accent-amber-400 cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-slate-600 mt-0.5">
                    <span>1 ms</span>
                    <span>100 ms</span>
                  </div>
                </div>

                {/* 3. Bandwidth Dropdown / Input */}
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-slate-400">Link Bandwidth:</label>
                    <span className="text-emerald-400 font-bold text-sm">{link.bandwidthMbps} Mbps</span>
                  </div>
                  <select
                    value={link.bandwidthMbps}
                    onChange={(e) => onUpdateMetric(link.id, { bandwidthMbps: parseInt(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-200 text-xs focus:outline-none focus:border-cyan-500"
                  >
                    <option value={100}>100 Mbps (FastEthernet)</option>
                    <option value={500}>500 Mbps (Metro Trunk)</option>
                    <option value={1000}>1000 Mbps / 1 Gbps (GigabitEthernet)</option>
                    <option value={10000}>10,000 Mbps / 10 Gbps (TenGig Fiber)</option>
                  </select>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
