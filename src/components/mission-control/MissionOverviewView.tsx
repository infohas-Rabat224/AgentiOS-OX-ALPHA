import React, { useState } from 'react';
import {
  Activity,
  Terminal,
  ShieldCheck,
  Server,
  Zap,
  Play,
  CheckCircle2,
  Clock,
  ArrowRight,
  Bot,
  Brain,
  Layers,
  Send
} from 'lucide-react';
import { BrainRecord, MissionType, SystemEvent } from '../../types/missionControl';

interface MissionOverviewViewProps {
  brains: BrainRecord[];
  onNavigateToBrains: () => void;
}

export const MissionOverviewView: React.FC<MissionOverviewViewProps> = ({
  brains,
  onNavigateToBrains,
}) => {
  const [missions, setMissions] = useState<MissionType[]>([
    {
      id: 'msn-001',
      title: 'Realtime Architecture Audit & Concurrency Verification',
      status: 'completed',
      assigned_agents: ['Python 3.10 Kernel', 'Claude 3.7 Sonnet'],
      progress: 100,
      total_steps: 12,
      completed_steps: 12,
      started_at: '10:15 AM',
      runtime_seconds: 320,
    },
    {
      id: 'msn-002',
      title: 'Continuous Brain Discovery & MCP Server Probe',
      status: 'running',
      assigned_agents: ['Node v22 Runtime', 'Hermes 3 Function Brain'],
      progress: 68,
      total_steps: 10,
      completed_steps: 7,
      started_at: '10:38 AM',
      runtime_seconds: 145,
    },
    {
      id: 'msn-003',
      title: 'OmniRoute Low-Latency Multi-Model Dispatch Benchmark',
      status: 'running',
      assigned_agents: ['Gemini 2.5 Flash', 'DeepSeek R1'],
      progress: 45,
      total_steps: 8,
      completed_steps: 4,
      started_at: '10:44 AM',
      runtime_seconds: 64,
    },
  ]);

  const [promptInput, setPromptInput] = useState('');
  const [dispatchedMessage, setDispatchedMessage] = useState<string | null>(null);

  const [events, setEvents] = useState<SystemEvent[]>([
    {
      id: 'evt-1',
      timestamp: '10:45:12',
      subsystem: 'OmniRoute',
      level: 'success',
      message: 'Fast-path model router selected Gemini 2.5 Flash for sub-20ms latency goal',
    },
    {
      id: 'evt-2',
      timestamp: '10:44:50',
      subsystem: 'BrainDiscovery',
      level: 'info',
      message: 'Scanned host environment: Git 2.34.1, Node 22.23.2, Python 3.10.12 validated',
    },
    {
      id: 'evt-3',
      timestamp: '10:44:02',
      subsystem: 'EventBus',
      level: 'info',
      message: 'Backpressure window stable at 0 queued events, 12 active handlers',
    },
    {
      id: 'evt-4',
      timestamp: '10:43:18',
      subsystem: 'ContainerDI',
      level: 'success',
      message: 'Zero-reflection dependency injection cache hit (0.012ms lookup)',
    },
  ]);

  const handleDispatch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!promptInput.trim()) return;

    const newMsn: MissionType = {
      id: `msn-00${missions.length + 1}`,
      title: promptInput,
      status: 'running',
      assigned_agents: ['Python 3.10 Kernel', 'Hermes 3 Function Brain'],
      progress: 10,
      total_steps: 6,
      completed_steps: 1,
      started_at: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      runtime_seconds: 0,
    };

    setMissions([newMsn, ...missions]);
    setDispatchedMessage(`Mission "${promptInput}" dispatched to AgenticOS Kernel.`);
    setPromptInput('');

    setTimeout(() => {
      setDispatchedMessage(null);
    }, 4000);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner KPI Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-[#0e121d] p-4 rounded-xl border border-slate-800">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400 font-mono">Kernel Core Status</span>
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
          </div>
          <div className="text-xl font-bold text-white font-mono mt-1">OPERATIONAL</div>
          <span className="text-[10px] text-emerald-400 font-mono mt-1 block">
            12/12 Subsystems Online (8001)
          </span>
        </div>

        <div
          onClick={onNavigateToBrains}
          className="bg-[#0e121d] hover:bg-[#131826] p-4 rounded-xl border border-slate-800 hover:border-cyan-500/50 transition-all cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400 font-mono">Discovered Brains</span>
            <Brain className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-xl font-bold text-cyan-300 font-mono mt-1">
            {brains.length} Registered
          </div>
          <span className="text-[10px] text-slate-400 font-mono mt-1 block flex items-center">
            Click to inspect brains registry →
          </span>
        </div>

        <div className="bg-[#0e121d] p-4 rounded-xl border border-slate-800">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400 font-mono">Active Missions</span>
            <Activity className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="text-xl font-bold text-indigo-300 font-mono mt-1">
            {missions.filter((m) => m.status === 'running').length} In Progress
          </div>
          <span className="text-[10px] text-slate-400 font-mono mt-1 block">
            Multi-Agent Cooperative DAG
          </span>
        </div>

        <div className="bg-[#0e121d] p-4 rounded-xl border border-slate-800">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400 font-mono">Local Bus Latency</span>
            <Zap className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-xl font-bold text-amber-300 font-mono mt-1">
            1.8 ms
          </div>
          <span className="text-[10px] text-slate-400 font-mono mt-1 block">
            Lockless async dispatch
          </span>
        </div>
      </div>

      {/* Goal / Mission Dispatch Prompt Bar */}
      <div className="bg-[#0e121d] p-5 rounded-2xl border border-slate-800 shadow-md">
        <h4 className="text-xs font-mono font-semibold uppercase tracking-wider text-slate-300 mb-2 flex items-center">
          <Play className="w-3.5 h-3.5 text-cyan-400 mr-2" />
          Dispatch Autonomous Goal to AgenticOS Kernel
        </h4>
        <form onSubmit={handleDispatch} className="flex gap-2">
          <input
            type="text"
            placeholder="e.g., 'Execute automated regression test suite across Git & Node brains' or 'Benchmark OmniRoute model policies'..."
            value={promptInput}
            onChange={(e) => setPromptInput(e.target.value)}
            className="flex-1 bg-[#131826] border border-slate-700/80 rounded-xl px-4 py-2.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-400 font-mono"
          />
          <button
            type="submit"
            className="flex items-center space-x-1.5 px-5 py-2.5 bg-cyan-500 hover:bg-cyan-400 text-slate-950 rounded-xl text-xs font-semibold font-mono transition-colors cursor-pointer shrink-0"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Dispatch</span>
          </button>
        </form>

        {dispatchedMessage && (
          <div className="mt-3 p-2.5 bg-emerald-950/40 border border-emerald-800/40 text-emerald-400 rounded-lg text-xs font-mono flex items-center animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 mr-2 shrink-0" />
            {dispatchedMessage}
          </div>
        )}
      </div>

      {/* Active Missions & System Events Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Active Missions */}
        <div className="bg-[#0e121d] rounded-2xl border border-slate-800 p-5 shadow-md flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-xs font-mono font-semibold uppercase tracking-wider text-slate-300 flex items-center">
              <Bot className="w-4 h-4 text-purple-400 mr-2" />
              Active Operating Missions ({missions.length})
            </h4>
            <span className="text-[10px] font-mono text-slate-500">Autonomous Execution</span>
          </div>

          <div className="space-y-3 flex-1">
            {missions.map((m) => (
              <div
                key={m.id}
                className="bg-[#131826] border border-slate-800/80 p-3.5 rounded-xl hover:border-slate-700 transition-colors"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="text-[10px] font-mono text-slate-400 uppercase">{m.id}</span>
                    <h5 className="text-xs font-semibold text-slate-200 mt-0.5">{m.title}</h5>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-mono font-semibold capitalize ${
                      m.status === 'completed'
                        ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-800/40'
                        : 'bg-cyan-950/60 text-cyan-400 border border-cyan-800/40 animate-pulse'
                    }`}
                  >
                    {m.status}
                  </span>
                </div>

                <div className="mt-3">
                  <div className="flex justify-between text-[10px] font-mono text-slate-400 mb-1">
                    <span>
                      Steps: {m.completed_steps}/{m.total_steps}
                    </span>
                    <span>{m.progress}%</span>
                  </div>
                  <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-cyan-400 rounded-full transition-all duration-300"
                      style={{ width: `${m.progress}%` }}
                    />
                  </div>
                </div>

                <div className="mt-3 flex items-center justify-between text-[10px] font-mono text-slate-400 border-t border-slate-800/60 pt-2">
                  <span className="truncate max-w-[200px]">Agents: {m.assigned_agents.join(', ')}</span>
                  <span>Started {m.started_at}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Live System Events Feed */}
        <div className="bg-[#0e121d] rounded-2xl border border-slate-800 p-5 shadow-md flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-xs font-mono font-semibold uppercase tracking-wider text-slate-300 flex items-center">
              <Terminal className="w-4 h-4 text-emerald-400 mr-2" />
              Live Subsystem Event Feed
            </h4>
            <span className="text-[10px] font-mono text-emerald-400 flex items-center">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mr-1.5 animate-pulse" />
              STREAM ACTIVE
            </span>
          </div>

          <div className="space-y-2.5 flex-1 overflow-y-auto max-h-[360px]">
            {events.map((evt) => (
              <div
                key={evt.id}
                className="bg-[#131826] border border-slate-800/60 p-3 rounded-lg font-mono text-xs text-slate-300 hover:bg-[#181f30] transition-colors"
              >
                <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1">
                  <span className="text-cyan-400 font-semibold">{evt.subsystem}</span>
                  <span>{evt.timestamp}</span>
                </div>
                <p className="text-[11px] text-slate-200">{evt.message}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
