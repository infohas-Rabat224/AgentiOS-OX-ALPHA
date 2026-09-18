import React, { useState, useRef, useMemo } from 'react';
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  RefreshCw,
  Orbit,
  Sparkles,
  Layers,
  Info,
  Activity
} from 'lucide-react';
import { BrainRecord, BrainRelationship } from '../../types/missionControl';
import { getVendorColor, brainStatusToColor, VENDOR_NAMES } from '../../lib/brainsData';

interface BrainConstellationViewProps {
  brains: BrainRecord[];
  relationships: BrainRelationship[];
  selectedBrain?: BrainRecord | null;
  onSelectBrain: (brain: BrainRecord) => void;
}

interface ConstellationNode {
  id: string;
  x: number;
  y: number;
  r: number;
  brain: BrainRecord;
}

export const BrainConstellationView: React.FC<BrainConstellationViewProps> = ({
  brains,
  relationships,
  onSelectBrain,
}) => {
  const [zoom, setZoom] = useState<number>(1);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const width = 860;
  const height = 540;
  const cx = width / 2;
  const cy = height / 2;

  // Compute radial layout for nodes: Core orchestrator at center, satellites around it
  const nodes = useMemo(() => {
    if (!brains.length) return [];
    const coreBrain = brains.find((b) => b.priority === 10 || b.brain_type === 'orchestrator') || brains[0];
    const satellites = brains.filter((b) => b.id !== coreBrain.id);

    const result: ConstellationNode[] = [];

    // Core node
    result.push({
      id: coreBrain.id,
      x: cx,
      y: cy,
      r: 44,
      brain: coreBrain,
    });

    // Satellite rings
    const n = satellites.length;
    satellites.forEach((b, idx) => {
      // 2 concentric orbital tiers
      const isInner = idx % 2 === 0;
      const orbitRadius = isInner ? 140 : 220;
      const angle = (idx / n) * Math.PI * 2 - Math.PI / 2;
      result.push({
        id: b.id,
        x: cx + orbitRadius * Math.cos(angle),
        y: cy + orbitRadius * Math.sin(angle),
        r: isInner ? 32 : 26,
        brain: b,
      });
    });

    return result;
  }, [brains, cx, cy]);

  const nodeMap = useMemo(() => {
    const map = new Map<string, ConstellationNode>();
    nodes.forEach((n) => map.set(n.id, n));
    return map;
  }, [nodes]);

  // Starfield background
  const stars = useMemo(() => {
    const arr = [];
    for (let i = 0; i < 90; i++) {
      const x = ((i * 137.5) % width);
      const y = ((i * 224.3) % height);
      const opacity = 0.2 + ((i % 5) * 0.15);
      const radius = 0.8 + ((i % 3) * 0.5);
      arr.push({ x, y, opacity, radius });
    }
    return arr;
  }, [width, height]);

  // Mouse pan handling
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      setPan({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
    }
  };

  const handleMouseUp = () => setIsDragging(false);

  const selectedNode = nodeMap.get(selectedId || '')?.brain || null;

  return (
    <div className="relative w-full rounded-2xl overflow-hidden bg-[#07090e] border border-slate-800 shadow-2xl flex flex-col select-none">
      {/* Top Controls Overlay */}
      <div className="absolute top-4 left-4 right-4 z-10 flex items-center justify-between pointer-events-none">
        <div className="flex items-center space-x-2 bg-[#0e121d]/90 backdrop-blur-md px-3 py-1.5 rounded-lg border border-slate-800 pointer-events-auto shadow-md">
          <Orbit className="w-4 h-4 text-cyan-400 animate-spin" style={{ animationDuration: '30s' }} />
          <span className="text-xs font-mono font-semibold text-slate-200">
            Brain Constellation Neural Orbit
          </span>
          <span className="text-[10px] font-mono text-cyan-400 bg-cyan-950/60 px-1.5 py-0.5 rounded border border-cyan-800/40">
            {brains.length} Nodes Online
          </span>
        </div>

        <div className="flex items-center space-x-1.5 bg-[#0e121d]/90 backdrop-blur-md p-1 rounded-lg border border-slate-800 pointer-events-auto shadow-md">
          <button
            onClick={() => setZoom((z) => Math.min(2.0, z + 0.15))}
            className="p-1.5 text-slate-400 hover:text-white rounded hover:bg-slate-800 transition-colors cursor-pointer"
            title="Zoom In"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setZoom((z) => Math.max(0.6, z - 0.15))}
            className="p-1.5 text-slate-400 hover:text-white rounded hover:bg-slate-800 transition-colors cursor-pointer"
            title="Zoom Out"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => {
              setZoom(1);
              setPan({ x: 0, y: 0 });
            }}
            className="p-1.5 text-slate-400 hover:text-white rounded hover:bg-slate-800 transition-colors cursor-pointer"
            title="Reset View"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* SVG Stage */}
      <div
        className="w-full h-[520px] cursor-grab active:cursor-grabbing overflow-hidden"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-full"
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: 'center center',
            transition: isDragging ? 'none' : 'transform 0.15s ease-out',
          }}
        >
          <defs>
            {/* Ambient Radial Gradient */}
            <radialGradient id="space-glow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#00f0ff" stopOpacity="0.08" />
              <stop offset="60%" stopColor="#818cf8" stopOpacity="0.02" />
              <stop offset="100%" stopColor="#07090e" stopOpacity="0" />
            </radialGradient>

            {/* Glowing marker for edges */}
            <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          {/* Background Glow */}
          <rect width={width} height={height} fill="url(#space-glow)" />

          {/* Starfield */}
          {stars.map((s, idx) => (
            <circle
              key={idx}
              cx={s.x}
              cy={s.y}
              r={s.radius}
              fill="#ffffff"
              opacity={s.opacity}
            />
          ))}

          {/* Orbital Guide Rings */}
          <circle cx={cx} cy={cy} r={140} fill="none" stroke="#1e293b" strokeDasharray="4 6" strokeWidth={1} />
          <circle cx={cx} cy={cy} r={220} fill="none" stroke="#1e293b" strokeDasharray="4 8" strokeWidth={1} />

          {/* Relationship Edges */}
          {relationships.map((rel) => {
            const source = nodeMap.get(rel.source_id);
            const target = nodeMap.get(rel.target_id);
            if (!source || !target) return null;

            const isHovered = hoveredNode === rel.source_id || hoveredNode === rel.target_id;
            const strokeColor = rel.relationship_type === 'delegation' ? '#38bdf8'
              : rel.relationship_type === 'tool_usage' ? '#10b981'
              : rel.relationship_type === 'peer' ? '#818cf8'
              : rel.relationship_type === 'consensus' ? '#f59e0b' : '#64748b';

            return (
              <g key={rel.id} className="transition-opacity duration-200">
                <line
                  x1={source.x}
                  y1={source.y}
                  x2={target.x}
                  y2={target.y}
                  stroke={strokeColor}
                  strokeWidth={isHovered ? 2.5 : 1.2}
                  strokeOpacity={isHovered ? 0.9 : 0.35}
                  strokeDasharray={rel.relationship_type === 'fallback' ? '3 3' : undefined}
                />
                {/* Animated pulse dot along the edge */}
                <circle r={2.5} fill={strokeColor} opacity={0.85}>
                  <animateMotion
                    path={`M ${source.x} ${source.y} L ${target.x} ${target.y}`}
                    dur="3s"
                    repeatCount="indefinite"
                  />
                </circle>
              </g>
            );
          })}

          {/* Brain Nodes */}
          {nodes.map((node) => {
            const brain = node.brain;
            const vendorColor = getVendorColor(brain.vendor || brain.runtime);
            const statusColor = brainStatusToColor(brain.status);
            const isHovered = hoveredNode === node.id;
            const isSelected = selectedId === node.id;

            return (
              <g
                key={node.id}
                className="cursor-pointer transition-transform duration-200"
                onMouseEnter={() => setHoveredNode(node.id)}
                onMouseLeave={() => setHoveredNode(null)}
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedId(node.id);
                  onSelectBrain(brain);
                }}
              >
                {/* Outer Glow Halo */}
                <circle
                  cx={node.x}
                  cy={node.y}
                  r={node.r + (isHovered || isSelected ? 12 : 6)}
                  fill={vendorColor}
                  opacity={isHovered || isSelected ? 0.3 : 0.12}
                  filter="url(#glow)"
                />

                {/* Node Disc */}
                <circle
                  cx={node.x}
                  cy={node.y}
                  r={node.r}
                  fill="#0e121d"
                  stroke={isSelected ? '#00f0ff' : vendorColor}
                  strokeWidth={isSelected ? 3 : 2}
                  className="transition-all duration-200"
                />

                {/* Active Status Ping */}
                <circle
                  cx={node.x + node.r * 0.65}
                  cy={node.y - node.r * 0.65}
                  r={4.5}
                  fill={statusColor}
                />

                {/* Node Avatar Initial */}
                <text
                  x={node.x}
                  y={node.y + 4}
                  textAnchor="middle"
                  fill={vendorColor}
                  fontSize={node.r * 0.55}
                  fontFamily="monospace"
                  fontWeight="bold"
                  pointerEvents="none"
                >
                  {brain.display_name.charAt(0).toUpperCase()}
                </text>

                {/* Node Label Below */}
                <text
                  x={node.x}
                  y={node.y + node.r + 14}
                  textAnchor="middle"
                  fill={isHovered || isSelected ? '#ffffff' : '#94a3b8'}
                  fontSize={10}
                  fontFamily="monospace"
                  fontWeight={isSelected ? 'bold' : 'normal'}
                  pointerEvents="none"
                >
                  {brain.display_name}
                </text>
                <text
                  x={node.x}
                  y={node.y + node.r + 26}
                  textAnchor="middle"
                  fill="#64748b"
                  fontSize={8}
                  fontFamily="monospace"
                  pointerEvents="none"
                >
                  v{brain.version}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* Bottom Floating Legend / Quick Inspector */}
      <div className="p-3.5 bg-[#0e121d]/95 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-[11px] font-mono">
        <div className="flex flex-wrap items-center gap-3 text-slate-400">
          <span className="text-slate-500 uppercase">Edge Topology:</span>
          <span className="flex items-center">
            <span className="w-2.5 h-0.5 bg-sky-400 mr-1.5" /> Delegation
          </span>
          <span className="flex items-center">
            <span className="w-2.5 h-0.5 bg-emerald-400 mr-1.5" /> Tool Usage
          </span>
          <span className="flex items-center">
            <span className="w-2.5 h-0.5 bg-indigo-400 mr-1.5" /> Peer
          </span>
          <span className="flex items-center">
            <span className="w-2.5 h-0.5 bg-amber-400 mr-1.5" /> Consensus
          </span>
        </div>

        {selectedNode && (
          <div className="flex items-center space-x-2 bg-slate-900 px-3 py-1 rounded-md border border-slate-700">
            <span className="text-slate-400">Selected:</span>
            <span className="text-cyan-300 font-semibold">{selectedNode.display_name}</span>
            <span className="text-slate-500">({selectedNode.capabilities.length} capabilities)</span>
          </div>
        )}
      </div>
    </div>
  );
};
