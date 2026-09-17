import React, { useState } from 'react';
import {
  Send,
  Sparkles,
  Paperclip,
  Code2,
  Eye,
  Terminal,
  Copy,
  Check,
  Maximize2,
  RefreshCw,
  Cpu,
  Bot,
  Layers,
  ChevronDown
} from 'lucide-react';

const PROMPT_STARTERS = [
  {
    title: 'Design a clean architecture',
    subtitle: 'Component diagrams, system flow & data contracts',
    prompt: 'Design a clean architecture for our distributed multi-agent coordinator. Detail component interfaces, IPC contracts, and event-driven data flow.',
  },
  {
    title: 'Implement a production feature',
    subtitle: 'TypeScript, React, & Node.js clean implementation',
    prompt: 'Implement a real-time WebSocket communication broker between Mission Control and the live daemon with retry backoff and state rehydration.',
  },
  {
    title: 'Debug & analyze root cause',
    subtitle: 'Trace error stack & suggest precise fixes',
    prompt: 'Analyze high task queue latency and agent timeout errors during parallel sub-graph execution and suggest precise runtime optimizations.',
  },
  {
    title: 'Refactor for performance & style',
    subtitle: 'Optimize runtime efficiency & readability',
    prompt: 'Refactor the neural constellation renderer to use OffscreenCanvas and WebGL instanced rendering for 120 FPS high-density graphs.',
  },
];

const SAMPLE_ARTIFACT_CODE = `// AgenticOS Autonomous Artifact Preview
import React, { useState } from 'react';

export default function AgentTelemetryWidget() {
  const [active, setActive] = useState(true);
  const [rate, setRate] = useState(42);

  return (
    <div className="p-6 bg-slate-900 border border-cyan-500/30 rounded-xl text-white font-mono shadow-2xl">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-sm font-bold text-cyan-400">MISSION UPLINK · AGENT TELEMETRY</h3>
        <span className="px-2 py-0.5 rounded text-[10px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 animate-pulse">
          LIVE
        </span>
      </div>
      <div className="grid grid-cols-2 gap-4 text-xs">
        <div className="p-3 bg-slate-800/80 rounded-lg border border-slate-700">
          <div className="text-slate-400 text-[10px]">THROUGHPUT</div>
          <div className="text-lg font-bold text-cyan-300">{rate} msg/sec</div>
        </div>
        <div className="p-3 bg-slate-800/80 rounded-lg border border-slate-700">
          <div className="text-slate-400 text-[10px]">CONSENSUS</div>
          <div className="text-lg font-bold text-emerald-400">99.8%</div>
        </div>
      </div>
    </div>
  );
}`;

