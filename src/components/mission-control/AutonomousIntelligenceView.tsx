import React, { useState } from 'react';
import {
  Brain,
  Cpu,
  Sparkles,
  Target,
  Compass,
  CheckCircle2,
  AlertCircle,
  Play,
  RotateCcw,
  Shield,
  Layers,
  Activity,
  Zap,
  TrendingUp,
  Award
} from 'lucide-react';
import { BrainRecord } from '../../types/missionControl';

interface AutonomousIntelligenceViewProps {
  brains?: BrainRecord[];
}

interface GoalItem {
  id: string;
  title: string;
  state: 'pending' | 'active' | 'paused' | 'evaluated' | 'achieved' | 'failed' | 'cancelled' | 'suspended' | 'archived' | 'reprioritized';
  priority: 'low' | 'medium' | 'high' | 'critical';
  assignedSwarm: string;
  progress: number;
}

const INITIAL_GOALS: GoalItem[] = [
  {
    id: 'goal-01',
    title: 'Audit and optimize cluster memory footprint below 2.0GB',
    state: 'active',
    priority: 'high',
    assignedSwarm: 'swarm-kernel-opt',
    progress: 78,
  },
  {
    id: 'goal-02',
    title: 'Discover and benchmark local Ollama DeepSeek-R1 inference',
    state: 'achieved',
    priority: 'critical',
    assignedSwarm: 'swarm-eval-01',
    progress: 100,
  },
  {
    id: 'goal-03',
    title: 'Self-heal degraded MCP SQLite tool connection',
    state: 'evaluated',
    priority: 'medium',
    assignedSwarm: 'swarm-diagnostics',
    progress: 92,
  },
  {
    id: 'goal-04',
    title: 'Synthesize federated knowledge graph cross-host relations',
    state: 'pending',
    priority: 'medium',
    assignedSwarm: 'swarm-cluster-sync',
    progress: 24,
  },
];

