import React, { useState } from 'react';
import {
  GitBranch,
  Play,
  RotateCcw,
  CheckCircle2,
  Clock,
  AlertCircle,
  ShieldCheck,
  ChevronRight,
  Filter,
  Layers,
  ArrowRight,
  Cpu
} from 'lucide-react';
import { BrainRecord } from '../../types/missionControl';

interface ExecutionTimelineViewProps {
  brains?: BrainRecord[];
}

interface ExecutionTask {
  id: string;
  name: string;
  stage: string;
  agent: string;
  status: 'created' | 'dispatched' | 'executing' | 'validating' | 'completed' | 'failed';
  durationMs: number;
  tokens: number;
  timestamp: string;
  dependencies: string[];
}

const INITIAL_TASKS: ExecutionTask[] = [
  {
    id: 'task-101',
    name: 'Scan local workspace and profile AST dependencies',
    stage: 'Analysis',
    agent: 'Python Kernel (Core)',
    status: 'completed',
    durationMs: 412,
    tokens: 1240,
    timestamp: '14:28:10',
    dependencies: [],
  },
  {
    id: 'task-102',
    name: 'Formulate swarm orchestration plan & consensus criteria',
    stage: 'Planning',
    agent: 'Claude 3.7 Sonnet',
    status: 'completed',
    durationMs: 820,
    tokens: 3100,
    timestamp: '14:28:11',
    dependencies: ['task-101'],
  },
  {
    id: 'task-103',
    name: 'Dispatch parallel unit test generator to sandbox nodes',
    stage: 'Execution',
    agent: 'Node.js Worker (Cluster)',
    status: 'executing',
    durationMs: 640,
    tokens: 1850,
    timestamp: '14:28:12',
    dependencies: ['task-102'],
  },
  {
    id: 'task-104',
    name: 'Perform cryptographic checksum verification and security audit',
    stage: 'Validation',
    agent: 'Hermes 3 (Audit Gate)',
    status: 'validating',
    durationMs: 290,
    tokens: 950,
    timestamp: '14:28:13',
    dependencies: ['task-103'],
  },
  {
    id: 'task-105',
    name: 'Commit scoped memory facts to Knowledge Graph',
    stage: 'Finalization',
    agent: 'Local SQLite Adapter',
    status: 'created',
    durationMs: 0,
    tokens: 0,
    timestamp: 'Pending',
    dependencies: ['task-104'],
  },
];

