// src/components/resilience/ResilienceView.tsx
import React, { useState, useEffect, useCallback } from 'react';
import {
  ShieldAlert,
  Sliders,
  Activity,
  Play,
  RotateCcw,
  Download,
  FileSpreadsheet,
  CheckCircle2,
  Flame,
  RefreshCw,
} from 'lucide-react';
import type {
  RouterId,
  NetworkLink,
  PolicyConfiguration,
  RouteStabilityRecord,
  ResilienceExperimentReport,
  CriticalLinkAnalysisResponse,
} from '../../types/network';
import { NetworkApiService, type ResilienceExperimentRequest } from '../../services/api';

interface ResilienceViewProps {
  links: NetworkLink[];
  isApiMode: boolean;
  backendOnline: boolean;
  addToast: (type: 'success' | 'error' | 'info', title: string, description?: string) => void;
}

const DEFAULT_POLICY: PolicyConfiguration = {
  weights: {
    w_delay: 0.35,
    w_congestion: 0.30,
    w_bandwidth: 0.20,
    w_risk: 0.15,
  },
  hysteresis: {
    enabled: true,
    threshold: 0.15,
    min_absolute_improvement: 0.05,
  },
  referenceBandwidthMbps: 1000.0,
  referenceMaxDelayMs: 100.0,
};

