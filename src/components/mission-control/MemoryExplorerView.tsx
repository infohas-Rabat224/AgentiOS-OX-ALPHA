import React, { useState } from 'react';
import {
  Database,
  Search,
  Layers,
  Brain,
  Trash2,
  RefreshCw,
  Sparkles,
  Sliders,
  CheckCircle2,
  Clock,
  Zap,
  Tag,
  Share2
} from 'lucide-react';

interface MemoryItem {
  id: string;
  tier: 'working' | 'episodic' | 'semantic';
  content: string;
  similarity: number; // 0.0 - 1.0
  sourceAgent: string;
  timestamp: string;
  tags: string[];
  tokens: number;
}

const SAMPLE_MEMORIES: MemoryItem[] = [
  {
    id: 'mem-101',
    tier: 'semantic',
    content: 'OmniRouter dispatch latency benchmark: Lockless atomic routing executes within 0.12ms threshold across 16 discovered agent runtimes.',
    similarity: 0.96,
    sourceAgent: 'CLAUDE_CODE',
    timestamp: '12m ago',
    tags: ['Router', 'Latency', 'Benchmark'],
    tokens: 42
  },
  {
    id: 'mem-102',
    tier: 'semantic',
    content: 'AST TypeScript tokenizer optimization: Babel traverse replaced with SWC native binary to prevent V8 GC pauses under heavy JSON streams.',
    similarity: 0.91,
    sourceAgent: 'CODEX CLI',
    timestamp: '45m ago',
    tags: ['AST', 'TypeScript', 'Performance'],
    tokens: 38
  },
  {
    id: 'mem-103',
    tier: 'episodic',
    content: 'Completed forensic audit of 7 OS core subsystems: Memory fragmentation fixed in IPC bridge with zero dropped frames.',
    similarity: 0.88,
    sourceAgent: 'HERMES',
    timestamp: '2h ago',
    tags: ['Audit', 'IPC', 'Forensics'],
    tokens: 31
  },
  {
    id: 'mem-104',
    tier: 'working',
    content: 'Active User Session: Evaluating real-time D3.js line chart integration for OmniRoute traffic throughput and latency.',
    similarity: 0.84,
    sourceAgent: 'CLAUDE_CODE',
    timestamp: 'Just now',
    tags: ['ActiveContext', 'D3', 'OmniRoute'],
    tokens: 28
  }
];

