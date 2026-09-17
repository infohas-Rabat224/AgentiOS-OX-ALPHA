import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { RefreshCw, ZoomIn, ZoomOut, Anchor, Maximize2 } from 'lucide-react';
import { BrainRecord } from '../../types/missionControl';

interface AIBrainNeuralViewProps {
  brains?: BrainRecord[];
  onRescan?: () => void;
  onSelectBrain?: (brain: BrainRecord) => void;
}

// Exact provider colors matching cloned repo
const PROVIDER_COLORS: Record<string, string> = {
  claude: '#d980ff',
  hermes: '#00f0ff',
  opencode: '#38bdf8',
  agy: '#f472b6',
  gemini: '#f97316',
  codex: '#818cf8',
  python: '#00f0ff',
  git: '#00f0ff',
  node: '#00f0ff',
  default: '#00f0ff',
};

function getProviderColor(name: string): string {
  const low = name.toLowerCase();
  for (const k of Object.keys(PROVIDER_COLORS)) {
    if (low.includes(k)) return PROVIDER_COLORS[k];
  }
  return '#00f0ff';
}

// Deterministic starfield
const STARFIELD = (() => {
  const stars: { x: number; y: number; r: number; o: number }[] = [];
  let seed = 7;
  const rnd = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  for (let i = 0; i < 140; i++) {
    stars.push({
      x: Math.round(rnd() * 1000) / 10,
      y: Math.round(rnd() * 1000) / 10,
      r: 0.4 + rnd() * 1.2,
      o: 0.15 + rnd() * 0.45,
    });
  }
  return stars;
})();

// Deterministic synaptic noise particles in the neural band
const SYNAPTIC_PARTICLES = (() => {
  const parts: { x: number; y: number; d: number; s: number }[] = [];
  let seed = 13;
  const rnd = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  for (let i = 0; i < 80; i++) {
    parts.push({
      x: 15 + rnd() * 70,
      y: 35 + rnd() * 30,
      d: 1 + rnd() * 2,
      s: 0.5 + rnd() * 1.5,
    });
  }
  return parts;
})();

// Reference 16 discovered agent nodes matching user's screen
const DEFAULT_16_NODES = [
  // Upper row (8 nodes)
  { id: 'claude_code', name: 'CLAUDE_CODE', status: 'HEALTHY', color: '#d980ff', row: 0, col: 0, totalInRow: 8 },
  { id: 'hermes', name: 'HERMES', status: 'DOWN', color: '#00f0ff', row: 0, col: 1, totalInRow: 8 },
  { id: 'auto_codex', name: 'AUTO:CODEX', status: 'HEALTHY', color: '#818cf8', row: 0, col: 2, totalInRow: 8 },
  { id: 'auto_opencode', name: 'AUTO:OPENCODE', status: 'DOWN', color: '#38bdf8', row: 0, col: 3, totalInRow: 8 },
  { id: 'auto_agy', name: 'AUTO:AGY', status: 'HEALTHY', color: '#f472b6', row: 0, col: 4, totalInRow: 8 },
  { id: 'auto_gemini', name: 'AUTO:GEMINI', status: 'DOWN', color: '#f97316', row: 0, col: 5, totalInRow: 8 },
  { id: 'python', name: 'PYTHON', status: 'UNKNOWN', color: '#00f0ff', row: 0, col: 6, totalInRow: 8 },
  { id: 'git', name: 'GIT', status: 'UNKNOWN', color: '#00f0ff', row: 0, col: 7, totalInRow: 8 },
  // Lower row (8 nodes)
  { id: 'hermes_agent', name: 'HERMES AGENT', status: 'UNKNOWN', color: '#00f0ff', row: 1, col: 0, totalInRow: 8 },
  { id: 'codex_cli', name: 'CODEX CLI', status: 'UNKNOWN', color: '#818cf8', row: 1, col: 1, totalInRow: 8 },
  { id: 'opencode', name: 'OPENCODE', status: 'UNKNOWN', color: '#38bdf8', row: 1, col: 2, totalInRow: 8 },
  { id: 'node_js', name: 'NODE.JS', status: 'UNKNOWN', color: '#00f0ff', row: 1, col: 3, totalInRow: 8 },
  { id: 'claude_code_2', name: 'CLAUDE CODE', status: 'UNKNOWN', color: '#d980ff', row: 1, col: 4, totalInRow: 8 },
  { id: 'gemini_cli', name: 'GEMINI CLI', status: 'UNKNOWN', color: '#f97316', row: 1, col: 5, totalInRow: 8 },
  { id: 'codex', name: 'CODEX', status: 'UNKNOWN', color: '#818cf8', row: 1, col: 6, totalInRow: 8 },
  { id: 'node', name: 'NODE', status: 'UNKNOWN', color: '#00f0ff', row: 1, col: 7, totalInRow: 8 },
];