export const PromptCenterView: React.FC = () => {
  const [prompt, setPrompt] = useState('');
  const [selectedAgent, setSelectedAgent] = useState('claude_code');
  const [extendedThinking, setExtendedThinking] = useState(true);
  const [activeArtifactTab, setActiveArtifactTab] = useState<'preview' | 'code' | 'console'>('preview');
  const [copied, setCopied] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  const handleStarterClick = (p: string) => {
    setPrompt(p);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(SAMPLE_ARTIFACT_CODE);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSend = () => {
    if (!prompt.trim()) return;
    setIsGenerating(true);
    setTimeout(() => {
      setIsGenerating(false);
    }, 1200);
  };

  return (
    <div className="h-full flex flex-col gap-4 font-sans text-text">
      {/* Top Header */}
      <div className="flex items-center justify-between border-b border-border/30 pb-3">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-accent/20 border border-accent/40 rounded-xl text-accent">
            <Sparkles size={18} />
          </div>
          <div>
            <h1 className="text-base font-bold tracking-tight">PROMPT CENTER · MISSION UPLINK</h1>
            <p className="text-xs text-faint">
              Multi-Agent Prompt Orchestration & Interactive Artifact Sandbox
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Agent Selector */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface/50 border border-border/40 text-xs font-mono">
            <Bot size={14} className="text-accent" />
            <span className="font-semibold text-text">{selectedAgent}</span>
            <span className="text-[10px] text-emerald-400 font-bold">• Active</span>
          </div>
          {/* Extended Thinking */}
          <button
            onClick={() => setExtendedThinking(!extendedThinking)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition cursor-pointer ${
              extendedThinking
                ? 'bg-accent/20 border-accent/40 text-accent font-semibold'
                : 'bg-surface/40 border-border/40 text-faint'
            }`}
          >
            Extended Thinking
          </button>
        </div>
      </div>

      {/* Main Grid: Prompt Composer + Artifact Preview Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 flex-1 min-h-0">
        {/* Left Column: Prompt Composer (7 cols) */}
        <div className="lg:col-span-6 flex flex-col gap-3">
          {/* Textarea Composer */}
          <div className="flex-1 bg-surface/40 backdrop-blur-md border border-border/40 rounded-xl p-4 flex flex-col justify-between shadow-xl">
            <div className="flex items-center justify-between text-xs text-faint mb-2">
              <span className="font-mono">Routing through 16 discovered agents</span>
              <span className="font-mono text-[11px]">{prompt.length} chars</span>
            </div>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Reply to Mission Control, paste code, or ask to generate an interactive preview artifact..."
              className="w-full flex-1 bg-transparent resize-none outline-none font-mono text-xs text-text placeholder:text-faint/50 leading-relaxed min-h-[160px]"
            />
            <div className="flex items-center justify-between pt-3 border-t border-border/30">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="p-1.5 rounded-lg hover:bg-surface/50 text-faint hover:text-text transition cursor-pointer"
                  title="Add Attachment"
                >
                  <Paperclip size={16} />
                </button>
                <button
                  type="button"
                  className="px-2.5 py-1 rounded-lg text-[11px] font-mono bg-surface/50 border border-border/40 text-faint hover:text-text cursor-pointer"
                >
                  ALL AGENTS
                </button>
              </div>
              <button
                onClick={handleSend}
                disabled={isGenerating || !prompt.trim()}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-accent text-white font-medium text-xs shadow-lg shadow-accent/25 hover:bg-accent/90 disabled:opacity-50 transition cursor-pointer"
              >
                {isGenerating ? (
                  <>
                    <RefreshCw size={14} className="animate-spin" />
                    <span>Orchestrating...</span>
                  </>
                ) : (
                  <>
                    <Send size={14} />
                    <span>Send Uplink</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Quick Starters Bento */}
          <div className="grid grid-cols-2 gap-2">
            {PROMPT_STARTERS.map((s, i) => (
              <button
                key={i}
                onClick={() => handleStarterClick(s.prompt)}
                className="text-left p-3 rounded-xl bg-surface/30 hover:bg-surface/60 border border-border/30 hover:border-accent/40 transition group cursor-pointer"
              >
                <div className="text-xs font-semibold text-text group-hover:text-accent truncate">
                  {s.title}
                </div>
                <div className="text-[10px] text-faint truncate mt-0.5">{s.subtitle}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Right Column: Live Preview Artifact System (6 cols) */}
        <div className="lg:col-span-6 flex flex-col bg-[#050a1c]/90 backdrop-blur-md border border-cyan-500/20 rounded-xl overflow-hidden shadow-2xl">
          {/* Artifact Header Tabs */}
          <div className="flex items-center justify-between px-4 py-2.5 bg-[#030612] border-b border-cyan-500/20">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse shadow-[0_0_8px_#00f0ff]" />
              <span className="font-mono text-xs font-bold text-cyan-300">PREVIEW ARTIFACT</span>
              <span className="px-1.5 py-0.5 rounded text-[9px] font-mono bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
                AgentTelemetryWidget.tsx
              </span>
            </div>

            <div className="flex items-center gap-1 bg-[#09122a] border border-cyan-500/30 rounded-lg p-0.5">
              <button
                onClick={() => setActiveArtifactTab('preview')}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-mono transition cursor-pointer ${
                  activeArtifactTab === 'preview'
                    ? 'bg-cyan-500/20 text-cyan-300 font-bold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Eye size={12} />
                <span>Preview</span>
              </button>
              <button
                onClick={() => setActiveArtifactTab('code')}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-mono transition cursor-pointer ${
                  activeArtifactTab === 'code'
                    ? 'bg-cyan-500/20 text-cyan-300 font-bold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Code2 size={12} />
                <span>Code</span>
              </button>
              <button
                onClick={() => setActiveArtifactTab('console')}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-mono transition cursor-pointer ${
                  activeArtifactTab === 'console'
                    ? 'bg-cyan-500/20 text-cyan-300 font-bold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Terminal size={12} />
                <span>Console</span>
              </button>
            </div>
          </div>

          {/* Artifact Tab Content */}
          <div className="flex-1 p-4 overflow-auto flex flex-col justify-center items-center bg-[#02040b]">
            {activeArtifactTab === 'preview' && (
              <div className="w-full max-w-md p-6 bg-[#091126] border border-cyan-500/30 rounded-2xl shadow-[0_0_40px_rgba(0,240,255,0.15)] font-mono">
                <div className="flex justify-between items-center mb-5 pb-3 border-b border-cyan-500/20">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                    <span className="text-xs font-bold text-white tracking-wider">
                      AGENT TELEMETRY LIVE
                    </span>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[9px] bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                    ONLINE
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="p-3.5 bg-[#040816] rounded-xl border border-cyan-500/20">
                    <div className="text-[10px] text-cyan-400/70 font-semibold mb-1">
                      THROUGHPUT
                    </div>
                    <div className="text-xl font-bold text-cyan-300">42 msg/sec</div>
                  </div>
                  <div className="p-3.5 bg-[#040816] rounded-xl border border-cyan-500/20">
                    <div className="text-[10px] text-emerald-400/70 font-semibold mb-1">
                      CONSENSUS
                    </div>
                    <div className="text-xl font-bold text-emerald-400">99.8%</div>
                  </div>
                </div>

                <div className="p-3 bg-[#040816] rounded-xl border border-slate-800 text-[10px] text-slate-300">
                  <div className="flex justify-between text-slate-400 mb-1">
                    <span>Active Subgraphs</span>
                    <span className="text-cyan-300 font-bold">16 Discovered</span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                    <div className="w-[78%] h-full bg-gradient-to-r from-cyan-400 to-indigo-500" />
                  </div>
                </div>
              </div>
            )}

            {activeArtifactTab === 'code' && (
              <div className="w-full h-full relative font-mono text-[11px] leading-relaxed">
                <button
                  onClick={handleCopy}
                  className="absolute top-2 right-2 flex items-center gap-1.5 px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] border border-slate-700 transition cursor-pointer z-10"
                >
                  {copied ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                  <span>{copied ? 'Copied' : 'Copy'}</span>
                </button>
                <pre className="text-cyan-200/90 whitespace-pre-wrap p-3 bg-[#030612] rounded-lg border border-slate-800 h-full overflow-auto">
                  {SAMPLE_ARTIFACT_CODE}
                </pre>
              </div>
            )}

            {activeArtifactTab === 'console' && (
              <div className="w-full h-full font-mono text-[11px] text-slate-300 p-3 bg-[#030612] rounded-lg border border-slate-800 space-y-1.5 overflow-auto">
                <div className="text-emerald-400">[ArtifactRuntime] React 18+ component compiled clean.</div>
                <div className="text-slate-400">[ArtifactRuntime] Sandboxed iframe DOM mounted.</div>
                <div className="text-cyan-400">[TelemetryDaemon] Subscribed to port 8001 event stream.</div>
                <div className="text-slate-500">[Profiler] Initial paint in 14.2ms.</div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