export const MemoryExplorerView: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTier, setActiveTier] = useState<'all' | 'working' | 'episodic' | 'semantic'>('all');
  const [memories, setMemories] = useState<MemoryItem[]>(SAMPLE_MEMORIES);
  const [isSearching, setIsSearching] = useState(false);

  const filteredMemories = memories.filter((m) => {
    const matchesTier = activeTier === 'all' || m.tier === activeTier;
    const matchesQuery =
      searchQuery.trim() === '' ||
      m.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.tags.some((t) => t.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesTier && matchesQuery;
  });

  const handleSimulateSearch = () => {
    setIsSearching(true);
    setTimeout(() => {
      setIsSearching(false);
    }, 400);
  };

  return (
    <div className="space-y-4 p-4 font-mono text-xs">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-[#0d121f] p-3.5 rounded-2xl border border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-center text-purple-400">
            <Database size={18} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-white tracking-wide uppercase">Memory Explorer</h2>
              <span className="px-2 py-0.5 rounded text-[10px] bg-purple-500/20 text-purple-300 border border-purple-500/30 font-semibold">
                HNSW VECTOR INDEX · 1536-D
              </span>
            </div>
            <p className="text-[11px] text-slate-400 font-sans mt-0.5">
              Inspect working memory context buffers, episodic session traces, and semantic knowledge embeddings.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => alert('Triggered background vector consolidation & index vacuum.')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition cursor-pointer font-bold"
          >
            <RefreshCw size={13} />
            <span>Consolidate Memory</span>
          </button>
        </div>
      </div>

      {/* Memory Index Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-[#0a0f1d] p-3 rounded-xl border border-slate-800">
          <div className="flex items-center justify-between text-[10px] text-slate-400">
            <span>INDEXED VECTORS</span>
            <Database size={12} className="text-purple-400" />
          </div>
          <div className="text-lg font-bold text-white mt-1">142,850</div>
          <span className="text-[10px] text-slate-500">HNSW M=16, efSearch=64</span>
        </div>

        <div className="bg-[#0a0f1d] p-3 rounded-xl border border-slate-800">
          <div className="flex items-center justify-between text-[10px] text-slate-400">
            <span>SEARCH LATENCY</span>
            <Zap size={12} className="text-emerald-400" />
          </div>
          <div className="text-lg font-bold text-emerald-400 mt-1">1.8 ms</div>
          <span className="text-[10px] text-slate-500">SIMD Cosine Distance</span>
        </div>

        <div className="bg-[#0a0f1d] p-3 rounded-xl border border-slate-800">
          <div className="flex items-center justify-between text-[10px] text-slate-400">
            <span>RECALL ACCURACY</span>
            <CheckCircle2 size={12} className="text-cyan-400" />
          </div>
          <div className="text-lg font-bold text-cyan-300 mt-1">99.4%</div>
          <span className="text-[10px] text-slate-500">Zero catastrophic forgetting</span>
        </div>

        <div className="bg-[#0a0f1d] p-3 rounded-xl border border-slate-800">
          <div className="flex items-center justify-between text-[10px] text-slate-400">
            <span>CONTEXT RETENTION</span>
            <Clock size={12} className="text-amber-400" />
          </div>
          <div className="text-lg font-bold text-amber-300 mt-1">30 Days TTL</div>
          <span className="text-[10px] text-slate-500">With semantic importance score</span>
        </div>
      </div>

      {/* Semantic Search & Filter Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-[#0a0f1d] p-3 rounded-2xl border border-slate-800">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search semantic memory by meaning or tag (e.g. AST, Latency, Router)..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              handleSimulateSearch();
            }}
            className="w-full bg-[#12182b] border border-slate-700/80 rounded-xl pl-9 pr-4 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 text-xs"
          />
        </div>

        <div className="flex items-center gap-1.5 bg-[#12182b] p-1 rounded-xl border border-slate-800 shrink-0">
          {(['all', 'semantic', 'episodic', 'working'] as const).map((tier) => (
            <button
              key={tier}
              onClick={() => setActiveTier(tier)}
              className={`px-2.5 py-1 rounded-lg uppercase text-[10px] font-bold transition cursor-pointer ${
                activeTier === tier
                  ? 'bg-purple-500 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {tier}
            </button>
          ))}
        </div>
      </div>

      {/* Memory Cards Stream */}
      <div className="space-y-2.5">
        {filteredMemories.length === 0 ? (
          <div className="p-8 text-center text-slate-500 bg-[#0a0f1d] rounded-2xl border border-slate-800">
            No memories match the query.
          </div>
        ) : (
          filteredMemories.map((mem) => (
            <div
              key={mem.id}
              className="p-3.5 rounded-2xl border border-slate-800 bg-[#0a0f1d] hover:border-purple-500/40 transition flex flex-col md:flex-row md:items-center justify-between gap-3"
            >
              <div className="space-y-1.5 max-w-3xl">
                <div className="flex items-center gap-2">
                  <span
                    className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase ${
                      mem.tier === 'semantic'
                        ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                        : mem.tier === 'episodic'
                        ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                        : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                    }`}
                  >
                    {mem.tier}
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">{mem.id}</span>
                  <span className="text-[10px] text-slate-500">· Source: <strong className="text-slate-300">{mem.sourceAgent}</strong></span>
                  <span className="text-[10px] text-slate-500">· {mem.timestamp}</span>
                </div>

                <p className="text-[11px] text-slate-200 font-sans leading-relaxed">
                  {mem.content}
                </p>

                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  {mem.tags.map((tag) => (
                    <span
                      key={tag}
                      className="px-1.5 py-0.5 rounded text-[9px] bg-[#12182b] text-slate-400 border border-slate-800"
                    >
                      #{tag}
                    </span>
                  ))}
                  <span className="text-[9px] text-slate-500 ml-2">{mem.tokens} tokens</span>
                </div>
              </div>

              <div className="flex md:flex-col items-end justify-between md:justify-center gap-2 shrink-0 border-t md:border-t-0 md:border-l border-slate-800/80 pt-2 md:pt-0 md:pl-4">
                <div className="text-right">
                  <span className="text-[9px] text-slate-500 block uppercase">Cosine Match</span>
                  <span className="text-sm font-bold text-purple-300">
                    {(mem.similarity * 100).toFixed(1)}%
                  </span>
                </div>
                <button
                  onClick={() => alert(`Copied memory ${mem.id} embedding vector to clipboard!`)}
                  className="text-[10px] text-slate-400 hover:text-cyan-400 cursor-pointer flex items-center gap-1"
                >
                  <Share2 size={11} />
                  <span>Inspect</span>
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
