// src/components/common/Navbar.tsx
import React from 'react';
import {
  Network,
  RotateCcw,
  BookOpen,
  Wifi,
  WifiOff,
  Radio,
  GitBranch,
  BarChart3,
  Flame,
  Gauge,
  History,
  LayoutDashboard,
} from 'lucide-react';

export type ActiveTab =
  | 'dashboard'
  | 'topology'
  | 'explorer'
  | 'comparison'
  | 'failure'
  | 'metrics'
  | 'history';

interface NavbarProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  isApiMode: boolean;
  setIsApiMode: (mode: boolean) => void;
  backendOnline: boolean;
  backendChecking: boolean;
  onResetNetwork: () => void;
  onOpenTheory: () => void;
  activeLinksCount: number;
  totalLinksCount: number;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  isApiMode,
  setIsApiMode,
  backendOnline,
  backendChecking,
  onResetNetwork,
  onOpenTheory,
  activeLinksCount,
  totalLinksCount,
}) => {
  const tabs = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'topology', label: 'Network Topology', icon: Network },
    { id: 'explorer', label: 'Route Explorer', icon: GitBranch },
    { id: 'comparison', label: 'Compare Algorithms', icon: BarChart3 },
    { id: 'failure', label: 'Failure Simulation', icon: Flame },
    { id: 'metrics', label: 'Link Metrics', icon: Gauge },
    { id: 'history', label: 'History & Logs', icon: History },
  ] as const;

  return (
    <header className="sticky top-0 z-40 bg-[#070B14]/90 backdrop-blur-xl border-b border-slate-800">
      {/* Top Utility & Status Banner */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-4">
          {/* Logo & Project Title */}
          <div className="flex items-center gap-3.5 cursor-pointer" onClick={() => setActiveTab('dashboard')}>
            <div className="relative flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 shadow-glow-cyan">
              <Radio className="w-5 h-5 text-white animate-pulse" />
              <div className="absolute -inset-0.5 rounded-xl bg-cyan-400 opacity-20 blur"></div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-lg tracking-tight text-white font-sans">
                  Smart Routing <span className="text-cyan-400">Simulator</span>
                </span>
                <span className="px-2 py-0.5 text-[10px] font-mono font-semibold rounded-full bg-cyan-950 text-cyan-300 border border-cyan-800">
                  v2.4 NOC
                </span>
              </div>
              <p className="text-xs text-slate-400 font-mono hidden sm:block">
                Autonomous System Mesh • 5 Routers (R1–R5) • {activeLinksCount}/{totalLinksCount} Links Active
              </p>
            </div>
          </div>

          {/* Right Action Controls: Mode Switcher & Global Actions */}
          <div className="flex items-center gap-3">
            {/* Backend / Demo Mode Switcher */}
            <div className="flex items-center gap-2 bg-slate-900/90 border border-slate-800 rounded-xl p-1 px-2.5">
              <div className="flex items-center gap-1.5 pr-2 border-r border-slate-800">
                {backendChecking ? (
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping"></span>
                ) : isApiMode ? (
                  backendOnline ? (
                    <Wifi className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <WifiOff className="w-3.5 h-3.5 text-rose-400" />
                  )
                ) : (
                  <span className="w-2.5 h-2.5 rounded-full bg-cyan-400"></span>
                )}
                <span className="text-[11px] font-mono text-slate-300 hidden md:inline">
                  {isApiMode
                    ? backendOnline
                      ? 'FastAPI Online'
                      : 'FastAPI Offline'
                    : 'Client Simulation'}
                </span>
              </div>

              {/* Mode Toggle Button */}
              <button
                type="button"
                onClick={() => setIsApiMode(!isApiMode)}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-mono font-semibold transition-all ${
                  isApiMode
                    ? 'bg-blue-600/30 text-blue-300 border border-blue-500/50 hover:bg-blue-600/40'
                    : 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 hover:bg-cyan-500/30'
                }`}
                title="Switch between Client Simulation Demo mode and real FastAPI backend integration"
              >
                <span>{isApiMode ? 'API Mode' : 'Demo Mode'}</span>
                <span className="text-[10px] opacity-75">⇄</span>
              </button>
            </div>

            {/* Quick Algorithm Theory Modal Trigger */}
            <button
              onClick={onOpenTheory}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:border-slate-700 text-xs font-medium transition-all"
              title="Open routing algorithm theory and complexity guide"
            >
              <BookOpen className="w-3.5 h-3.5 text-cyan-400" />
              <span className="hidden lg:inline">Theory</span>
            </button>

            {/* Network Reset Button */}
            <button
              onClick={onResetNetwork}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-rose-400 hover:border-rose-900/50 text-xs font-medium transition-all"
              title="Reset all link states and metrics to default"
            >
              <RotateCcw className="w-3.5 h-3.5 text-slate-400" />
              <span className="hidden lg:inline">Reset</span>
            </button>
          </div>
        </div>

        {/* Tab Navigation Navigation Bar */}
        <nav className="flex items-center space-x-1 sm:space-x-2 overflow-x-auto py-2 no-scrollbar border-t border-slate-800/60">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as ActiveTab)}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-medium whitespace-nowrap transition-all duration-200 ${
                  isActive
                    ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/40 shadow-glow-cyan/30'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/80'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-cyan-400' : 'text-slate-500'}`} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </nav>
      </div>
    </header>
  );
};
