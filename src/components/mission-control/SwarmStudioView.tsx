import React, { useState } from 'react';
import {
  Layers,
  Bot,
  Sparkles,
  Users,
  Zap,
  ArrowRight,
  CheckCircle2,
  Share2,
  Clock,
  Play
} from 'lucide-react';
import { BrainRecord } from '../../types/missionControl';

interface SwarmStudioViewProps {
  brains: BrainRecord[];
}

export const SwarmStudioView: React.FC<SwarmStudioViewProps> = ({ brains }) => {
  const [swarms, setSwarms] = useState([
    {
      id: 'swarm-alpha',
      name: 'Autonomous Code Refactoring & Security Audit Swarm',
      topology: 'hierarchical',
      orchestrator: 'Python 3.10 Kernel',
      workers: ['Claude 3.7 Sonnet', 'Node v22 Runtime', 'Git Version Controller'],
      status: 'active',
      throughput: '14 tasks/min',
      consensus_mode: 'majority_vote',
    },
    {
      id: 'swarm-beta',
      name: 'High-Speed Synthesis & Model Benchmark Swarm',
      topology: 'peer-to-peer',
      orchestrator: 'Hermes 3 Function Brain',
      workers: ['Gemini 2.5 Flash', 'DeepSeek R1', 'Ollama Llama 3.3 70B'],
      status: 'active',
      throughput: '38 tasks/min',
      consensus_mode: 'confidence_threshold',
    },
  ]);

  return (
    <div className="space-y-6">
      <div className="bg-[#0e121d] rounded-2xl border border-slate-800 p-6 shadow-md">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/20 text-purple-400 border border-purple-500/40 flex items-center justify-center">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white tracking-tight">
                AgenticOS Swarm Orchestration Studio
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Cooperative multi-agent goal planning, peer-to-peer debate, consensus voting & task DAG distribution
              </p>
            </div>
          </div>

          <span className="px-3 py-1 rounded-full text-xs font-mono font-semibold bg-emerald-950/60 text-emerald-400 border border-emerald-800/60 flex items-center">
            <span className="w-2 h-2 rounded-full bg-emerald-400 mr-2 animate-pulse" />
            2 ACTIVE SWARMS
          </span>
        </div>

        {/* Swarms List */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-6">
          {swarms.map((swarm) => (
            <div
              key={swarm.id}
              className="bg-[#131826] border border-slate-800 rounded-xl p-5 hover:border-slate-700 transition-all flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-[10px] font-mono text-purple-400 uppercase tracking-wider">
                      {swarm.id} • {swarm.topology}
                    </span>
                    <h4 className="text-sm font-semibold text-slate-100 mt-1">
                      {swarm.name}
                    </h4>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-emerald-950/60 text-emerald-400 border border-emerald-800/40">
                    ONLINE
                  </span>
                </div>

                <div className="mt-4 space-y-2 text-xs font-mono">
                  <div className="flex items-center justify-between text-slate-400 bg-slate-900/60 px-2.5 py-1.5 rounded-lg border border-slate-800">
                    <span className="text-slate-500">Lead Brain:</span>
                    <span className="text-cyan-300 font-semibold">{swarm.orchestrator}</span>
                  </div>

                  <div className="flex items-center justify-between text-slate-400 bg-slate-900/60 px-2.5 py-1.5 rounded-lg border border-slate-800">
                    <span className="text-slate-500">Consensus Mode:</span>
                    <span className="text-purple-300 capitalize">{swarm.consensus_mode.replace('_', ' ')}</span>
                  </div>

                  <div className="pt-2">
                    <span className="text-[11px] text-slate-400 block mb-1.5">Connected Worker Brains:</span>
                    <div className="flex flex-wrap gap-1.5">
                      {swarm.workers.map((w) => (
                        <span
                          key={w}
                          className="px-2 py-0.5 rounded bg-slate-800/80 text-slate-300 text-[11px] border border-slate-700/60"
                        >
                          {w}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-5 pt-3 border-t border-slate-800 flex items-center justify-between text-xs font-mono text-slate-400">
                <span>Throughput: <strong className="text-emerald-400">{swarm.throughput}</strong></span>
                <span className="text-cyan-400 hover:text-cyan-300 cursor-pointer">
                  Configure Swarm Policy →
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
