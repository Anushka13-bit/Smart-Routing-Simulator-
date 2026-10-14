import React, { useMemo, useState } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  BackgroundVariant,
  type Node,
  type Edge,
} from '@xyflow/react';
import {
  Play,
  Pause,
  Zap,
  Layers,
  Info,
  X,
  RotateCcw,
  AlertTriangle,
} from 'lucide-react';
import { RouterNode } from './RouterNode';
import { NetworkEdge } from './NetworkEdge';
import type {
  RouterNodeData,
  NetworkLink,
  RouterId,
  RouteResult,
} from '../../types/network';
import { ROUTER_POSITIONS } from '../../services/mockData';

const nodeTypes = {
  routerNode: RouterNode,
};

const edgeTypes = {
  networkEdge: NetworkEdge,
};

interface NetworkTopologyProps {
  routers: RouterNodeData[];
  links: NetworkLink[];
  currentRoute: RouteResult | null;
  selectedSource: RouterId;
  selectedDestination: RouterId;
  onToggleLinkFail: (linkId: string) => void;
  onSelectRouter?: (routerId: RouterId) => void;
  onUpdateLinkMetrics?: (linkId: string, metrics: Partial<NetworkLink>) => void;
}

export const NetworkTopology: React.FC<NetworkTopologyProps> = ({
  routers,
  links,
  currentRoute,
  selectedSource,
  selectedDestination,
  onToggleLinkFail,
  onSelectRouter,
  onUpdateLinkMetrics,
}) => {
  // Animation state
  const [animatePackets, setAnimatePackets] = useState<boolean>(true);
  const [packetSpeed, setPacketSpeed] = useState<number>(2.0); // seconds per edge

  // Inspection Drawer
  const [inspectedRouterId, setInspectedRouterId] = useState<RouterId | null>(null);
  const [inspectedLink, setInspectedLink] = useState<NetworkLink | null>(null);

  // Active path lookup set
  const activeLinkSet = useMemo(() => {
    if (!currentRoute || !currentRoute.success) return new Set<string>();
    return new Set<string>(currentRoute.links);
  }, [currentRoute]);

  const pathRouters = useMemo(() => {
    if (!currentRoute || !currentRoute.success) return [];
    return currentRoute.path;
  }, [currentRoute]);

  // Construct React Flow Nodes
  const initialNodes: Node[] = useMemo(() => {
    return routers.map((r) => {
      const isSource = r.id === selectedSource;
      const isDestination = r.id === selectedDestination;
      const isInPath = pathRouters.includes(r.id) && !isSource && !isDestination;
      const pathOrder = pathRouters.indexOf(r.id);

      return {
        id: r.id,
        type: 'routerNode',
        position: ROUTER_POSITIONS[r.id] || { x: 200, y: 200 },
        data: {
          ...r,
          isSource,
          isDestination,
          isInPath,
          pathOrder: pathOrder >= 0 ? pathOrder + 1 : undefined,
          isSelected: inspectedRouterId === r.id,
          onSelectRouter: (id: string) => {
            setInspectedRouterId(id as RouterId);
            setInspectedLink(null);
            if (onSelectRouter) onSelectRouter(id as RouterId);
          },
        },
      };
    });
  }, [routers, selectedSource, selectedDestination, pathRouters, inspectedRouterId, onSelectRouter]);

  // Construct React Flow Edges
  const initialEdges: Edge[] = useMemo(() => {
    return links.map((l) => {
      const isPathActive = activeLinkSet.has(l.id);

      return {
        id: l.id,
        source: l.source,
        target: l.target,
        type: 'networkEdge',
        data: {
          ...l,
          isPathActive,
          animatePacket: animatePackets,
          packetSpeed,
          onToggleFail: onToggleLinkFail,
          onSelectLink: (link: NetworkLink) => {
            setInspectedLink(link);
            setInspectedRouterId(null);
          },
        },
      };
    });
  }, [links, activeLinkSet, animatePackets, packetSpeed, onToggleLinkFail]);

  // Keep inspected link fresh if updated externally
  const activeInspectedLink = useMemo(() => {
    if (!inspectedLink) return null;
    return links.find((l) => l.id === inspectedLink.id) || inspectedLink;
  }, [inspectedLink, links]);

  const inspectedRouter = useMemo(() => {
    if (!inspectedRouterId) return null;
    return routers.find((r) => r.id === inspectedRouterId) || null;
  }, [inspectedRouterId, routers]);

  return (
    <div className="relative w-full h-[620px] rounded-2xl overflow-hidden border border-slate-800 bg-[#0A0E1A] shadow-2xl flex flex-col">
      {/* Top Floating Control Bar */}
      <div className="absolute top-4 left-4 right-4 z-20 flex flex-wrap items-center justify-between gap-3 pointer-events-none">
        {/* Left: Topology HUD & Status Badges */}
        <div className="pointer-events-auto flex items-center gap-2 bg-slate-900/90 backdrop-blur-md px-3.5 py-2 rounded-xl border border-slate-700/80 shadow-lg">
          <div className="flex items-center gap-1.5 text-xs font-mono text-slate-300">
            <Layers className="w-4 h-4 text-cyan-400" />
            <span className="font-semibold text-white">Mesh Topology</span>
            <span className="text-slate-500">|</span>
            <span className="text-cyan-400 font-semibold">{routers.length} Nodes</span>
            <span className="text-slate-500">•</span>
            <span className="text-emerald-400">{links.filter((l) => l.status === 'active').length} Active Links</span>
            {links.some((l) => l.status === 'failed') && (
              <>
                <span className="text-slate-500">•</span>
                <span className="text-rose-400 font-semibold animate-pulse">
                  {links.filter((l) => l.status === 'failed').length} Down
                </span>
              </>
            )}
          </div>
        </div>

        {/* Right: Packet Animation Controls & Speed */}
        <div className="pointer-events-auto flex items-center gap-2 bg-slate-900/90 backdrop-blur-md px-3 py-1.5 rounded-xl border border-slate-700/80 shadow-lg">
          <button
            onClick={() => setAnimatePackets(!animatePackets)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
              animatePackets
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                : 'bg-slate-800 text-slate-400 hover:text-slate-200'
            }`}
            title="Toggle animated data packet flow along active route"
          >
            {animatePackets ? (
              <>
                <Pause className="w-3.5 h-3.5" />
                <span>Pause Packets</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5" />
                <span>Animate Flow</span>
              </>
            )}
          </button>

          <div className="flex items-center gap-1 text-xs text-slate-400 pl-2 border-l border-slate-700">
            <Zap className="w-3 h-3 text-amber-400" />
            <span className="text-[11px] font-mono">Speed:</span>
            <select
              value={packetSpeed}
              onChange={(e) => setPacketSpeed(parseFloat(e.target.value))}
              className="bg-slate-800 text-cyan-300 text-xs rounded px-1.5 py-0.5 border border-slate-700 focus:outline-none focus:border-cyan-500 font-mono"
            >
              <option value={3.5}>0.5x Slow</option>
              <option value={2.0}>1.0x Normal</option>
              <option value={1.0}>2.0x Fast</option>
              <option value={0.5}>4.0x Turbo</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main React Flow Graph Viewport */}
      <div className="w-full h-full flex-1">
        <ReactFlow
          nodes={initialNodes}
          edges={initialEdges}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          fitView
          fitViewOptions={{ padding: 0.25 }}
          minZoom={0.5}
          maxZoom={1.6}
          proOptions={{ hideAttribution: true }}
          className="bg-[#070B14]"
        >
          <Background
            variant={BackgroundVariant.Dots}
            gap={24}
            size={1.5}
            color="#1E293B"
          />
          <Controls
            className="!bg-slate-900/90 !border !border-slate-800 !rounded-xl !overflow-hidden [&>button]:!bg-slate-900 [&>button]:!border-slate-800 [&>button]:!text-slate-300 [&>button:hover]:!bg-slate-800 [&>button:hover]:!text-cyan-400"
          />
          <MiniMap
            nodeColor={(n) => {
              if (n.id === selectedSource) return '#10B981';
              if (n.id === selectedDestination) return '#8B5CF6';
              if (pathRouters.includes(n.id as RouterId)) return '#06B6D4';
              return '#334155';
            }}
            maskColor="rgba(7, 11, 20, 0.75)"
            className="!bg-slate-950/90 !border !border-slate-800 !rounded-xl !overflow-hidden"
          />
        </ReactFlow>
      </div>

      {/* Bottom Visual Legend */}
      <div className="absolute bottom-4 left-4 z-20 flex flex-wrap items-center gap-2 bg-slate-950/80 backdrop-blur-md px-3.5 py-2 rounded-xl border border-slate-800 text-[11px] font-mono text-slate-400 shadow-md">
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-glow-emerald"></span>
          <span>Source ({selectedSource})</span>
        </div>
        <span className="text-slate-600">•</span>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-violet-500 shadow-glow-violet"></span>
          <span>Dest ({selectedDestination})</span>
        </div>
        <span className="text-slate-600">•</span>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-1 bg-cyan-400 rounded-full shadow-glow-cyan"></span>
          <span>Active Route</span>
        </div>
        <span className="text-slate-600">•</span>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-0.5 border-b-2 border-dashed border-rose-500"></span>
          <span>Failed Link</span>
        </div>
      </div>

      {/* Slide-in Details Drawer for Router / Link Inspection */}
      {(inspectedRouter || activeInspectedLink) && (
        <div className="absolute top-4 right-4 bottom-4 w-80 z-30 bg-slate-900/95 backdrop-blur-xl border border-slate-700/80 rounded-2xl shadow-2xl p-5 flex flex-col justify-between overflow-y-auto animate-in slide-in-from-right-4 duration-300">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Info className="w-4 h-4 text-cyan-400" />
                <h3 className="font-semibold text-white text-sm">
                  {inspectedRouter ? `Router ${inspectedRouter.id}` : `Link ${activeInspectedLink?.id}`}
                </h3>
              </div>
              <button
                onClick={() => {
                  setInspectedRouterId(null);
                  setInspectedLink(null);
                }}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Router Inspection Mode */}
            {inspectedRouter && (
              <div className="mt-4 space-y-4 text-xs font-mono">
                <div>
                  <span className="text-slate-400">Node Description:</span>
                  <p className="text-slate-200 mt-1 font-sans text-xs">{inspectedRouter.description}</p>
                </div>

                <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800 space-y-2">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Primary IP:</span>
                    <span className="text-cyan-400 font-bold">{inspectedRouter.ipAddress}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Loopback:</span>
                    <span className="text-slate-300">{inspectedRouter.loopback}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Status:</span>
                    <span className={inspectedRouter.status === 'active' ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                      {inspectedRouter.status.toUpperCase()}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">CPU Usage:</span>
                    <span className="text-amber-400">{inspectedRouter.cpuUsage}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Memory:</span>
                    <span className="text-slate-300">{inspectedRouter.memoryUsage}%</span>
                  </div>
                </div>

                <div>
                  <span className="text-slate-400 font-semibold mb-2 block">Connected Interfaces:</span>
                  <div className="space-y-1.5">
                    {inspectedRouter.interfaces.map((iface) => (
                      <div
                        key={iface.name}
                        className="bg-slate-800/50 p-2 rounded-lg border border-slate-700/50 flex justify-between items-center"
                      >
                        <div>
                          <div className="text-cyan-300 font-bold">{iface.name}</div>
                          <div className="text-[10px] text-slate-400">{iface.ip}</div>
                        </div>
                        <div className="text-right">
                          <span className="text-slate-300 font-bold">➔ {iface.connectedTo}</span>
                          <span className="block text-[10px] text-emerald-400">UP</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Link Inspection Mode */}
            {activeInspectedLink && (
              <div className="mt-4 space-y-4 text-xs font-mono">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Endpoints:</span>
                  <span className="text-white font-bold text-sm">
                    {activeInspectedLink.source} ⟷ {activeInspectedLink.target}
                  </span>
                </div>

                <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800 space-y-2.5">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">Routing Metric (Cost):</span>
                    <span className="text-cyan-400 font-bold text-sm">{activeInspectedLink.cost}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">Delay / Latency:</span>
                    <span className="text-amber-300">{activeInspectedLink.delayMs} ms</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">Bandwidth:</span>
                    <span className="text-emerald-400">{activeInspectedLink.bandwidthMbps} Mbps</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">Link Congestion:</span>
                    <div className="flex items-center gap-1.5">
                      <div className="w-16 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-cyan-400 rounded-full"
                          style={{ width: `${activeInspectedLink.congestionPercent}%` }}
                        />
                      </div>
                      <span className="text-slate-300">{activeInspectedLink.congestionPercent}%</span>
                    </div>
                  </div>
                  <div className="flex justify-between items-center pt-1 border-t border-slate-800">
                    <span className="text-slate-400">Current Status:</span>
                    <span
                      className={`font-bold px-2 py-0.5 rounded text-[11px] ${
                        activeInspectedLink.status === 'active'
                          ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                          : 'bg-rose-950 text-rose-400 border border-rose-800'
                      }`}
                    >
                      {activeInspectedLink.status.toUpperCase()}
                    </span>
                  </div>
                </div>

                {onUpdateLinkMetrics && activeInspectedLink.status === 'active' && (
                  <div className="pt-2 flex items-center justify-between bg-slate-950/60 p-2.5 rounded-xl border border-slate-800">
                    <span className="text-slate-400 font-mono text-[11px]">Adjust Cost Metric:</span>
                    <div className="flex items-center gap-1.5 font-mono">
                      <button
                        type="button"
                        onClick={() => onUpdateLinkMetrics(activeInspectedLink.id, { cost: Math.max(1, activeInspectedLink.cost - 1) })}
                        className="w-6 h-6 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold flex items-center justify-center text-xs"
                        title="Decrease Metric Cost"
                      >
                        -
                      </button>
                      <span className="text-cyan-400 font-bold w-6 text-center text-xs">{activeInspectedLink.cost}</span>
                      <button
                        type="button"
                        onClick={() => onUpdateLinkMetrics(activeInspectedLink.id, { cost: activeInspectedLink.cost + 1 })}
                        className="w-6 h-6 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold flex items-center justify-center text-xs"
                        title="Increase Metric Cost"
                      >
                        +
                      </button>
                    </div>
                  </div>
                )}

                {/* Direct Action Button in Inspector */}
                <div className="pt-2">
                  <button
                    onClick={() => onToggleLinkFail(activeInspectedLink.id)}
                    className={`w-full py-2.5 px-4 rounded-xl font-sans font-semibold text-xs flex items-center justify-center gap-2 transition-all shadow-lg ${
                      activeInspectedLink.status === 'active'
                        ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-glow-rose'
                        : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-glow-emerald'
                    }`}
                  >
                    {activeInspectedLink.status === 'active' ? (
                      <>
                        <AlertTriangle className="w-4 h-4" />
                        <span>Simulate Link Cut (Break Link)</span>
                      </>
                    ) : (
                      <>
                        <RotateCcw className="w-4 h-4" />
                        <span>Restore Link to Active</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="pt-3 border-t border-slate-800 text-[10px] text-slate-500 font-mono text-center">
            Click outside or on another element to switch inspection target
          </div>
        </div>
      )}
    </div>
  );
};