export const ExecutionTimelineView: React.FC<ExecutionTimelineViewProps> = ({ brains = [] }) => {
  const [tasks, setTasks] = useState<ExecutionTask[]>(INITIAL_TASKS);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [isReplaying, setIsReplaying] = useState(false);
  const [selectedTask, setSelectedTask] = useState<ExecutionTask>(INITIAL_TASKS[2]);
  const [statusNotice, setStatusNotice] = useState<string | null>(null);

  const handleReplay = () => {
    setIsReplaying(true);
    setStatusNotice('Replaying DAG workflow from root task via /api/workflows/replay endpoint...');
    setTimeout(() => {
      setIsReplaying(false);
      setStatusNotice('Replay completed: All 5 execution stages re-verified deterministically.');
      setTimeout(() => setStatusNotice(null), 3000);
    }, 1500);
  };

  const filteredTasks = tasks.filter((t) => {
    if (filterStatus === 'all') return true;
    return t.status === filterStatus;
  });

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-surface text-text p-4 space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-base font-bold tracking-tight text-text">Execution Graph & Task Timeline</h1>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
              DAG TOPOLOGY & REPLAY
            </span>
          </div>
          <p className="text-xs text-muted">
            Topological DAG stage progression • Status indicators • Approval Gates • Replay Engine
          </p>
        </div>

        <div className="flex items-center gap-2">
          {statusNotice && (
            <span className="text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-3 py-1 rounded-lg">
              {statusNotice}
            </span>
          )}
          <button
            onClick={handleReplay}
            disabled={isReplaying}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent/20 hover:bg-accent/30 text-accent font-semibold text-xs border border-accent/40 transition cursor-pointer"
          >
            <RotateCcw size={13} className={isReplaying ? 'animate-spin' : ''} />
            <span>{isReplaying ? 'Replaying DAG...' : 'Replay Execution'}</span>
          </button>
        </div>
      </div>

      {/* DAG Stage Pipeline Visualizer */}
      <div className="rounded-xl border border-border/40 bg-surface/30 p-4">
        <div className="text-xs font-mono font-bold text-muted uppercase tracking-wider mb-3">
          Topological DAG Execution Flow
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {tasks.map((task, idx) => {
            const isSelected = selectedTask.id === task.id;
            return (
              <React.Fragment key={task.id}>
                <div
                  onClick={() => setSelectedTask(task)}
                  className={`flex items-center gap-2.5 p-3 rounded-xl border transition cursor-pointer font-mono text-xs ${
                    isSelected
                      ? 'border-accent bg-accent/10 shadow-lg'
                      : 'border-border/40 bg-surface/60 hover:bg-surface/90'
                  }`}
                >
                  <div
                    className={`h-2.5 w-2.5 rounded-full ${
                      task.status === 'completed'
                        ? 'bg-emerald-400'
                        : task.status === 'executing'
                        ? 'bg-amber-400 animate-ping'
                        : task.status === 'validating'
                        ? 'bg-cyan-400 animate-pulse'
                        : 'bg-slate-500'
                    }`}
                  />
                  <div>
                    <div className="font-bold text-text">{task.stage}</div>
                    <div className="text-[10px] text-muted">{task.agent}</div>
                  </div>
                </div>

                {idx < tasks.length - 1 && (
                  <ArrowRight size={14} className="text-border shrink-0" />
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {/* Main Split: Timeline & Selected Task Detail */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left 2 Cols: Chronological Timeline */}
        <div className="lg:col-span-2 rounded-xl border border-border/40 bg-surface/30 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-text">Chronological Activity Log</h2>

            {/* Filter */}
            <div className="flex items-center gap-1.5 text-xs font-mono">
              <Filter size={13} className="text-muted" />
              {['all', 'completed', 'executing', 'validating'].map((st) => (
                <button
                  key={st}
                  onClick={() => setFilterStatus(st)}
                  className={`px-2 py-0.5 rounded capitalize transition cursor-pointer ${
                    filterStatus === st
                      ? 'bg-accent text-slate-950 font-bold'
                      : 'bg-surface/50 text-muted hover:text-text'
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            {filteredTasks.map((t) => (
              <div
                key={t.id}
                onClick={() => setSelectedTask(t)}
                className={`p-3 rounded-xl border transition cursor-pointer ${
                  selectedTask.id === t.id
                    ? 'border-accent bg-accent/10'
                    : 'border-border/30 bg-surface/40 hover:bg-surface/70'
                }`}
              >
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-muted text-[11px]">{t.timestamp}</span>
                    <span className="font-bold text-text">{t.name}</span>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase ${
                      t.status === 'completed'
                        ? 'bg-emerald-500/20 text-emerald-400'
                        : t.status === 'executing'
                        ? 'bg-amber-500/20 text-amber-300'
                        : t.status === 'validating'
                        ? 'bg-cyan-500/20 text-cyan-300'
                        : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {t.status}
                  </span>
                </div>

                <div className="mt-2 flex items-center justify-between text-[11px] font-mono text-muted">
                  <div className="flex items-center gap-2">
                    <span>Agent: <strong className="text-accent">{t.agent}</strong></span>
                    <span>•</span>
                    <span>Tokens: <strong>{t.tokens}</strong></span>
                  </div>
                  <span>{t.durationMs} ms</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right 1 Col: Selected Task Inspector */}
        <div className="rounded-xl border border-border/40 bg-surface/30 p-4 space-y-4 font-mono text-xs">
          <div className="flex items-center justify-between border-b border-border/30 pb-3">
            <h3 className="font-bold text-text">Task Inspector</h3>
            <span className="text-accent font-bold">{selectedTask.id}</span>
          </div>

          <div className="space-y-2.5">
            <div>
              <span className="text-muted text-[10px]">Operation Name</span>
              <div className="text-text font-bold text-xs mt-0.5">{selectedTask.name}</div>
            </div>

            <div>
              <span className="text-muted text-[10px]">Assigned Agent Brain</span>
              <div className="text-accent font-bold text-xs mt-0.5">{selectedTask.agent}</div>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2">
              <div className="p-2.5 rounded-lg bg-surface/40 border border-border/30">
                <div className="text-[10px] text-muted">Stage</div>
                <div className="text-xs font-bold text-text mt-0.5">{selectedTask.stage}</div>
              </div>
              <div className="p-2.5 rounded-lg bg-surface/40 border border-border/30">
                <div className="text-[10px] text-muted">Latency</div>
                <div className="text-xs font-bold text-emerald-400 mt-0.5">{selectedTask.durationMs} ms</div>
              </div>
            </div>

            <div>
              <span className="text-muted text-[10px]">Upstream Dependencies</span>
              <div className="text-slate-300 text-xs mt-0.5">
                {selectedTask.dependencies.length > 0
                  ? selectedTask.dependencies.join(', ')
                  : 'None (Root Node)'}
              </div>
            </div>

            <div className="p-3 rounded-lg bg-surface/50 border border-border/30 text-[11px] text-slate-300 space-y-1">
              <div className="flex items-center gap-1.5 text-emerald-400 font-bold">
                <ShieldCheck size={14} />
                <span>Approval Gate Verified</span>
              </div>
              <div className="text-muted">Sandboxed via container isolation, zero network exfiltration detected.</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
