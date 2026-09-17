import React, { useState, useEffect } from 'react';
import {
  Network,
  Play,
  Pause,
  RotateCcw,
  Sliders,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Database,
  Cpu,
  Layers,
  FileCode,
  Download,
  Share2,
  TrendingUp,
  Zap,
  HardDrive
} from 'lucide-react';

interface PipelineStage {
  id: string;
  name: string;
  icon: any;
  category: 'ingest' | 'transform' | 'vectorize' | 'inference' | 'guardrail' | 'sink';
  status: 'active' | 'standby' | 'saturated';
  throughput: number; // items/sec
  processedCount: number;
  errorRate: number; // %
  latencyMs: number;
  config: {
    batchSize: number;
    concurrency: number;
    timeoutSec: number;
  };
}

const DEFAULT_STAGES: PipelineStage[] = [
  {
    id: 'stage-ingest',
    name: 'Zero-Copy Ingestion Stream',
    icon: Database,
    category: 'ingest',
    status: 'active',
    throughput: 420,
    processedCount: 14820,
    errorRate: 0.0,
    latencyMs: 1.4,
    config: { batchSize: 64, concurrency: 8, timeoutSec: 5 }
  },
  {
    id: 'stage-chunk',
    name: 'AST & Markdown Semantic Chunker',
    icon: FileCode,
    category: 'transform',
    status: 'active',
    throughput: 380,
    processedCount: 14750,
    errorRate: 0.02,
    latencyMs: 3.2,
    config: { batchSize: 32, concurrency: 4, timeoutSec: 10 }
  },
  {
    id: 'stage-embed',
    name: 'Vector Embeddings Engine (GTE-Large)',
    icon: Layers,
    category: 'vectorize',
    status: 'active',
    throughput: 160,
    processedCount: 14700,
    errorRate: 0.0,
    latencyMs: 12.8,
    config: { batchSize: 16, concurrency: 4, timeoutSec: 15 }
  },
  {
    id: 'stage-omniroute',
    name: 'OmniRoute Multi-Agent Inference',
    icon: Cpu,
    category: 'inference',
    status: 'active',
    throughput: 95,
    processedCount: 14610,
    errorRate: 0.05,
    latencyMs: 24.5,
    config: { batchSize: 8, concurrency: 16, timeoutSec: 30 }
  },
  {
    id: 'stage-guard',
    name: 'Deterministic Guardrail & Anti-Hallucination',
    icon: Zap,
    category: 'guardrail',
    status: 'active',
    throughput: 92,
    processedCount: 14580,
    errorRate: 0.01,
    latencyMs: 4.1,
    config: { batchSize: 16, concurrency: 8, timeoutSec: 5 }
  },
  {
    id: 'stage-sink',
    name: 'Persistent VFS & Memory Storage Sink',
    icon: HardDrive,
    category: 'sink',
    status: 'active',
    throughput: 92,
    processedCount: 14580,
    errorRate: 0.0,
    latencyMs: 2.0,
    config: { batchSize: 32, concurrency: 4, timeoutSec: 10 }
  }
];

