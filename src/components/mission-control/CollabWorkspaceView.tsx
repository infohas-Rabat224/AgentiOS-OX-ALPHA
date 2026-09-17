import React, { useState, useEffect } from 'react';
import {
  FolderTree,
  FileCode,
  Lock,
  Unlock,
  Users,
  Eye,
  Edit3,
  GitCommit,
  CheckCircle,
  RefreshCw,
  Clock,
  Sparkles,
  FilePlus,
  Terminal,
  FileText
} from 'lucide-react';

interface VFSFile {
  id: string;
  path: string;
  name: string;
  size: string;
  lockedBy?: string;
  lockColor?: string;
  lastModified: string;
  content: string;
  language: string;
}

const INITIAL_FILES: VFSFile[] = [
  {
    id: 'f-1',
    path: 'src/services/omniRouter.ts',
    name: 'omniRouter.ts',
    size: '18.4 KB',
    lockedBy: 'CLAUDE_CODE',
    lockColor: '#06b6d4',
    lastModified: 'Just now',
    language: 'typescript',
    content: `// OmniRouter v2.4 Multi-Agent High-Throughput Matrix
export class OmniRouterService {
  private agents: AgentNode[] = [...INITIAL_16_AGENTS];
  
  // Real-time deterministic dispatch scoring
  public routeIntent(prompt: string, strategy: RoutingStrategy): RoutingDecision {
    const scores = this.calculateCandidateScores(prompt, strategy);
    const winner = scores[0].agent;
    winner.activeRequests += 1;
    return { winner, rationale: 'Optimized taxonomy & circuit score' };
  }
}`
  },
  {
    id: 'f-2',
    path: 'agents/hermes/research_eval.py',
    name: 'research_eval.py',
    size: '8.2 KB',
    lockedBy: 'HERMES',
    lockColor: '#a855f7',
    lastModified: '1m ago',
    language: 'python',
    content: `import asyncio
import httpx

async def scrape_and_synthesize(sources: list[str]):
    """Hermes Parallel Web Ingestion Pipeline"""
    async with httpx.AsyncClient() as client:
        tasks = [client.get(s) for s in sources]
        responses = await asyncio.gather(*tasks, return_exceptions=True)
        return [r.text for r in responses if hasattr(r, 'text')]`
  },
  {
    id: 'f-3',
    path: 'tests/benchmarks/latency_spec.ts',
    name: 'latency_spec.ts',
    size: '4.1 KB',
    lockedBy: 'PYTHON',
    lockColor: '#10b981',
    lastModified: '4m ago',
    language: 'typescript',
    content: `import { describe, it, expect } from 'vitest';
import { OmniRouter } from '../src/omniRouter';

describe('OmniRoute Microsecond Latency Spec', () => {
  it('dispatches within 0.15ms threshold under 100 concurrent workers', async () => {
    const overhead = await measureDispatchLatency(100);
    expect(overhead).toBeLessThan(0.20);
  });
});`
  },
  {
    id: 'f-4',
    path: 'config/runtime_manifest.json',
    name: 'runtime_manifest.json',
    size: '2.8 KB',
    lastModified: '12m ago',
    language: 'json',
    content: `{
  "agenticos": {
    "version": "1.0.0-rc10",
    "discovered_runtimes": 16,
    "active_circuit_breakers": 0,
    "memory_tier": "hnsw_cosine_1536"
  }
}`
  }
];

