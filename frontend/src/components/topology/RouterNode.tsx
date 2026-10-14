// src/components/topology/RouterNode.tsx
import React, { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { Server, Activity } from 'lucide-react';
import type { RouterNodeData } from '../../types/network';

interface RouterNodeProps {
  data: RouterNodeData & {
    isSource?: boolean;
    isDestination?: boolean;
    isInPath?: boolean;
    pathOrder?: number;
    isSelected?: boolean;
    onSelectRouter?: (id: string) => void;
  };
}

export const RouterNode: React.FC<RouterNodeProps> = memo(({ data }) => {
  const {
    id,
    ipAddress,
    status,
    isSource,
    isDestination,
    isInPath,
    pathOrder,
    isSelected,
  } = data;

  // Node border and glow states
  let borderClass = 'border-slate-800 bg-slate-900/90 shadow-lg';
  let badgeClass = 'bg-slate-800 text-slate-300';
  let roleBadge = null;

  if (isSource) {
    borderClass = 'border-emerald-500 bg-emerald-950/40 shadow-glow-emerald ring-2 ring-emerald-500/50';
    badgeClass = 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40';
    roleBadge = 'SOURCE';
  } else if (isDestination) {
    borderClass = 'border-violet-500 bg-violet-950/40 shadow-glow-violet ring-2 ring-violet-500/50';
    badgeClass = 'bg-violet-500/20 text-violet-400 border border-violet-500/40';
    roleBadge = 'DESTINATION';
  } else if (isInPath) {
    borderClass = 'border-cyan-500 bg-cyan-950/30 shadow-glow-cyan ring-1 ring-cyan-500/50';
    badgeClass = 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/40';
    roleBadge = `HOP #${pathOrder}`;
  } else if (isSelected) {
    borderClass = 'border-blue-400 bg-blue-950/30 shadow-glow-blue ring-2 ring-blue-400/50';
  }

  return (
    <div
      className={`relative min-w-[170px] rounded-xl p-3 backdrop-blur-md transition-all duration-300 cursor-pointer ${borderClass}`}
      onClick={() => data.onSelectRouter && data.onSelectRouter(id)}
    >
      {/* Invisible Handles on all 4 sides for clean multi-link routing */}
      <Handle type="target" position={Position.Top} id="top" className="opacity-0" />
      <Handle type="source" position={Position.Top} id="top-src" className="opacity-0" />
      <Handle type="target" position={Position.Bottom} id="bottom" className="opacity-0" />
      <Handle type="source" position={Position.Bottom} id="bottom-src" className="opacity-0" />
      <Handle type="target" position={Position.Left} id="left" className="opacity-0" />
      <Handle type="source" position={Position.Left} id="left-src" className="opacity-0" />
      <Handle type="target" position={Position.Right} id="right" className="opacity-0" />
      <Handle type="source" position={Position.Right} id="right-src" className="opacity-0" />

      {/* Pulsing beacon if active in path */}
      {(isSource || isInPath || isDestination) && (
        <span className="absolute -top-1 -right-1 flex h-3 w-3">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-3 w-3 bg-cyan-500"></span>
        </span>
      )}

      {/* Top row: Router ID and Role badge */}
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <div className="flex items-center gap-1.5">
          <div className={`p-1.5 rounded-lg ${isSource ? 'bg-emerald-500/20 text-emerald-400' : isDestination ? 'bg-violet-500/20 text-violet-400' : isInPath ? 'bg-cyan-500/20 text-cyan-400' : 'bg-slate-800 text-slate-400'}`}>
            <Server className="w-4 h-4" />
          </div>
          <span className="font-mono font-bold text-base tracking-wider text-white">{id}</span>
        </div>

        {roleBadge && (
          <span className={`text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full uppercase tracking-wider ${badgeClass}`}>
            {roleBadge}
          </span>
        )}
      </div>

      {/* IP Address and Loopback */}
      <div className="font-mono text-xs text-slate-300 flex items-center justify-between border-t border-slate-800/80 pt-1.5 mt-1">
        <span className="text-slate-400">IP:</span>
        <span className="text-cyan-300 font-medium">{ipAddress}</span>
      </div>

      {/* Router Status & Load */}
      <div className="flex items-center justify-between mt-2 pt-1 border-t border-slate-800/50 text-[10px] text-slate-400 font-mono">
        <div className="flex items-center gap-1">
          {status === 'active' ? (
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          ) : (
            <span className="w-2 h-2 rounded-full bg-rose-500"></span>
          )}
          <span className="capitalize">{status}</span>
        </div>

        <div className="flex items-center gap-1 text-slate-400">
          <Activity className="w-3 h-3 text-cyan-400" />
          <span>{data.cpuUsage}% CPU</span>
        </div>
      </div>
    </div>
  );
});

RouterNode.displayName = 'RouterNode';
