// src/components/topology/NetworkEdge.tsx
import React, { memo } from 'react';
import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  type EdgeProps,
} from '@xyflow/react';
import { AlertOctagon, CheckCircle2 } from 'lucide-react';
import type { NetworkLink } from '../../types/network';

interface CustomEdgeData extends NetworkLink {
  isPathActive?: boolean;
  packetSpeed?: number; // duration in seconds
  animatePacket?: boolean;
  onToggleFail?: (linkId: string) => void;
  onSelectLink?: (link: NetworkLink) => void;
}

export const NetworkEdge: React.FC<EdgeProps> = memo(({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  markerEnd,
  data,
}) => {
  const edgeData = (data as unknown) as CustomEdgeData;
  const isFailed = edgeData?.status === 'failed';
  const isPathActive = edgeData?.isPathActive && !isFailed;
  const animatePacket = edgeData?.animatePacket ?? true;
  const packetSpeed = edgeData?.packetSpeed || 2.2;

  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetPosition,
    targetX,
    targetY,
    curvature: 0.15,
  });

  return (
    <>
      {/* Background glow stroke if active in route */}
      {isPathActive && (
        <path
          d={edgePath}
          fill="none"
          stroke="#06B6D4"
          strokeWidth={8}
          strokeOpacity={0.35}
          className="blur-[4px] pointer-events-none"
        />
      )}

      {/* Main Connection Path */}
      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={markerEnd}
        style={{
          ...style,
          stroke: isFailed ? '#EF4444' : isPathActive ? '#22D3EE' : '#334155',
          strokeWidth: isPathActive ? 3.5 : isFailed ? 2.5 : 2,
          strokeDasharray: isFailed ? '6 6' : isPathActive ? '8 4' : undefined,
          strokeLinecap: 'round',
          transition: 'stroke 0.3s, stroke-width 0.3s',
        }}
        className={isPathActive ? 'animated-active-edge' : ''}
      />

      {/* Animated Packet Moving along the route */}
      {isPathActive && animatePacket && (
        <g>
          {/* Packet Halo */}
          <circle r="6" fill="#06B6D4" fillOpacity="0.6">
            <animateMotion
              path={edgePath}
              dur={`${packetSpeed}s`}
              repeatCount="indefinite"
              rotate="auto"
            />
          </circle>
          {/* Packet Core */}
          <circle r="3.5" fill="#FFFFFF">
            <animateMotion
              path={edgePath}
              dur={`${packetSpeed}s`}
              repeatCount="indefinite"
              rotate="auto"
            />
          </circle>
        </g>
      )}

      {/* Interactive Edge Label Pill */}
      <EdgeLabelRenderer>
        <div
          style={{
            position: 'absolute',
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            pointerEvents: 'all',
          }}
          className="nodrag nopan"
        >
          <div
            onClick={(e) => {
              e.stopPropagation();
              if (edgeData?.onSelectLink) {
                edgeData.onSelectLink(edgeData);
              }
            }}
            className={`group flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono backdrop-blur-md shadow-lg border transition-all duration-200 cursor-pointer ${
              isFailed
                ? 'bg-rose-950/90 text-rose-300 border-rose-500/80 shadow-glow-rose'
                : isPathActive
                ? 'bg-cyan-950/90 text-cyan-200 border-cyan-400 shadow-glow-cyan font-semibold'
                : 'bg-slate-900/90 text-slate-300 border-slate-700 hover:border-slate-500 hover:bg-slate-800'
            }`}
            title={`Link ${id}: Click to inspect or toggle state`}
          >
            {isFailed ? (
              <div className="flex items-center gap-1 text-rose-400 font-bold">
                <AlertOctagon className="w-3.5 h-3.5 animate-pulse" />
                <span>LINK DOWN</span>
              </div>
            ) : (
              <>
                <span className="text-cyan-400 font-semibold">C:{edgeData?.cost}</span>
                <span className="text-slate-500">•</span>
                <span className="text-slate-300">{edgeData?.delayMs}ms</span>
                <span className="text-slate-500 hidden sm:inline">•</span>
                <span className="text-slate-400 hidden sm:inline">{edgeData?.bandwidthMbps}M</span>
              </>
            )}

            {/* Quick Toggle Fail/Restore Button on hover */}
            {edgeData?.onToggleFail && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  edgeData.onToggleFail!(id);
                }}
                className={`ml-1 p-0.5 rounded transition-colors ${
                  isFailed
                    ? 'text-emerald-400 hover:text-emerald-300 hover:bg-emerald-950/80'
                    : 'text-slate-400 hover:text-rose-400 hover:bg-rose-950/80'
                }`}
                title={isFailed ? 'Restore Link' : 'Simulate Link Failure'}
              >
                {isFailed ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  <span className="text-[10px] text-rose-400 opacity-60 group-hover:opacity-100 font-sans font-bold">✕</span>
                )}
              </button>
            )}
          </div>
        </div>
      </EdgeLabelRenderer>
    </>
  );
});

NetworkEdge.displayName = 'NetworkEdge';