export const AIBrainNeuralView: React.FC<AIBrainNeuralViewProps> = ({
  brains,
  onRescan,
}) => {
  const [zoomLevel, setZoomLevel] = useState(1);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [isAnchored, setIsAnchored] = useState(true);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);

  const dragRef = useRef<{ active: boolean; startX: number; startY: number; baseX: number; baseY: number }>({
    active: false,
    startX: 0,
    startY: 0,
    baseX: 0,
    baseY: 0,
  });

  const onPanStart = useCallback((e: React.MouseEvent) => {
    if (isAnchored) return;
    dragRef.current = {
      active: true,
      startX: e.clientX,
      startY: e.clientY,
      baseX: panOffset.x,
      baseY: panOffset.y,
    };
  }, [isAnchored, panOffset]);

  const onPanMove = useCallback((e: React.MouseEvent) => {
    const d = dragRef.current;
    if (!d.active) return;
    setPanOffset({
      x: d.baseX + (e.clientX - d.startX),
      y: d.baseY + (e.clientY - d.startY),
    });
  }, []);

  const onPanEnd = useCallback(() => {
    dragRef.current.active = false;
  }, []);

  const zoomIn = () => setZoomLevel((z) => Math.min(z * 1.2, 3));
  const zoomOut = () => setZoomLevel((z) => Math.max(z / 1.2, 0.5));
  const resetView = () => {
    setZoomLevel(1);
    setPanOffset({ x: 0, y: 0 });
  };
  const toggleAnchor = () => setIsAnchored((a) => !a);

  // Keyboard navigation
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      switch (e.key) {
        case '=':
        case '+':
          e.preventDefault();
          zoomIn();
          break;
        case '-':
        case '_':
          e.preventDefault();
          zoomOut();
          break;
        case '0':
          e.preventDefault();
          resetView();
          break;
        case 'a':
        case 'A':
          e.preventDefault();
          toggleAnchor();
          break;
        case 'r':
        case 'R':
          e.preventDefault();
          if (onRescan) onRescan();
          break;
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onRescan]);

  useEffect(() => {
    if (isAnchored) {
      setPanOffset({ x: 0, y: 0 });
    }
  }, [isAnchored]);

  // Compute brain nodes layout
  const brainNodes = useMemo(() => {
    const coreNode = {
      id: 'ai_core',
      name: 'AI CORE',
      status: 'ACTIVE',
      color: '#00f0ff',
      isCore: true,
      pos: { x: 50, y: 50 },
      cpu: 42,
      ram: 68,
      tasks: 3,
    };

    // Satellite nodes mapped across the neural band
    const outerNodes = DEFAULT_16_NODES.map((def) => {
      const { col, row, totalInRow } = def;
      // Spread across x: 14% to 86%
      const x = 14 + ((col + 0.5) / totalInRow) * 72;
      const y = row === 0 ? 38 : 62;

      // Slight natural organic jitter
      const angle = (def.col * 2.39996) % (Math.PI * 2);
      const jitterX = Math.cos(angle) * 1.5;
      const jitterY = Math.sin(angle) * 1.2;

      return {
        id: def.id,
        name: def.name,
        status: def.status,
        color: def.color,
        isCore: false,
        pos: { x: Math.round(x + jitterX), y: Math.round(y + jitterY) },
        cpu: def.status === 'HEALTHY' ? 34 : 0,
        ram: def.status === 'HEALTHY' ? 48 : 0,
        tasks: def.status === 'HEALTHY' ? 1 : 0,
      };
    });

    return [coreNode, ...outerNodes];
  }, []);

  // Compute synaptic connections between core and all satellites + mesh links
  const connections = useMemo(() => {
    const conns: { from: string; to: string; color: string; weight: number }[] = [];
    const outerNodes = brainNodes.filter((n) => !n.isCore);

    // Primary Core Synapses
    outerNodes.forEach((n) => {
      conns.push({ from: n.id, to: 'ai_core', color: n.color, weight: 1.5 });
    });

    // Lateral mesh links
    for (let i = 0; i < outerNodes.length; i++) {
      for (let j = i + 1; j < outerNodes.length; j++) {
        const dx = outerNodes[i].pos.x - outerNodes[j].pos.x;
        const dy = outerNodes[i].pos.y - outerNodes[j].pos.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 18) {
          conns.push({
            from: outerNodes[i].id,
            to: outerNodes[j].id,
            color: 'rgba(56, 189, 248, 0.25)',
            weight: 0.7,
          });
        }
      }
    }
    return conns;
  }, [brainNodes]);

  // Live log items matching user screenshot
  const liveEvents = [
    { time: '13:01:06', detail: 'provider health {"provider": "auto:gemini", "status": "down"}' },
    { time: '13:01:06', detail: 'provider health {"provider": "auto:agy", "status": "healthy"}' },
    { time: '13:01:06', detail: 'provider health {"provider": "auto:opencode", "status": "down"}' },
    { time: '13:01:06', detail: 'provider health {"provider": "auto:codex", "status": "healthy"}' },
    { time: '13:01:06', detail: 'provider health {"provider": "hermes", "status": "down"}' },
  ];

  const commPairs = [
    { pair: 'claude_code → hermes', rate: '0 msg/min' },
    { pair: 'claude_code → auto:codex', rate: '0 msg/min' },
    { pair: 'claude_code → auto:opencode', rate: '0 msg/min' },
    { pair: 'claude_code → auto:agy', rate: '0 msg/min' },
    { pair: 'claude_code → auto:gemini', rate: '0 msg/min' },
  ];

  return (
    <div className="relative h-[calc(100vh-5.5rem)] w-full bg-[#010209] text-slate-100 font-sans select-none overflow-hidden text-xs rounded-xl border border-slate-900 shadow-2xl">
      {/* Deep cosmic void background with radial gradients */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse 120% 100% at 50% 50%, rgba(0,240,255,0.06) 0%, transparent 50%),' +
            'radial-gradient(ellipse 80% 60% at 50% 50%, rgba(56,189,248,0.04) 0%, transparent 45%),' +
            'radial-gradient(600px 400px at 20% 20%, rgba(217,128,255,0.03), transparent 60%),' +
            'radial-gradient(600px 400px at 80% 80%, rgba(129,140,248,0.03), transparent 60%)',
        }}
      />

      {/* Starfield */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-60">
        {STARFIELD.map((s, i) => (
          <circle key={i} cx={`${s.x}%`} cy={`${s.y}%`} r={s.r} fill="#67e8f9" opacity={s.o} />
        ))}
      </svg>

      {/* Neural Band luminous glow */}
      <div
        className="absolute left-[8%] right-[8%] top-[28%] bottom-[28%] pointer-events-none"
        style={{
          background:
            'linear-gradient(180deg, transparent 0%, rgba(0,240,255,0.02) 20%, rgba(0,240,255,0.07) 50%, rgba(0,240,255,0.02) 80%, transparent 100%)',
          filter: 'blur(50px)',
        }}
      />

      {/* Neural band horizontal streak lines */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-30">
        <defs>
          <linearGradient id="neuralStreak" x1="0%" y1="50%" x2="100%" y2="50%">
            <stop offset="0%" stopColor="#00f0ff" stopOpacity="0" />
            <stop offset="50%" stopColor="#00f0ff" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#00f0ff" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[38, 44, 50, 56, 62].map((y, i) => (
          <line
            key={i}
            x1="6%"
            x2="94%"
            y1={`${y}%`}
            y2={`${y}%`}
            stroke="url(#neuralStreak)"
            strokeWidth={i === 2 ? 1.5 : 0.6}
            strokeDasharray="40 20"
          />
        ))}
      </svg>

      {/* ── TOP FLOATING BAR: TITLE + EVENT FLOW + CONTROLS ── */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-3 max-w-[95%]">
        {/* Title pill */}
        <div className="flex items-center gap-2 bg-[#050a1c]/80 backdrop-blur-md border border-cyan-500/20 rounded-lg px-3 py-1.5 shadow-[0_0_24px_rgba(0,0,0,0.7)]">
          <h1 className="text-xs font-bold tracking-[0.15em] text-white uppercase font-mono">
            AI BRAIN CONSTELLATION
          </h1>
          <span className="px-1.5 py-0.5 rounded bg-cyan-500/15 text-cyan-300 text-[8px] font-mono border border-cyan-500/40 animate-pulse">
            LIVE
          </span>
        </div>

        {/* Event Flow */}
        <div className="bg-[#050a1c]/80 backdrop-blur-md border border-cyan-500/20 rounded-lg px-3 py-1.5 shadow-[0_0_24px_rgba(0,0,0,0.7)] min-w-[130px]">
          <div className="flex items-center justify-between text-slate-400 text-[8px] uppercase tracking-wider">
            <span>EVENT FLOW</span>
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
          </div>
          <div className="text-sm font-bold font-mono text-white flex items-baseline gap-1 mt-0.5">
            <span>28</span>
            <span className="text-[8px] text-cyan-400 font-normal">events</span>
          </div>
          <div className="h-3.5 mt-0.5 flex items-end gap-0.5">
            {[20, 45, 30, 65, 80, 50, 95, 40, 60, 85, 30, 70, 90, 60, 40, 75].map((h, i) => (
              <div
                key={i}
                className="flex-1 bg-cyan-500/40 rounded-xs"
                style={{ height: `${h}%` }}
              />
            ))}
          </div>
        </div>

        {/* View Controls */}
        <div className="flex items-center gap-1 bg-[#050a1c]/80 backdrop-blur-md border border-cyan-500/20 rounded-lg px-2 py-1 shadow-[0_0_24px_rgba(0,0,0,0.7)]">
          <span className="px-1 py-0.5 rounded bg-cyan-500/20 text-cyan-300 text-[8px]">3D</span>
          <button
            onClick={() => onRescan && onRescan()}
            className="hover:text-white transition-colors p-1 cursor-pointer"
            title="Refresh"
          >
            <RefreshCw className="w-3.5 h-3.5 text-slate-300" />
          </button>
          <button
            onClick={zoomIn}
            className="hover:text-white transition-colors p-1 cursor-pointer"
            title="Zoom In"
          >
            <ZoomIn className="w-3.5 h-3.5 text-slate-300" />
          </button>
          <button
            onClick={zoomOut}
            className="hover:text-white transition-colors p-1 cursor-pointer"
            title="Zoom Out"
          >
            <ZoomOut className="w-3.5 h-3.5 text-slate-300" />
          </button>
          <button
            onClick={resetView}
            className="hover:text-white transition-colors p-1 cursor-pointer"
            title="Reset View"
          >
            <Maximize2 className="w-3.5 h-3.5 text-slate-300" />
          </button>
          <button
            onClick={toggleAnchor}
            className={`hover:text-white transition-colors p-1 cursor-pointer ${
              isAnchored ? 'text-cyan-400' : 'text-slate-500'
            }`}
            title="Toggle Anchor"
          >
            <Anchor className="w-3.5 h-3.5" />
          </button>
          <span className="px-1.5 py-0.5 rounded bg-slate-900/60 border border-slate-700 text-[8px] font-mono text-cyan-300 ml-1">
            {Math.round(zoomLevel * 100)}%
          </span>
        </div>
      </div>

      {/* ── CENTRAL NEURAL CANVAS ── */}
      <div
        className="absolute inset-0 flex items-center justify-center cursor-grab active:cursor-grabbing"
        onMouseDown={onPanStart}
        onMouseMove={onPanMove}
        onMouseUp={onPanEnd}
        onMouseLeave={onPanEnd}
      >
        <div
          className="relative w-full h-full min-w-0 min-h-0 transition-transform duration-150"
          style={{
            transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoomLevel})`,
            transformOrigin: 'center center',
          }}
        >
          {/* Synaptic connection pathways */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none">
            {connections.map((conn, idx) => {
              const fromNode = brainNodes.find((n) => n.id === conn.from);
              const toNode = brainNodes.find((n) => n.id === conn.to);
              if (!fromNode || !toNode) return null;
              const isCore = conn.to === 'ai_core' || conn.from === 'ai_core';
              return (
                <g key={idx}>
                  <line
                    x1={`${fromNode.pos.x}%`}
                    y1={`${fromNode.pos.y}%`}
                    x2={`${toNode.pos.x}%`}
                    y2={`${toNode.pos.y}%`}
                    stroke={conn.color}
                    strokeWidth={conn.weight}
                    strokeOpacity={isCore ? 0.45 : 0.25}
                    className="animate-dash-flow"
                    strokeDasharray={isCore ? '8 6' : '4 8'}
                    strokeLinecap="round"
                  />
                  {/* Synaptic boutons along the connection */}
                  {[0.35, 0.7].map((t, ti) => (
                    <circle
                      key={ti}
                      cx={`${fromNode.pos.x + (toNode.pos.x - fromNode.pos.x) * t}%`}
                      cy={`${fromNode.pos.y + (toNode.pos.y - fromNode.pos.y) * t}%`}
                      r="1.5"
                      fill={conn.color}
                      opacity={isCore ? 0.7 : 0.3}
                      className="animate-pulse"
                    />
                  ))}
                </g>
              );
            })}
          </svg>

          {/* Synaptic noise particles in the neural band */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-40">
            {SYNAPTIC_PARTICLES.map((p, i) => (
              <circle
                key={i}
                cx={`${p.x}%`}
                cy={`${p.y}%`}
                r={p.d}
                fill="#67e8f9"
                opacity={p.s * 0.4}
                className="animate-pulse"
                style={{
                  animationDuration: `${2 + (i % 3)}s`,
                  animationDelay: `${i * 0.05}s`,
                }}
              />
            ))}
          </svg>

          {/* Render All Brain Nodes */}
          {brainNodes.map((node) => {
            const isCenter = node.isCore;
            return (
              <div
                key={node.id}
                className="absolute transform -translate-x-1/2 -translate-y-1/2 flex flex-col items-center z-10 transition-transform duration-300 hover:scale-115 group"
                style={{ left: `${node.pos.x}%`, top: `${node.pos.y}%` }}
                onMouseEnter={() => setHoveredNode(node.id)}
                onMouseLeave={() => setHoveredNode(null)}
              >
                {isCenter ? (
                  /* ── MASTER AI CORE NODE ── */
                  <div className="relative flex items-center justify-center">
                    {/* Deep glow field */}
                    <div
                      className="absolute rounded-full w-48 h-48 pointer-events-none"
                      style={{
                        background:
                          'radial-gradient(circle, rgba(0,240,255,0.25) 0%, rgba(0,240,255,0.08) 40%, transparent 70%)',
                        filter: 'blur(20px)',
                      }}
                    />
                    {/* Pulsing aura ring */}
                    <div className="absolute rounded-full border-2 border-cyan-400/40 animate-ping w-40 h-40 opacity-40 pointer-events-none" />
                    {/* Outer rotating ring */}
                    <div
                      className="absolute w-36 h-36 rounded-full border border-dashed border-cyan-400/30 animate-spin-slow pointer-events-none"
                      style={{ animationDuration: '30s' }}
                    >
                      <span className="absolute -top-1 left-1/2 w-2 h-2 rounded-full bg-cyan-300 shadow-[0_0_8px_#00f0ff]" />
                    </div>
                    {/* Inner counter-rotating ring */}
                    <div
                      className="absolute w-28 h-28 rounded-full border border-dotted border-indigo-400/40 animate-spin-slow pointer-events-none"
                      style={{ animationDuration: '45s', animationDirection: 'reverse' }}
                    />

                    {/* Core neural hub icon with cyan lobes */}
                    <div
                      className="relative w-24 h-24 rounded-full bg-[#040812]/95 border-2 flex items-center justify-center shadow-2xl"
                      style={{
                        borderColor: '#00f0ff',
                        boxShadow:
                          '0 0 40px rgba(0,240,255,0.4), inset 0 0 20px rgba(0,240,255,0.15)',
                      }}
                    >
                      <svg className="w-16 h-16" viewBox="0 0 100 100">
                        {/* Main lobes */}
                        <path
                          d="M 50 18 C 32 12, 16 30, 22 50 C 16 68, 32 85, 50 82 C 45 72, 45 28, 50 18 Z"
                          fill="#00f0ff"
                          fillOpacity="0.22"
                          stroke="#00f0ff"
                          strokeWidth="1.8"
                        />
                        <path
                          d="M 50 18 C 68 12, 84 30, 78 50 C 84 68, 68 85, 50 82 C 55 72, 55 28, 50 18 Z"
                          fill="#00f0ff"
                          fillOpacity="0.22"
                          stroke="#00f0ff"
                          strokeWidth="1.8"
                        />
                        {/* Corpus callosum */}
                        <path
                          d="M 50 32 L 46 40 L 50 50 L 54 40 Z"
                          fill="#00f0ff"
                          fillOpacity="0.5"
                        />
                        {/* Synaptic clusters */}
                        <g fill="#00f0ff">
                          <circle cx="50" cy="36" r="2.5" />
                          <circle cx="50" cy="52" r="2" />
                          <circle cx="40" cy="36" r="1.8" />
                          <circle cx="60" cy="36" r="1.8" />
                          <circle cx="42" cy="50" r="1.8" />
                          <circle cx="58" cy="50" r="1.8" />
                        </g>
                        {/* Radiating dendrites */}
                        <g stroke="#00f0ff" strokeWidth="1" strokeOpacity="0.6">
                          <line x1="50" y1="18" x2="50" y2="8" />
                          <line x1="22" y1="50" x2="8" y2="50" />
                          <line x1="78" y1="50" x2="92" y2="50" />
                          <line x1="50" y1="82" x2="50" y2="92" />
                        </g>
                      </svg>
                    </div>

                    {/* AI tag */}
                    <span className="absolute -top-3 px-2 py-0.5 rounded bg-[#040812] border border-cyan-400/50 text-[8px] font-mono text-cyan-300 font-bold tracking-wide shadow-md">
                      AI CORE
                    </span>
                  </div>
                ) : (
                  /* ── SATELLITE AGENT NODE ── */
                  <div className="relative flex flex-col items-center">
                    <div className="relative">
                      {/* Node glow */}
                      <div
                        className="absolute rounded-full w-14 h-14 -left-2 -top-2 opacity-25 animate-pulse"
                        style={{ backgroundColor: node.color, filter: 'blur(7px)' }}
                      />
                      {/* Node body */}
                      <div
                        className="relative w-9 h-9 rounded-full bg-[#040812]/95 border-2 flex items-center justify-center transition-shadow duration-200"
                        style={{
                          borderColor: node.color,
                          boxShadow: `0 0 16px ${node.color}55, inset 0 0 8px ${node.color}22`,
                        }}
                      >
                        <svg className="w-5 h-5" viewBox="0 0 100 100">
                          <path
                            d="M 50 18 C 32 12, 16 30, 22 50 C 16 68, 32 85, 50 82 C 45 72, 45 28, 50 18 Z"
                            fill={node.color}
                            fillOpacity="0.3"
                            stroke={node.color}
                            strokeWidth="2"
                          />
                          <path
                            d="M 50 18 C 68 12, 84 30, 78 50 C 84 68, 68 85, 50 82 C 55 72, 55 28, 50 18 Z"
                            fill={node.color}
                            fillOpacity="0.3"
                            stroke={node.color}
                            strokeWidth="2"
                          />
                          <circle cx="50" cy="44" r="2" fill={node.color} />
                          <circle cx="50" cy="56" r="1.5" fill={node.color} fillOpacity="0.6" />
                        </svg>
                      </div>
                      {/* Status indicator dot */}
                      <span
                        className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-[#010209]"
                        style={{
                          backgroundColor:
                            node.status === 'HEALTHY' || node.status === 'ACTIVE'
                              ? '#34d399'
                              : node.status === 'DOWN'
                              ? '#f43f5e'
                              : '#fbbf24',
                          boxShadow: '0 0 8px currentColor',
                        }}
                      />
                    </div>
                    {/* Node Labels */}
                    <div className="mt-1 text-center font-mono">
                      <div className="text-[7.5px] font-bold tracking-wider text-white drop-shadow-[0_0_4px_rgba(0,240,255,0.4)]">
                        {node.name}
                      </div>
                      <div className="text-[6.5px] text-cyan-400/80 uppercase">{node.status}</div>
                    </div>

                    {/* Hover Telemetry tooltip */}
                    {hoveredNode === node.id && (
                      <div className="absolute top-11 left-1/2 -translate-x-1/2 bg-[#050a1c]/95 border border-slate-700 rounded-md px-2 py-1 font-mono text-[7px] text-slate-300 shadow-xl whitespace-nowrap z-30">
                        <div>
                          CPU: <span className="text-white">{node.cpu}%</span>
                        </div>
                        <div>
                          RAM: <span className="text-white">{node.ram}%</span>
                        </div>
                        <div>
                          Tasks: <span className="text-white">{node.tasks}</span>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── FLOATING HUD PANELS ── */}

      {/* BOTTOM-LEFT 1: CONSTELLATION SUMMARY */}
      <div className="absolute bottom-[140px] left-4 z-20 bg-[#050a1c]/85 backdrop-blur-md border border-cyan-500/20 rounded-xl p-2.5 font-mono text-[9px] shadow-[0_0_24px_rgba(0,0,0,0.7)] w-[155px]">
        <div className="text-slate-400 text-[8px] uppercase tracking-wider mb-2 font-bold flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" /> CONSTELLATION
        </div>
        <div className="space-y-1.5">
          <div className="flex justify-between items-center">
            <span className="flex items-center gap-1.5 text-slate-300">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" /> Total Agents
            </span>
            <span className="font-bold text-white">16</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="flex items-center gap-1.5 text-slate-300">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> Active
            </span>
            <span className="font-bold text-emerald-400">3</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="flex items-center gap-1.5 text-slate-300">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400" /> Busy
            </span>
            <span className="font-bold text-amber-400">0</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="flex items-center gap-1.5 text-slate-300">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500" /> Offline
            </span>
            <span className="font-bold text-slate-400">13</span>
          </div>
        </div>
      </div>

      {/* BOTTOM-LEFT 2: MISSION PROGRESS */}
      <div className="absolute bottom-4 left-4 z-20 bg-[#050a1c]/85 backdrop-blur-md border border-cyan-500/20 rounded-xl p-2.5 font-mono text-[9px] shadow-[0_0_24px_rgba(0,0,0,0.7)] w-[170px]">
        <div className="font-bold text-white uppercase tracking-wider text-[8px] mb-1.5">
          MISSION PROGRESS
        </div>
        <div className="flex items-center gap-2.5">
          <div className="relative w-12 h-12 flex items-center justify-center shrink-0">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
              <path
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                fill="none"
                stroke="#1e293b"
                strokeWidth="3.8"
              />
              <path
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                fill="none"
                stroke="#00f0ff"
                strokeWidth="3.8"
                strokeDasharray="0, 100"
                strokeLinecap="round"
              />
            </svg>
            <div className="absolute text-center">
              <div className="text-[10px] font-bold text-white">0%</div>
              <div className="text-[5.5px] text-slate-400">COMPLETE</div>
            </div>
          </div>
          <div className="space-y-0.5 text-[7.5px]">
            <div className="flex items-center gap-1.5 text-slate-300">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" /> 0 Running
            </div>
            <div className="flex items-center gap-1.5 text-slate-300">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> 0 Completed
            </div>
            <div className="flex items-center gap-1.5 text-slate-300">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500" /> 0 Failed
            </div>
          </div>
        </div>
        {/* Synaptic flow legend */}
        <div className="mt-2 pt-1.5 border-t border-slate-800/70 space-y-1">
          <div className="flex items-center gap-1.5 text-slate-400 text-[7.5px]">
            <span className="w-3 h-[2px] bg-cyan-400 shadow-[0_0_6px_#38bdf8]" /> Synaptic Flow
          </div>
        </div>
      </div>

      {/* BOTTOM-RIGHT 1: LIVE EVENTS FEED */}
      <div className="absolute bottom-[140px] right-4 z-20 bg-[#050a1c]/85 backdrop-blur-md border border-cyan-500/20 rounded-xl p-2.5 font-mono text-[9px] shadow-[0_0_24px_rgba(0,0,0,0.7)] w-[250px] max-h-[30vh] overflow-hidden">
        <div className="flex items-center justify-between mb-1.5">
          <span className="font-bold text-white uppercase tracking-wider text-[8px]">
            LIVE EVENTS
          </span>
          <span className="text-emerald-400 text-[7px]">All Systems Live</span>
        </div>
        <div className="space-y-1 max-h-[22vh] overflow-y-auto pr-1">
          {liveEvents.map((ev, i) => (
            <div
              key={i}
              className="text-slate-300 border-b border-slate-800/40 pb-1 hover:bg-cyan-500/5 transition-colors rounded-xs px-1 text-[7.5px]"
            >
              <div className="flex items-center gap-1.5 text-slate-400 font-semibold">
                <span className="text-slate-500">{ev.time}</span>
                <span className="text-cyan-400">provider health</span>
              </div>
              <div className="text-slate-400 truncate mt-0.5">{ev.detail}</div>
            </div>
          ))}
        </div>
      </div>

      {/* BOTTOM-RIGHT 2: AGENT COMMUNICATION */}
      <div className="absolute bottom-4 right-4 z-20 bg-[#050a1c]/85 backdrop-blur-md border border-cyan-500/20 rounded-xl p-2.5 font-mono text-[9px] shadow-[0_0_24px_rgba(0,0,0,0.7)] w-[230px]">
        <div className="font-bold text-white uppercase tracking-wider text-[8px] mb-1.5">
          AGENT COMMUNICATION
        </div>
        <div className="space-y-1 max-h-[20vh] overflow-y-auto pr-1">
          {commPairs.map((c, i) => (
            <div
              key={i}
              className="flex justify-between items-center text-slate-300 border-b border-slate-800/40 pb-0.5 hover:bg-cyan-500/5 transition-colors rounded-xs px-1 text-[7.5px]"
            >
              <span className="truncate pr-1">{c.pair}</span>
              <span className="text-cyan-400 font-semibold shrink-0">{c.rate}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