export const AutonomousIntelligenceView: React.FC<AutonomousIntelligenceViewProps> = ({ brains = [] }) => {
  const [activeLayer, setActiveLayer] = useState<'executive' | 'cognitive' | 'reflection'>('executive');
  const [goals, setGoals] = useState<GoalItem[]>(INITIAL_GOALS);
  const [selectedGoal, setSelectedGoal] = useState<GoalItem>(INITIAL_GOALS[0]);
  const [decisionRun, setDecisionRun] = useState(false);
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  const showNotice = (msg: string) => {
    setActionNotice(msg);
    setTimeout(() => setActionNotice(null), 3500);
  };

  const handleGoalAction = (goalId: string, action: string) => {
    setGoals((prev) =>
      prev.map((g) => {
        if (g.id !== goalId) return g;
        if (action === 'activate') return { ...g, state: 'active' };
        if (action === 'pause') return { ...g, state: 'paused' };
        if (action === 'suspend') return { ...g, state: 'suspended' };
        if (action === 'archive') return { ...g, state: 'archived' };
        if (action === 'reprioritize') return { ...g, priority: g.priority === 'critical' ? 'high' : 'critical' };
        return g;
      })
    );
    showNotice(`Goal ${goalId}: Action '${action}' executed successfully.`);
  };

  const handleRunDecisionEngine = () => {
    setDecisionRun(true);
    setTimeout(() => {
      setDecisionRun(false);
      showNotice('DecisionEngine completed 7-factor evaluation: Selected Claude-3.7-Sonnet with 0.94 confidence.');
    }, 1200);
  };

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-surface text-text p-4 space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-base font-bold tracking-tight text-text">Autonomous Intelligence Core</h1>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-purple-500/20 text-purple-400 border border-purple-500/30">
              PHASES 11 & 12
            </span>
          </div>
          <p className="text-xs text-muted">
            Executive Intelligence (Goals, Decisions, 12-Field Reflections) & Cognitive Intelligence (World Model, Knowledge Graph, Strategic Planning)
          </p>
        </div>

        <div className="flex items-center gap-2">
          {actionNotice && (
            <span className="text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-3 py-1 rounded-lg">
              {actionNotice}
            </span>
          )}
          <button
            onClick={handleRunDecisionEngine}
            disabled={decisionRun}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent/20 hover:bg-accent/30 text-accent font-semibold text-xs border border-accent/40 transition cursor-pointer"
          >
            <Play size={13} className={decisionRun ? 'animate-spin' : ''} />
            <span>Run Decision Engine</span>
          </button>
        </div>
      </div>

      {/* Layer Navigation */}
      <div className="flex items-center gap-2 border-b border-border/30 pb-2 text-xs font-mono">
        <button
          onClick={() => setActiveLayer('executive')}
          className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
            activeLayer === 'executive'
              ? 'bg-purple-500/20 text-purple-300 font-bold border border-purple-500/40'
              : 'text-muted hover:text-text'
          }`}
        >
          Phase 11: Executive Intelligence (GoalManager & DecisionEngine)
        </button>
        <button
          onClick={() => setActiveLayer('cognitive')}
          className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
            activeLayer === 'cognitive'
              ? 'bg-purple-500/20 text-purple-300 font-bold border border-purple-500/40'
              : 'text-muted hover:text-text'
          }`}
        >
          Phase 12: Cognitive Intelligence (WorldModel & BFS KnowledgeGraph)
        </button>
        <button
          onClick={() => setActiveLayer('reflection')}
          className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
            activeLayer === 'reflection'
              ? 'bg-purple-500/20 text-purple-300 font-bold border border-purple-500/40'
              : 'text-muted hover:text-text'
          }`}
        >
          12-Field Post-Mission Reflection Engine
        </button>
      </div>

      {/* LAYER 1: EXECUTIVE INTELLIGENCE */}
      {activeLayer === 'executive' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Goals List (10 Goal States) */}
          <div className="lg:col-span-2 rounded-xl border border-border/40 bg-surface/30 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-text">GoalManager: 12 Operations & 10 Goal States</h2>
                <p className="text-xs text-muted">Autonomous goal decomposition, supervision, and lifecycle tracking</p>
              </div>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-surface/60 text-muted">
                {goals.length} Goals Active
              </span>
            </div>

            <div className="space-y-2.5">
              {goals.map((g) => (
                <div
                  key={g.id}
                  onClick={() => setSelectedGoal(g)}
                  className={`p-3.5 rounded-xl border transition cursor-pointer ${
                    selectedGoal.id === g.id
                      ? 'border-accent bg-accent/10'
                      : 'border-border/30 bg-surface/40 hover:bg-surface/60'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Target size={15} className="text-accent" />
                      <span className="font-bold text-xs text-text">{g.title}</span>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase ${
                        g.state === 'active'
                          ? 'bg-emerald-500/20 text-emerald-400'
                          : g.state === 'achieved'
                          ? 'bg-cyan-500/20 text-cyan-300'
                          : 'bg-surface/80 text-muted'
                      }`}
                    >
                      {g.state}
                    </span>
                  </div>

                  <div className="mt-3 flex items-center justify-between text-xs font-mono">
                    <div className="flex items-center gap-3 text-muted">
                      <span>Priority: <strong className="text-text uppercase">{g.priority}</strong></span>
                      <span>•</span>
                      <span>Assigned: <strong className="text-accent">{g.assignedSwarm}</strong></span>
                    </div>
                    <span className="font-bold text-text">{g.progress}%</span>
                  </div>

                  {/* Progress Bar */}
                  <div className="mt-2 h-1.5 w-full bg-surface/60 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-purple-500 to-accent rounded-full"
                      style={{ width: `${g.progress}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Goal Operations Controls */}
          <div className="rounded-xl border border-border/40 bg-surface/30 p-5 space-y-4">
            <h2 className="text-sm font-bold text-text">Goal Lifecycle Operations</h2>
            <div className="text-xs text-muted font-mono">Target: {selectedGoal.title}</div>

            <div className="space-y-2 font-mono text-xs">
              <button
                onClick={() => handleGoalAction(selectedGoal.id, 'activate')}
                className="w-full py-2 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 font-bold border border-emerald-500/40 transition cursor-pointer"
              >
                Activate Goal
              </button>
              <button
                onClick={() => handleGoalAction(selectedGoal.id, 'pause')}
                className="w-full py-2 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 font-bold border border-amber-500/40 transition cursor-pointer"
              >
                Pause Goal
              </button>
              <button
                onClick={() => handleGoalAction(selectedGoal.id, 'reprioritize')}
                className="w-full py-2 rounded-lg bg-accent/20 hover:bg-accent/30 text-accent font-bold border border-accent/40 transition cursor-pointer"
              >
                Reprioritize (Toggle Critical)
              </button>
              <button
                onClick={() => handleGoalAction(selectedGoal.id, 'suspend')}
                className="w-full py-2 rounded-lg bg-surface/60 hover:bg-surface/80 text-muted hover:text-text border border-border/40 transition cursor-pointer"
              >
                Suspend Goal
              </button>
              <button
                onClick={() => handleGoalAction(selectedGoal.id, 'archive')}
                className="w-full py-2 rounded-lg bg-surface/60 hover:bg-surface/80 text-muted hover:text-text border border-border/40 transition cursor-pointer"
              >
                Archive Goal
              </button>
            </div>

            <div className="pt-3 border-t border-border/30 text-[11px] text-muted space-y-1">
              <div className="font-bold text-text">7-Factor Decision Matrix:</div>
              <div>• Cost, Latency, Capability Match, Risk Level, Context Window, SLA Baseline, Availability</div>
            </div>
          </div>
        </div>
      )}

      {/* LAYER 2: COGNITIVE INTELLIGENCE */}
      {activeLayer === 'cognitive' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="rounded-xl border border-border/40 bg-surface/30 p-5 space-y-3">
            <h2 className="text-sm font-bold text-text">WorldModel & KnowledgeGraph (BFS Traversal)</h2>
            <p className="text-xs text-muted">Continuous knowledge extraction and topological impact calculation</p>

            <div className="p-4 rounded-xl border border-border/30 bg-surface/50 font-mono text-xs space-y-2">
              <div className="flex justify-between text-muted">
                <span>Total Entities in World Model:</span>
                <strong className="text-text">4,812</strong>
              </div>
              <div className="flex justify-between text-muted">
                <span>Active Knowledge Relations:</span>
                <strong className="text-accent">19,420</strong>
              </div>
              <div className="flex justify-between text-muted">
                <span>BFS Traversal Latency:</span>
                <strong className="text-ok">0.24 ms</strong>
              </div>
              <div className="flex justify-between text-muted">
                <span>Impact Analysis Depth:</span>
                <strong className="text-text">6 hops</strong>
              </div>
            </div>

            <div className="pt-2">
              <div className="text-xs font-bold text-text mb-2">Recent World Model Updates:</div>
              <div className="space-y-1.5 font-mono text-[11px] text-slate-300">
                <div className="p-2 rounded bg-surface/40 border border-border/30">
                  <span className="text-purple-400 font-bold">[BRAIN_UPDATED]</span> Python Kernel added capability 'ast_analysis'
                </div>
                <div className="p-2 rounded bg-surface/40 border border-border/30">
                  <span className="text-cyan-400 font-bold">[RELATION_LEARNED]</span> DeepSeek-R1 solves complex reasoning at 40% lower token cost
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-border/40 bg-surface/30 p-5 space-y-3">
            <h2 className="text-sm font-bold text-text">PredictionEngine & ExperienceReplay</h2>
            <p className="text-xs text-muted">Predicts mission outcomes and feeds back into policy optimization</p>

            <div className="grid grid-cols-2 gap-3 font-mono text-xs">
              <div className="p-3 rounded-lg bg-surface/40 border border-border/30">
                <div className="text-muted text-[10px]">Prediction Accuracy</div>
                <div className="text-base font-bold text-ok mt-0.5">96.4%</div>
              </div>
              <div className="p-3 rounded-lg bg-surface/40 border border-border/30">
                <div className="text-muted text-[10px]">Experience Replay Size</div>
                <div className="text-base font-bold text-text mt-0.5">1,240 runs</div>
              </div>
            </div>

            <div className="p-3.5 rounded-xl border border-border/30 bg-surface/40 text-xs font-mono space-y-2">
              <div className="font-bold text-text">Autonomous Improvement Loop:</div>
              <div className="text-muted text-[11px]">
                Every completed mission automatically triggers:
                <div className="mt-1 text-purple-300">
                  Reflection → Evaluation → Prediction → Learning → Capability → Evolution → Executive → Swarm
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* LAYER 3: 12-FIELD REFLECTION ENGINE */}
      {activeLayer === 'reflection' && (
        <div className="rounded-xl border border-border/40 bg-surface/30 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-text">ReflectionEngine: 12-Field Post-Mission Analysis</h2>
              <p className="text-xs text-muted">Evaluates every completed task across 12 analytical dimensions</p>
            </div>
            <span className="px-2.5 py-1 rounded-full text-xs font-mono font-bold bg-ok/10 text-ok border border-ok/30">
              Audit Complete: Mission #4012
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-3 font-mono text-xs">
            {[
              { field: '1. Duration & Latency', val: '1,420 ms', status: 'Optimal' },
              { field: '2. Token Efficiency', val: '94.2% hit', status: 'High' },
              { field: '3. Tool Selection Quality', val: '4/4 tools correct', status: 'Perfect' },
              { field: '4. Error / Retry Count', val: '0 retries', status: 'Clean' },
              { field: '5. Consensus Convergence', val: '3 of 3 votes agreed', status: 'Unified' },
              { field: '6. Output Validation Score', val: '0.985 / 1.0', status: 'Verified' },
              { field: '7. Cost vs Budget', val: '$0.0018 ($0.010 cap)', status: 'Low Cost' },
              { field: '8. Memory Retention Impact', val: '+4 facts persisted', status: 'Committed' },
              { field: '9. Swarm Role Harmony', val: 'No deadlocks', status: 'Harmonious' },
              { field: '10. Security Gating Score', val: 'Zero permission violations', status: 'Secure' },
              { field: '11. Self-Critique Delta', val: 'Identified regex shortcut', status: 'Improved' },
              { field: '12. Evolution Trigger', val: 'New pattern cached', status: 'Evolved' },
            ].map((f, i) => (
              <div key={i} className="p-3 rounded-lg border border-border/30 bg-surface/40 space-y-1">
                <div className="text-muted text-[10px] truncate">{f.field}</div>
                <div className="font-bold text-text">{f.val}</div>
                <div className="text-[10px] text-emerald-400 font-semibold">{f.status}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