export const PipelineBuilderView: React.FC = () => {
  const [stages, setStages] = useState<PipelineStage[]>(DEFAULT_STAGES);
  const [selectedStage, setSelectedStage] = useState<PipelineStage>(DEFAULT_STAGES[2]);
  const [isStreaming, setIsStreaming] = useState(true);
  const [totalProcessed, setTotalProcessed] = useState(88040);
  const [pipelineState, setPipelineState] = useState<'HEALTHY' | 'DEGRADED'>('HEALTHY');

  // Live throughput tick simulation
  useEffect(() => {
    if (!isStreaming) return;
    const interval = setInterval(() => {
      setStages((prev) =>
        prev.map((s) => {
          const delta = Math.floor(Math.random() * 9) + 2;
          return {
            ...s,
            processedCount: s.processedCount + delta,
            throughput: Math.max(20, Math.round(s.throughput + (Math.random() * 12 - 6)))
          };
        })
      );
      setTotalProcessed((c) => c + 15);
    }, 1800);

    return () => clearInterval(interval);
  }, [isStreaming]);

  const handleUpdateConfig = (key: keyof PipelineStage['config'], val: number) => {
    const updated = {
      ...selectedStage,
      config: {
        ...selectedStage.config,
        [key]: val
      }
    };
    setSelectedStage(updated);
    setStages(stages.map((s) => (s.id === updated.id ? updated : s)));
  };

  return (
    <div className="space-y-4 p-4 font-mono text-xs">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-[#0d121f] p-3.5 rounded-2xl border border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-center text-purple-400">
            <Network size={18} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-white tracking-wide uppercase">Pipeline Builder</h2>
              <span className="px-2 py-0.5 rounded text-[10px] bg-purple-500/20 text-purple-300 border border-purple-500/30 font-semibold">
                DAG STREAMING ENGINE
              </span>
            </div>
            <p className="text-[11px] text-slate-400 font-sans mt-0.5">
              Construct high-throughput ingestion, semantic tokenization, vector retrieval, and model inference pipelines.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsStreaming(!isStreaming)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border font-semibold transition cursor-pointer ${
              isStreaming
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/30 hover:bg-amber-500/30'
                : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/30'
            }`}
          >
            {isStreaming ? <Pause size={13} /> : <Play size={13} />}
            <span>{isStreaming ? 'Pause Stream' : 'Resume Stream'}</span>
          </button>
          <button
            onClick={() => {
              setStages(DEFAULT_STAGES);
              setSelectedStage(DEFAULT_STAGES[2]);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition cursor-pointer"
          >
            <RotateCcw size={13} />
            <span>Reset</span>
          </button>
        </div>
      </div>

      {/* Pipeline High-Level Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-[#0a0f1d] p-3 rounded-xl border border-slate-800">
          <div className="flex items-center justify-between text-[10px] text-slate-400">
            <span>TOTAL PROCESSED</span>
            <TrendingUp size={12} className="text-purple-400" />
          </div>
          <div className="text-lg font-bold text-white mt-1">{totalProcessed.toLocaleString()}</div>
          <span className="text-[10px] text-slate-500">Continuous 0-loss buffer</span>
        </div>

        <div className="bg-[#0a0f1d] p-3 rounded-xl border border-slate-800">
          <div className="flex items-center justify-between text-[10px] text-slate-400">
            <span>PIPELINE HEALTH</span>
            <CheckCircle2 size={12} className="text-emerald-400" />
          </div>
          <div className="text-lg font-bold text-emerald-400 mt-1">100.0%</div>
          <span className="text-[10px] text-slate-500">6/6 stages operating nominally</span>
        </div>

        <div className="bg-[#0a0f1d] p-3 rounded-xl border border-slate-800">
          <div className="flex items-center justify-between text-[10px] text-slate-400">
            <span>END-TO-END LATENCY</span>
            <Zap size={12} className="text-amber-400" />
          </div>
          <div className="text-lg font-bold text-amber-300 mt-1">47.0 ms</div>
          <span className="text-[10px] text-slate-500">Cumulative DAG transit</span>
        </div>

        <div className="bg-[#0a0f1d] p-3 rounded-xl border border-slate-800">
          <div className="flex items-center justify-between text-[10px] text-slate-400">
            <span>TOTAL STAGES</span>
            <Layers size={12} className="text-cyan-400" />
          </div>
          <div className="text-lg font-bold text-cyan-300 mt-1">{stages.length}</div>
          <span className="text-[10px] text-slate-500">DAG Depth: 6 levels</span>
        </div>
      </div>

      {/* Main DAG Stages & Inspector */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left 2 Cols: Interactive Stage Cards */}
        <div className="lg:col-span-2 space-y-3">
          <div className="rounded-2xl border border-slate-800 bg-[#080c16] p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <span className="text-slate-300 font-semibold flex items-center gap-1.5">
                <Network size={14} className="text-purple-400" />
                ACTIVE PIPELINE TOPOLOGY
              </span>
              <span className="text-[10px] text-slate-500">Click stage to inspect parameters</span>
            </div>

            <div className="space-y-2.5">
              {stages.map((stage, idx) => {
                const Icon = stage.icon;
                const isSelected = selectedStage.id === stage.id;
                return (
                  <div key={stage.id}>
                    <div
                      onClick={() => setSelectedStage(stage)}
                      className={`p-3.5 rounded-xl border transition-all cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                        isSelected
                          ? 'border-purple-500/60 bg-purple-950/20 shadow-lg shadow-purple-950/30'
                          : 'border-slate-800 bg-[#0d1222] hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-purple-500/15 text-purple-400 border border-purple-500/30 flex items-center justify-center shrink-0">
                          <Icon size={16} />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-white text-xs">{stage.name}</span>
                            <span className="text-[9px] uppercase px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 border border-slate-700">
                              {stage.category}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 text-[10px] text-slate-400 mt-1">
                            <span>Throughput: <strong className="text-purple-300">{stage.throughput} req/s</strong></span>
                            <span>Latency: <strong className="text-amber-300">{stage.latencyMs}ms</strong></span>
                            <span>Processed: <strong className="text-slate-200">{stage.processedCount.toLocaleString()}</strong></span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                          {stage.status}
                        </span>
                      </div>
                    </div>

                    {idx < stages.length - 1 && (
                      <div className="flex justify-center my-1 text-slate-600">
                        <ArrowRight size={13} className="rotate-90" />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right 1 Col: Stage Configuration & Micro-tuning */}
        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-800 bg-[#080c16] p-4 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <span className="text-slate-300 font-semibold flex items-center gap-1.5">
                <Sliders size={13} className="text-purple-400" />
                STAGE TUNING: {selectedStage.name}
              </span>
            </div>

            <div className="space-y-4 font-sans text-xs">
              {/* Batch Size Slider */}
              <div>
                <div className="flex justify-between text-[11px] font-mono text-slate-300 mb-1">
                  <span>Batch Window Size</span>
                  <span className="text-purple-400 font-bold">{selectedStage.config.batchSize} items</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="128"
                  value={selectedStage.config.batchSize}
                  onChange={(e) => handleUpdateConfig('batchSize', Number(e.target.value))}
                  className="w-full accent-purple-500 cursor-pointer"
                />
                <span className="text-[10px] text-slate-500 font-sans">
                  Optimizes GPU vectorization and buffer packing.
                </span>
              </div>

              {/* Concurrency Threads */}
              <div>
                <div className="flex justify-between text-[11px] font-mono text-slate-300 mb-1">
                  <span>Concurrent Worker Threads</span>
                  <span className="text-purple-400 font-bold">{selectedStage.config.concurrency} workers</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="32"
                  value={selectedStage.config.concurrency}
                  onChange={(e) => handleUpdateConfig('concurrency', Number(e.target.value))}
                  className="w-full accent-purple-500 cursor-pointer"
                />
                <span className="text-[10px] text-slate-500 font-sans">
                  Controls asynchronous worker pool allocations.
                </span>
              </div>

              {/* Timeout Threshold */}
              <div>
                <div className="flex justify-between text-[11px] font-mono text-slate-300 mb-1">
                  <span>Timeout Guardrail</span>
                  <span className="text-purple-400 font-bold">{selectedStage.config.timeoutSec}s</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="60"
                  value={selectedStage.config.timeoutSec}
                  onChange={(e) => handleUpdateConfig('timeoutSec', Number(e.target.value))}
                  className="w-full accent-purple-500 cursor-pointer"
                />
                <span className="text-[10px] text-slate-500 font-sans">
                  Drops or reroutes stalled payloads automatically.
                </span>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="border-t border-slate-800 pt-3 flex items-center justify-between text-[11px] font-mono">
              <span className="text-slate-400">Hot-reloading: <strong className="text-emerald-400">ENABLED</strong></span>
              <button
                onClick={() => alert(`Exported pipeline topology configuration to clipboard!`)}
                className="flex items-center gap-1 text-cyan-400 hover:text-cyan-300 cursor-pointer"
              >
                <Share2 size={12} />
                <span>Export JSON</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