export const CollabWorkspaceView: React.FC = () => {
  const [files, setFiles] = useState<VFSFile[]>(INITIAL_FILES);
  const [selectedFile, setSelectedFile] = useState<VFSFile>(INITIAL_FILES[0]);
  const [scratchpad, setScratchpad] = useState<string>(
    `[HERMES 05:52:10]: Identified 3 new API documentation schemas from LangChain and Ollama.\n[CLAUDE_CODE 05:52:14]: Verified AST compatibility with zero breaking interfaces.\n[PYTHON 05:52:21]: All microbenchmarks passing at 0.12ms router latency.`
  );
  const [isTyping, setIsTyping] = useState(true);

  // Simulated live agent editing activity
  useEffect(() => {
    const interval = setInterval(() => {
      setIsTyping((prev) => !prev);
    }, 2800);
    return () => clearInterval(interval);
  }, []);

  const handleToggleLock = (fileId: string) => {
    setFiles((prev) =>
      prev.map((f) => {
        if (f.id === fileId) {
          if (f.lockedBy) {
            return { ...f, lockedBy: undefined, lockColor: undefined };
          } else {
            return { ...f, lockedBy: 'CLAUDE_CODE', lockColor: '#06b6d4' };
          }
        }
        return f;
      })
    );
  };

  return (
    <div className="space-y-4 p-4 font-mono text-xs">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-[#0d121f] p-3.5 rounded-2xl border border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
            <FolderTree size={18} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-white tracking-wide uppercase">Collaborative Workspace</h2>
              <span className="px-2 py-0.5 rounded text-[10px] bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 font-semibold">
                SHARED VFS & LOCK MANAGER
              </span>
            </div>
            <p className="text-[11px] text-slate-400 font-sans mt-0.5">
              Live multi-agent virtual file tree with mutual write exclusion, distributed locks, and real-time buffer sync.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-[11px] bg-[#12182b] px-3 py-1.5 rounded-xl border border-slate-800">
            <Users size={13} className="text-cyan-400" />
            <span className="text-slate-300">Active Collaborators: <strong className="text-white">3 Agents</strong></span>
          </div>
        </div>
      </div>

      {/* Main Grid: VFS Explorer + Collaborative Code Editor + Shared Scratchpad */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* VFS File Tree Column */}
        <div className="lg:col-span-1 space-y-3">
          <div className="rounded-2xl border border-slate-800 bg-[#080c16] p-3.5 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <span className="text-slate-300 font-semibold flex items-center gap-1.5">
                <FolderTree size={13} className="text-cyan-400" />
                VIRTUAL FILE SYSTEM
              </span>
              <span className="text-[10px] text-slate-500">{files.length} Files</span>
            </div>

            <div className="space-y-1.5">
              {files.map((file) => {
                const isSelected = selectedFile.id === file.id;
                return (
                  <div
                    key={file.id}
                    onClick={() => setSelectedFile(file)}
                    className={`p-2.5 rounded-xl border transition-all cursor-pointer flex flex-col space-y-1 ${
                      isSelected
                        ? 'border-cyan-500/50 bg-cyan-950/25'
                        : 'border-slate-800/80 bg-[#0d1222] hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 truncate">
                        <FileCode size={13} className="text-slate-400 shrink-0" />
                        <span className={`text-[11px] font-bold truncate ${isSelected ? 'text-cyan-300' : 'text-slate-200'}`}>
                          {file.name}
                        </span>
                      </div>
                      {file.lockedBy ? (
                        <span
                          className="flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded font-bold"
                          style={{
                            backgroundColor: `${file.lockColor}20`,
                            color: file.lockColor,
                            border: `1px solid ${file.lockColor}40`
                          }}
                        >
                          <Lock size={9} />
                          {file.lockedBy}
                        </span>
                      ) : (
                        <span className="text-slate-600 text-[9px]">Unlocked</span>
                      )}
                    </div>

                    <div className="flex items-center justify-between text-[10px] text-slate-500">
                      <span>{file.size}</span>
                      <span>{file.lastModified}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Collaborative Lock Legend */}
          <div className="rounded-2xl border border-slate-800 bg-[#080c16] p-3 space-y-2">
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
              Agent Lock Leases
            </span>
            <div className="space-y-1.5 text-[10px]">
              <div className="flex items-center justify-between p-1.5 rounded-lg bg-[#0e1424]">
                <span className="text-cyan-400 font-bold">CLAUDE_CODE</span>
                <span className="text-slate-400">Lease: 18s left</span>
              </div>
              <div className="flex items-center justify-between p-1.5 rounded-lg bg-[#0e1424]">
                <span className="text-purple-400 font-bold">HERMES</span>
                <span className="text-slate-400">Lease: 42s left</span>
              </div>
              <div className="flex items-center justify-between p-1.5 rounded-lg bg-[#0e1424]">
                <span className="text-emerald-400 font-bold">PYTHON</span>
                <span className="text-slate-400">Lease: 55s left</span>
              </div>
            </div>
          </div>
        </div>

        {/* Live Code Editor & Diff Inspector (2 Cols) */}
        <div className="lg:col-span-2 space-y-3">
          <div className="rounded-2xl border border-slate-800 bg-[#080c16] p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2.5">
              <div className="flex items-center gap-2">
                <FileCode size={14} className="text-cyan-400" />
                <span className="font-bold text-white text-xs">{selectedFile.path}</span>
                <span className="text-[10px] text-slate-500">({selectedFile.language})</span>
              </div>

              <div className="flex items-center gap-2">
                {selectedFile.lockedBy && (
                  <span
                    className="flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-bold"
                    style={{
                      backgroundColor: `${selectedFile.lockColor}20`,
                      color: selectedFile.lockColor,
                      border: `1px solid ${selectedFile.lockColor}40`
                    }}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${isTyping ? 'animate-ping' : ''}`} style={{ backgroundColor: selectedFile.lockColor }} />
                    {selectedFile.lockedBy} typing...
                  </span>
                )}
                <button
                  onClick={() => handleToggleLock(selectedFile.id)}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition cursor-pointer text-[10px]"
                >
                  {selectedFile.lockedBy ? <Unlock size={11} /> : <Lock size={11} />}
                  <span>{selectedFile.lockedBy ? 'Release Lock' : 'Acquire Lock'}</span>
                </button>
              </div>
            </div>

            {/* Code Surface */}
            <div className="relative">
              <textarea
                rows={14}
                value={selectedFile.content}
                onChange={(e) => {
                  const updated = { ...selectedFile, content: e.target.value };
                  setSelectedFile(updated);
                  setFiles(files.map((f) => (f.id === updated.id ? updated : f)));
                }}
                className="w-full bg-[#050811] text-slate-200 border border-slate-900 rounded-xl p-3 font-mono text-[11px] leading-relaxed focus:outline-none focus:border-cyan-500/50 resize-none"
              />
              <div className="absolute bottom-3 right-3 text-[10px] text-slate-500 bg-[#0e1424]/80 px-2 py-0.5 rounded">
                Line 1, Col 1 · UTF-8
              </div>
            </div>
          </div>
        </div>

        {/* Shared Agent Scratchpad & Memory Buffer (1 Col) */}
        <div className="lg:col-span-1 space-y-3">
          <div className="rounded-2xl border border-slate-800 bg-[#080c16] p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <span className="text-slate-300 font-semibold flex items-center gap-1.5">
                <Terminal size={13} className="text-emerald-400" />
                SWARM SCRATCHPAD
              </span>
              <span className="text-[10px] text-emerald-400 font-mono">Shared RAM</span>
            </div>

            <p className="text-[10px] text-slate-400 font-sans">
              Ephemeral whiteboard where agents stream findings, task hashes, and AST checkpoints.
            </p>

            <textarea
              rows={10}
              value={scratchpad}
              onChange={(e) => setScratchpad(e.target.value)}
              className="w-full bg-[#050811] text-emerald-300 border border-slate-900 rounded-xl p-2.5 font-mono text-[10px] leading-relaxed focus:outline-none focus:border-emerald-500/50 resize-none"
            />

            <button
              onClick={() => {
                setScratchpad(
                  (prev) => `[USER ${new Date().toLocaleTimeString()}]: Appended directive to swarm buffer.\n` + prev
                );
              }}
              className="w-full py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-[11px] border border-slate-700 transition cursor-pointer"
            >
              Broadcast Note to Swarm
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