export const ResilienceView: React.FC<ResilienceViewProps> = ({
  links: _links,
  isApiMode,
  backendOnline,
  addToast,
}) => {
  // Policy Weights & Hysteresis State
  const [policyConfig, setPolicyConfig] = useState<PolicyConfiguration>(DEFAULT_POLICY);
  const [savingPolicy, setSavingPolicy] = useState(false);

  // Stability Audit Log State
  const [stabilityRecords, setStabilityRecords] = useState<RouteStabilityRecord[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Experiment Benchmark State
  const [selectedScenario, setSelectedScenario] = useState<ResilienceExperimentRequest['scenarioName']>('single-link-failure');
  const [expSource, setExpSource] = useState<RouterId>('R1');
  const [expDestination, setExpDestination] = useState<RouterId>('R5');
  const [expSeed, setExpSeed] = useState<number>(42);
  const [runningExperiment, setRunningExperiment] = useState(false);
  const [experimentReport, setExperimentReport] = useState<ResilienceExperimentReport | null>(null);

  // Critical Link Analysis State
  const [criticalLinksReport, setCriticalLinksReport] = useState<CriticalLinkAnalysisResponse | null>(null);
  const [analyzingLinks, setAnalyzingLinks] = useState(false);

  // Sub-tabs inside Resilience View
  const [activeSubTab, setActiveSubTab] = useState<'policy' | 'experiments' | 'vulnerabilities' | 'audit'>('policy');

  // Load Policy Configuration and Stability History on mount or when API mode toggles
  const fetchPolicy = useCallback(async () => {
    if (!isApiMode || !backendOnline) return;
    try {
      const cfg = await NetworkApiService.getPolicyConfig();
      setPolicyConfig(cfg);
    } catch {
      // Fallback to local default
    }
  }, [isApiMode, backendOnline]);

  const fetchHistory = useCallback(async () => {
    if (!isApiMode || !backendOnline) return;
    setLoadingHistory(true);
    try {
      const recs = await NetworkApiService.getStabilityHistory(40);
      setStabilityRecords(recs);
    } catch {
      // Ignore
    } finally {
      setLoadingHistory(false);
    }
  }, [isApiMode, backendOnline]);

  const fetchCriticalLinks = useCallback(async () => {
    if (!isApiMode || !backendOnline) {
      addToast('info', 'Offline Mode', 'Connect to FastAPI backend to compute full topological vulnerability analysis.');
      return;
    }
    setAnalyzingLinks(true);
    try {
      const res = await NetworkApiService.getCriticalLinks();
      setCriticalLinksReport(res);
      addToast('success', 'Analysis Complete', `Evaluated ${res.totalLinks} links with simulated cut-set tests.`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error analyzing critical links';
      addToast('error', 'Analysis Failed', msg);
    } finally {
      setAnalyzingLinks(false);
    }
  }, [isApiMode, backendOnline, addToast]);

  useEffect(() => {
    fetchPolicy();
    fetchHistory();
  }, [fetchPolicy, fetchHistory]);

  // Weight Slider Handlers with Auto-Normalization
  const handleWeightChange = (key: keyof PolicyConfiguration['weights'], rawVal: number) => {
    setPolicyConfig((prev) => {
      const newWeights = { ...prev.weights, [key]: rawVal };
      return { ...prev, weights: newWeights };
    });
  };

  const applyPreset = (preset: 'balanced' | 'latency' | 'congestion' | 'reliability') => {
    let weights = { w_delay: 0.35, w_congestion: 0.30, w_bandwidth: 0.20, w_risk: 0.15 };
    if (preset === 'latency') {
      weights = { w_delay: 0.60, w_congestion: 0.15, w_bandwidth: 0.15, w_risk: 0.10 };
    } else if (preset === 'congestion') {
      weights = { w_delay: 0.15, w_congestion: 0.55, w_bandwidth: 0.15, w_risk: 0.15 };
    } else if (preset === 'reliability') {
      weights = { w_delay: 0.20, w_congestion: 0.20, w_bandwidth: 0.20, w_risk: 0.40 };
    }
    setPolicyConfig((prev) => ({ ...prev, weights }));
    addToast('info', 'Preset Applied', `Selected "${preset.toUpperCase()}" routing profile.`);
  };

  const savePolicy = async () => {
    if (!isApiMode || !backendOnline) {
      addToast('success', 'Policy Updated', 'FAMM-RS policy weights applied to client simulation engine.');
      return;
    }
    setSavingPolicy(true);
    try {
      const updated = await NetworkApiService.updatePolicyConfig(policyConfig);
      setPolicyConfig(updated);
      addToast('success', 'Engine Updated', 'FastAPI backend updated with normalized multi-metric policy.');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error updating configuration';
      addToast('error', 'Update Failed', msg);
    } finally {
      setSavingPolicy(false);
    }
  };

  // Run Benchmark Experiment
  const handleRunExperiment = async () => {
    if (!isApiMode || !backendOnline) {
      addToast('info', 'API Required', 'Automated resilience experiments require active FastAPI backend.');
      return;
    }
    setRunningExperiment(true);
    try {
      const report = await NetworkApiService.runExperiment({
        scenarioName: selectedScenario,
        source: expSource,
        destination: expDestination,
        randomSeed: expSeed,
      });
      setExperimentReport(report);
      addToast('success', 'Experiment Concluded', `Scenario "${report.scenarioName}" executed across ${report.steps.length} network steps.`);
      fetchHistory();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Experiment execution error';
      addToast('error', 'Benchmark Failed', msg);
    } finally {
      setRunningExperiment(false);
    }
  };

  const handleResetAudit = async () => {
    if (!isApiMode || !backendOnline) {
      setStabilityRecords([]);
      return;
    }
    try {
      await NetworkApiService.resetStability();
      setStabilityRecords([]);
      addToast('info', 'Audit Reset', 'Route stability audit history and damping registers cleared.');
    } catch {
      // Ignore
    }
  };

  const handleDownloadCsv = () => {
    if (!experimentReport) return;
    const url = NetworkApiService.getExperimentCsvUrl(experimentReport.experimentId);
    window.open(url, '_blank');
  };

  const handleDownloadJson = () => {
    if (!experimentReport) return;
    const blob = new Blob([JSON.stringify(experimentReport, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${experimentReport.experimentId}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Normalized weights for display
  const sumWeights =
    policyConfig.weights.w_delay +
    policyConfig.weights.w_congestion +
    policyConfig.weights.w_bandwidth +
    policyConfig.weights.w_risk || 1;

  return (
    <div className="space-y-6">
      {/* View Header */}
      <div className="bg-slate-900/90 rounded-2xl border border-slate-800 p-6 backdrop-blur-md shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-slate-800">
          <div>
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-cyan-400" />
              <h2 className="text-xl font-bold text-white">Resilience & Research Evaluation Engine</h2>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Failure-Aware Multi-Metric Routing with Route Stability Hysteresis (FAMM-RS) • Quantitative Stress Testing Suite
            </p>
          </div>

          {/* Sub-tab Navigation */}
          <div className="flex items-center gap-1.5 bg-slate-950 p-1.5 rounded-xl border border-slate-800 overflow-x-auto">
            <button
              onClick={() => setActiveSubTab('policy')}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono font-semibold transition-all ${
                activeSubTab === 'policy'
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Policy Weights & Hysteresis
            </button>
            <button
              onClick={() => setActiveSubTab('experiments')}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono font-semibold transition-all ${
                activeSubTab === 'experiments'
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Benchmark Experiments
            </button>
            <button
              onClick={() => {
                setActiveSubTab('vulnerabilities');
                if (!criticalLinksReport) fetchCriticalLinks();
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono font-semibold transition-all ${
                activeSubTab === 'vulnerabilities'
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Critical Vulnerabilities
            </button>
            <button
              onClick={() => {
                setActiveSubTab('audit');
                fetchHistory();
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono font-semibold transition-all ${
                activeSubTab === 'audit'
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Stability Audit Log
            </button>
          </div>
        </div>

        {/* 1. POLICY TUNING SUB-TAB */}
        {activeSubTab === 'policy' && (
          <div className="mt-6 space-y-6">
            {/* Presets Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-xl bg-slate-950/60 border border-slate-800">
              <span className="text-xs font-mono text-slate-400 flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5 text-cyan-400" />
                Quick Profile Presets:
              </span>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => applyPreset('balanced')}
                  className="px-3 py-1 rounded-lg text-xs font-mono bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 transition-colors"
                >
                  Balanced QoS
                </button>
                <button
                  onClick={() => applyPreset('latency')}
                  className="px-3 py-1 rounded-lg text-xs font-mono bg-amber-950/40 hover:bg-amber-900/40 text-amber-300 border border-amber-800/60 transition-colors"
                >
                  Ultra-Low Latency (VoIP)
                </button>
                <button
                  onClick={() => applyPreset('congestion')}
                  className="px-3 py-1 rounded-lg text-xs font-mono bg-rose-950/40 hover:bg-rose-900/40 text-rose-300 border border-rose-800/60 transition-colors"
                >
                  Congestion Avoidance
                </button>
                <button
                  onClick={() => applyPreset('reliability')}
                  className="px-3 py-1 rounded-lg text-xs font-mono bg-purple-950/40 hover:bg-purple-900/40 text-purple-300 border border-purple-800/60 transition-colors"
                >
                  High Reliability (Anti-Risk)
                </button>
              </div>
            </div>

            {/* Weights Sliders Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Delay Weight */}
              <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-xs font-mono font-bold text-amber-400">Delay Weight (w_delay)</span>
                  <span className="text-xs font-mono font-bold text-white">
                    {(policyConfig.weights.w_delay / sumWeights).toFixed(2)}
                  </span>
                </div>
                <p className="text-[10px] text-slate-400 mb-3">Penalizes propagation and queueing latency</p>
                <input
                  type="range"
                  min="0.05"
                  max="1.0"
                  step="0.05"
                  value={policyConfig.weights.w_delay}
                  onChange={(e) => handleWeightChange('w_delay', parseFloat(e.target.value))}
                  className="w-full accent-amber-400 cursor-pointer"
                />
              </div>

              {/* Congestion Weight */}
              <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-xs font-mono font-bold text-rose-400">Congestion (w_cong)</span>
                  <span className="text-xs font-mono font-bold text-white">
                    {(policyConfig.weights.w_congestion / sumWeights).toFixed(2)}
                  </span>
                </div>
                <p className="text-[10px] text-slate-400 mb-3">Quadratic penalty for links near saturation</p>
                <input
                  type="range"
                  min="0.05"
                  max="1.0"
                  step="0.05"
                  value={policyConfig.weights.w_congestion}
                  onChange={(e) => handleWeightChange('w_congestion', parseFloat(e.target.value))}
                  className="w-full accent-rose-400 cursor-pointer"
                />
              </div>

              {/* Bandwidth Weight */}
              <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-xs font-mono font-bold text-emerald-400">Bandwidth (w_bw)</span>
                  <span className="text-xs font-mono font-bold text-white">
                    {(policyConfig.weights.w_bandwidth / sumWeights).toFixed(2)}
                  </span>
                </div>
                <p className="text-[10px] text-slate-400 mb-3">Favors high throughput link pipes (1 Gbps)</p>
                <input
                  type="range"
                  min="0.05"
                  max="1.0"
                  step="0.05"
                  value={policyConfig.weights.w_bandwidth}
                  onChange={(e) => handleWeightChange('w_bandwidth', parseFloat(e.target.value))}
                  className="w-full accent-emerald-400 cursor-pointer"
                />
              </div>

              {/* Risk Weight */}
              <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-xs font-mono font-bold text-purple-400">Failure Risk (w_risk)</span>
                  <span className="text-xs font-mono font-bold text-white">
                    {(policyConfig.weights.w_risk / sumWeights).toFixed(2)}
                  </span>
                </div>
                <p className="text-[10px] text-slate-400 mb-3">Steers away from high failure probability edges</p>
                <input
                  type="range"
                  min="0.05"
                  max="1.0"
                  step="0.05"
                  value={policyConfig.weights.w_risk}
                  onChange={(e) => handleWeightChange('w_risk', parseFloat(e.target.value))}
                  className="w-full accent-purple-400 cursor-pointer"
                />
              </div>
            </div>

            {/* Hysteresis Stability Parameters */}
            <div className="p-5 rounded-xl bg-slate-950/80 border border-slate-800">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-3 border-b border-slate-800">
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <Activity className="w-4 h-4 text-cyan-400" />
                    Route-Stability Hysteresis Control (Flap Suppression)
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Requires candidate paths to achieve &gt; &theta; relative improvement before triggering a route switch.
                  </p>
                </div>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={policyConfig.hysteresis.enabled}
                    onChange={(e) =>
                      setPolicyConfig((prev) => ({
                        ...prev,
                        hysteresis: { ...prev.hysteresis, enabled: e.target.checked },
                      }))
                    }
                    className="w-4 h-4 rounded text-cyan-500 accent-cyan-400"
                  />
                  <span className="text-xs font-mono font-bold text-cyan-300">
                    {policyConfig.hysteresis.enabled ? 'Hysteresis Active' : 'Hysteresis Disabled'}
                  </span>
                </label>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <div className="flex justify-between text-xs font-mono mb-1.5">
                    <span className="text-slate-300">Switching Threshold (&theta;):</span>
                    <span className="text-cyan-400 font-bold">
                      {(policyConfig.hysteresis.threshold * 100).toFixed(0)}% Improvement Required
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0.05"
                    max="0.50"
                    step="0.01"
                    disabled={!policyConfig.hysteresis.enabled}
                    value={policyConfig.hysteresis.threshold}
                    onChange={(e) =>
                      setPolicyConfig((prev) => ({
                        ...prev,
                        hysteresis: { ...prev.hysteresis, threshold: parseFloat(e.target.value) },
                      }))
                    }
                    className="w-full accent-cyan-400 cursor-pointer disabled:opacity-40"
                  />
                  <div className="flex justify-between text-[10px] text-slate-500 font-mono mt-1">
                    <span>5% (Aggressive Switch)</span>
                    <span>50% (High Dampening)</span>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs font-mono mb-1.5">
                    <span className="text-slate-300">Min Absolute Cost Delta (&Delta;C_min):</span>
                    <span className="text-cyan-400 font-bold">
                      {policyConfig.hysteresis.min_absolute_improvement.toFixed(2)} units
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0.01"
                    max="0.50"
                    step="0.01"
                    disabled={!policyConfig.hysteresis.enabled}
                    value={policyConfig.hysteresis.min_absolute_improvement}
                    onChange={(e) =>
                      setPolicyConfig((prev) => ({
                        ...prev,
                        hysteresis: {
                          ...prev.hysteresis,
                          min_absolute_improvement: parseFloat(e.target.value),
                        },
                      }))
                    }
                    className="w-full accent-cyan-400 cursor-pointer disabled:opacity-40"
                  />
                  <div className="flex justify-between text-[10px] text-slate-500 font-mono mt-1">
                    <span>0.01 (Micro-improvements)</span>
                    <span>0.50 (Macro-improvements)</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Save Button */}
            <div className="flex justify-end gap-3">
              <button
                onClick={savePolicy}
                disabled={savingPolicy}
                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-bold text-xs font-mono flex items-center gap-2 shadow-glow-cyan transition-all disabled:opacity-50"
              >
                {savingPolicy ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Save & Deploy Policy</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* 2. AUTOMATED BENCHMARK EXPERIMENTS SUB-TAB */}
        {activeSubTab === 'experiments' && (
          <div className="mt-6 space-y-6">
            {/* Scenario Configuration Controls */}
            <div className="p-5 rounded-xl bg-slate-950/80 border border-slate-800">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <label className="text-[11px] font-mono text-slate-400 block mb-1">Scenario Type</label>
                  <select
                    value={selectedScenario}
                    onChange={(e) =>
                      setSelectedScenario(e.target.value as ResilienceExperimentRequest['scenarioName'])
                    }
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-cyan-300 font-mono font-bold focus:outline-none"
                  >
                    <option value="single-link-failure">Single Link Failure & Recovery</option>
                    <option value="cascading-failure">Cascading Multi-Link Failure</option>
                    <option value="congestion-oscillation">Congestion Flap & Oscillation</option>
                    <option value="synthetic-mesh">Synthetic Topology Mesh Perturbation</option>
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-mono text-slate-400 block mb-1">Source Node</label>
                  <select
                    value={expSource}
                    onChange={(e) => setExpSource(e.target.value as RouterId)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-emerald-400 font-mono font-bold focus:outline-none"
                  >
                    <option value="R1">R1 (192.168.1.1)</option>
                    <option value="R2">R2 (192.168.2.1)</option>
                    <option value="R3">R3 (192.168.3.1)</option>
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-mono text-slate-400 block mb-1">Destination Node</label>
                  <select
                    value={expDestination}
                    onChange={(e) => setExpDestination(e.target.value as RouterId)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-violet-400 font-mono font-bold focus:outline-none"
                  >
                    <option value="R5">R5 (192.168.5.1)</option>
                    <option value="R4">R4 (192.168.4.1)</option>
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-mono text-slate-400 block mb-1">Random Seed</label>
                  <input
                    type="number"
                    value={expSeed}
                    onChange={(e) => setExpSeed(parseInt(e.target.value) || 42)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white font-mono focus:outline-none"
                  />
                </div>
              </div>

              <div className="mt-4 flex justify-between items-center pt-3 border-t border-slate-800">
                <span className="text-xs text-slate-400 font-mono">
                  Executes automated multi-step test comparing Static Dijkstra, Adaptive FAMM, and FAMM-RS.
                </span>

                <button
                  onClick={handleRunExperiment}
                  disabled={runningExperiment}
                  className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-bold text-xs font-mono flex items-center gap-2 shadow-glow-cyan transition-all disabled:opacity-50"
                >
                  {runningExperiment ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Running Simulation Steps...</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4 fill-current" />
                      <span>Execute Scenario Benchmark</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Experiment Report Output */}
            {experimentReport && (
              <div className="space-y-5 animate-in fade-in duration-300">
                {/* Header Strip with Download Buttons */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl bg-slate-950/90 border border-cyan-800/60">
                  <div>
                    <h3 className="text-sm font-bold text-white font-mono">
                      Report: {experimentReport.scenarioName} ({experimentReport.experimentId})
                    </h3>
                    <p className="text-xs text-slate-400 font-mono">{experimentReport.description}</p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleDownloadCsv}
                      className="px-3 py-1.5 rounded-lg bg-emerald-950/40 hover:bg-emerald-900/50 text-emerald-300 border border-emerald-700/60 text-xs font-mono flex items-center gap-1.5 transition-colors"
                    >
                      <FileSpreadsheet className="w-3.5 h-3.5" />
                      <span>Download CSV</span>
                    </button>
                    <button
                      onClick={handleDownloadJson}
                      className="px-3 py-1.5 rounded-lg bg-blue-950/40 hover:bg-blue-900/50 text-blue-300 border border-blue-700/60 text-xs font-mono flex items-center gap-1.5 transition-colors"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Export JSON</span>
                    </button>
                  </div>
                </div>

                {/* Overall Policy Summaries Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {Object.entries(experimentReport.summaries).map(([policyKey, summary]) => {
                    const isFammRs = policyKey === 'famm_with_hysteresis';
                    return (
                      <div
                        key={policyKey}
                        className={`p-4 rounded-xl border backdrop-blur-md transition-all ${
                          isFammRs
                            ? 'bg-slate-900/90 border-cyan-500/50 shadow-glow-cyan/20'
                            : 'bg-slate-950/60 border-slate-800'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-mono font-bold text-white uppercase tracking-wider">
                            {summary.policy.replace(/_/g, ' ')}
                          </span>
                          {isFammRs && (
                            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-bold">
                              PROPOSED
                            </span>
                          )}
                        </div>

                        <div className="space-y-2 text-xs font-mono">
                          <div className="flex justify-between py-1 border-b border-slate-800/80">
                            <span className="text-slate-400">Reachability:</span>
                            <span className="font-bold text-emerald-400">{summary.reachabilityPercent.toFixed(1)}%</span>
                          </div>
                          <div className="flex justify-between py-1 border-b border-slate-800/80">
                            <span className="text-slate-400">Total Route Flaps:</span>
                            <span className={`font-bold ${summary.totalSwitches > 3 ? 'text-rose-400' : 'text-cyan-400'}`}>
                              {summary.totalSwitches} switches
                            </span>
                          </div>
                          <div className="flex justify-between py-1 border-b border-slate-800/80">
                            <span className="text-slate-400">Stability Score:</span>
                            <span className="font-bold text-white">{(summary.stabilityScore * 100).toFixed(0)} / 100</span>
                          </div>
                          <div className="flex justify-between py-1 border-b border-slate-800/80">
                            <span className="text-slate-400">Average Delay:</span>
                            <span className="font-bold text-amber-300">{summary.averageDelayMs.toFixed(1)} ms</span>
                          </div>
                          <div className="flex justify-between py-1">
                            <span className="text-slate-400">Average Path Cost:</span>
                            <span className="font-bold text-white">{summary.averageCost.toFixed(3)}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Step-by-Step Scenario Timeline */}
                <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 overflow-x-auto">
                  <h4 className="text-xs font-mono font-bold text-slate-300 uppercase tracking-wider mb-3">
                    Scenario Event Timeline & Step Outcomes
                  </h4>
                  <table className="w-full text-left text-xs font-mono text-slate-300">
                    <thead className="bg-slate-900 text-[10px] text-slate-400 uppercase">
                      <tr>
                        <th className="py-2 px-2.5">Step</th>
                        <th className="py-2 px-2.5">Event Action</th>
                        <th className="py-2 px-2.5">Target</th>
                        <th className="py-2 px-2.5">Static Dijkstra</th>
                        <th className="py-2 px-2.5">Raw FAMM</th>
                        <th className="py-2 px-2.5">FAMM-RS (Hysteresis)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {experimentReport.steps.map((st) => {
                        const mDijk = st.policyMetrics['static_dijkstra'];
                        const mFamm = st.policyMetrics['famm_no_hysteresis'];
                        const mFammRs = st.policyMetrics['famm_with_hysteresis'];
                        return (
                          <tr key={st.step} className="hover:bg-slate-900/40">
                            <td className="py-2 px-2.5 font-bold text-white">#{st.step}</td>
                            <td className="py-2 px-2.5">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                st.event.action.includes('FAIL')
                                  ? 'bg-rose-950/50 text-rose-300 border border-rose-800'
                                  : st.event.action.includes('RESTORE')
                                  ? 'bg-emerald-950/50 text-emerald-300 border border-emerald-800'
                                  : 'bg-amber-950/50 text-amber-300 border border-amber-800'
                              }`}>
                                {st.event.action}
                              </span>
                            </td>
                            <td className="py-2 px-2.5 text-slate-400">{st.event.targetLinkId || 'N/A'}</td>
                            <td className="py-2 px-2.5 text-slate-300">
                              {mDijk?.reachable ? mDijk.path.join(' ➔ ') : <span className="text-rose-400">Unreachable</span>}
                            </td>
                            <td className="py-2 px-2.5 text-slate-300">
                              {mFamm?.reachable ? (
                                <span className={mFamm.switched ? 'text-amber-300 font-bold' : ''}>
                                  {mFamm.path.join(' ➔ ')} {mFamm.switched && '🔄'}
                                </span>
                              ) : (
                                <span className="text-rose-400">Unreachable</span>
                              )}
                            </td>
                            <td className="py-2 px-2.5 text-cyan-300 font-bold">
                              {mFammRs?.reachable ? (
                                <span>
                                  {mFammRs.path.join(' ➔ ')}{' '}
                                  {mFammRs.switched ? (
                                    <span className="text-[10px] px-1.5 py-0.2 bg-emerald-500/20 text-emerald-400 rounded">
                                      Switched
                                    </span>
                                  ) : (
                                    <span className="text-[10px] text-slate-500">Hold</span>
                                  )}
                                </span>
                              ) : (
                                <span className="text-rose-400">Unreachable</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* 3. CRITICAL VULNERABILITIES SUB-TAB */}
        {activeSubTab === 'vulnerabilities' && (
          <div className="mt-6 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl bg-slate-950/80 border border-slate-800">
              <div>
                <h3 className="text-sm font-bold text-white font-mono">
                  Cut-Set Vulnerability & Topological Bridge Analysis
                </h3>
                <p className="text-xs text-slate-400 font-mono">
                  Simulates complete severing of each individual network link to measure path inflation and partition risk.
                </p>
              </div>

              <button
                onClick={fetchCriticalLinks}
                disabled={analyzingLinks}
                className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-mono text-xs flex items-center gap-2 transition-colors disabled:opacity-50"
              >
                {analyzingLinks ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin text-cyan-400" />
                    <span>Analyzing Graph...</span>
                  </>
                ) : (
                  <>
                    <Flame className="w-3.5 h-3.5 text-rose-400" />
                    <span>Run Vulnerability Audit</span>
                  </>
                )}
              </button>
            </div>

            {criticalLinksReport && (
              <div className="space-y-4">
                {/* Recommendation Banner */}
                <div className="p-4 rounded-xl bg-cyan-950/20 border border-cyan-500/30">
                  <h4 className="text-xs font-mono font-bold text-cyan-400 uppercase tracking-wider mb-1">
                    Architectural Recommendation
                  </h4>
                  <p className="text-xs text-slate-300 leading-relaxed font-mono">
                    {criticalLinksReport.recommendation}
                  </p>
                </div>

                {/* Critical Link Items Cards / Table */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {criticalLinksReport.criticalLinks.map((linkItem) => {
                    const isBridge = linkItem.classification === 'CRITICAL_BRIDGE';
                    const isBottleneck = linkItem.classification === 'MAJOR_BOTTLENECK';

                    return (
                      <div
                        key={linkItem.linkId}
                        className={`p-4 rounded-xl border backdrop-blur-md transition-all ${
                          isBridge
                            ? 'bg-rose-950/20 border-rose-500/50 shadow-glow-rose/20'
                            : isBottleneck
                            ? 'bg-amber-950/20 border-amber-500/50'
                            : 'bg-slate-950/60 border-slate-800'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-mono font-bold text-white">
                            Link {linkItem.linkId} ({linkItem.source} ➔ {linkItem.target})
                          </span>
                          <span
                            className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-bold uppercase ${
                              isBridge
                                ? 'bg-rose-500/20 text-rose-300 border border-rose-600'
                                : isBottleneck
                                ? 'bg-amber-500/20 text-amber-300 border border-amber-600'
                                : 'bg-emerald-500/20 text-emerald-300 border border-emerald-600'
                            }`}
                          >
                            {linkItem.classification.replace(/_/g, ' ')}
                          </span>
                        </div>

                        <div className="space-y-1.5 text-xs font-mono">
                          <div className="flex justify-between py-1 border-b border-slate-800/80">
                            <span className="text-slate-400">Criticality Score:</span>
                            <span className="font-bold text-white">{linkItem.criticalityScore.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between py-1 border-b border-slate-800/80">
                            <span className="text-slate-400">Disconnects Network?</span>
                            <span className={linkItem.disconnectsNetwork ? 'text-rose-400 font-bold' : 'text-emerald-400'}>
                              {linkItem.disconnectsNetwork ? 'YES (Bridge Link)' : 'No (Redundant paths exist)'}
                            </span>
                          </div>
                          <div className="flex justify-between py-1 border-b border-slate-800/80">
                            <span className="text-slate-400">Reachability on Sever:</span>
                            <span className="font-bold text-white">{(linkItem.reachabilityRatio * 100).toFixed(0)}%</span>
                          </div>
                          <div className="flex justify-between py-1">
                            <span className="text-slate-400">Cost Inflation Factor:</span>
                            <span className="font-bold text-amber-300">{linkItem.costInflationFactor.toFixed(2)}x</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* 4. STABILITY AUDIT LOG SUB-TAB */}
        {activeSubTab === 'audit' && (
          <div className="mt-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl bg-slate-950/80 border border-slate-800">
              <div>
                <h3 className="text-sm font-bold text-white font-mono">
                  Route Stability Audit Log ({stabilityRecords.length} Determinations)
                </h3>
                <p className="text-xs text-slate-400 font-mono">
                  Real-time record of hysteresis determinations, dampening actions, and emergency failovers.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={fetchHistory}
                  disabled={loadingHistory}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-xs font-mono flex items-center gap-1.5 transition-colors"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loadingHistory ? 'animate-spin text-cyan-400' : ''}`} />
                  <span>Refresh</span>
                </button>
                <button
                  onClick={handleResetAudit}
                  className="px-3 py-1.5 rounded-lg bg-rose-950/40 hover:bg-rose-900/50 text-rose-300 border border-rose-800 text-xs font-mono flex items-center gap-1.5 transition-colors"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Clear Audit</span>
                </button>
              </div>
            </div>

            {stabilityRecords.length === 0 ? (
              <div className="p-8 text-center rounded-xl bg-slate-950/40 border border-slate-800 text-xs text-slate-500 font-mono">
                No stability determinations recorded yet. Run a route calculation or benchmark experiment to populate this audit trail.
              </div>
            ) : (
              <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 overflow-x-auto">
                <table className="w-full text-left text-xs font-mono text-slate-300">
                  <thead className="bg-slate-900 text-[10px] text-slate-400 uppercase">
                    <tr>
                      <th className="py-2 px-2.5">Step</th>
                      <th className="py-2 px-2.5">Flow</th>
                      <th className="py-2 px-2.5">Active Route Before</th>
                      <th className="py-2 px-2.5">Candidate Route</th>
                      <th className="py-2 px-2.5">Switched?</th>
                      <th className="py-2 px-2.5">Improvement</th>
                      <th className="py-2 px-2.5">Determination Reason</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {stabilityRecords.map((rec) => (
                      <tr key={rec.step} className="hover:bg-slate-900/40">
                        <td className="py-2 px-2.5 font-bold text-white">#{rec.step}</td>
                        <td className="py-2 px-2.5 text-cyan-300 font-bold">
                          {rec.source} ➔ {rec.destination}
                        </td>
                        <td className="py-2 px-2.5 text-slate-400">
                          {rec.activeRouteBefore.length > 0 ? rec.activeRouteBefore.join('-') : 'None'}
                        </td>
                        <td className="py-2 px-2.5 text-white">{rec.candidateRoute.join('-')}</td>
                        <td className="py-2 px-2.5">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              rec.switched
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-600'
                                : 'bg-slate-800 text-slate-400 border border-slate-700'
                            }`}
                          >
                            {rec.switched ? 'SWITCHED' : 'DAMPENED'}
                          </span>
                        </td>
                        <td className="py-2 px-2.5 text-amber-300 font-bold">
                          {(rec.relativeImprovement * 100).toFixed(1)}%
                        </td>
                        <td className="py-2 px-2.5 text-slate-400 italic text-[11px]">{rec.reason}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
