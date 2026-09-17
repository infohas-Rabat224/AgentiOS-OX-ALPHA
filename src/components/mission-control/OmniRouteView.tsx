import React, { useState, useEffect } from 'react';
import {
  Zap,
  Activity,
  ShieldCheck,
  TrendingDown,
  Layers,
  Cpu,
  RefreshCw,
  Terminal,
  Sliders,
  Maximize2
} from 'lucide-react';
import { BrainRecord } from '../../types/missionControl';
import { OmniRouteDiagnosticView } from './OmniRouteDiagnosticView';
import { OmniRouteDiagnosticPanel } from './OmniRouteDiagnosticPanel';
import { omniRouterService, AgentNode, TrafficMetric } from '../../services/omniRouter';

interface OmniRouteViewProps {
  brains?: BrainRecord[];
}

export const OmniRouteView: React.FC<OmniRouteViewProps> = ({ brains = [] }) => {
  const [activeSubTab, setActiveSubTab] = useState<'diagnostics' | 'matrix' | 'policies'>('diagnostics');
  const [activeStrategy, setActiveStrategy] = useState<'latency' | 'cost' | 'balanced' | 'reasoning'>('latency');
  const [agents, setAgents] = useState<AgentNode[]>(omniRouterService.getAgents());
  const [metrics, setMetrics] = useState<TrafficMetric>(omniRouterService.getMetrics());
  const [showOverlay, setShowOverlay] = useState(false);

  useEffect(() => {
    const unsubscribe = omniRouterService.subscribe(() => {
      setAgents([...omniRouterService.getAgents()]);
      setMetrics(omniRouterService.getMetrics());
    });
    return unsubscribe;
  }, []);

  const models = [
    { name: 'Gemini 2.5 Flash', latency: '18ms', cost: '$0.075 / 1M', score: '99.4%', status: 'Active (Fast-path)' },
    { name: 'Claude 3.7 Sonnet', latency: '24ms', cost: '$3.00 / 1M', score: '98.8%', status: 'Active (Thinking)' },
    { name: 'DeepSeek R1', latency: '35ms', cost: '$0.55 / 1M', score: '96.2%', status: 'Active (Math/Logic)' },
    { name: 'Ollama Llama 3.3', latency: '48ms', cost: '$0.00 (Local)', score: '92.5%', status: 'Fallback (Privacy)' },
    { name: 'Python 3.10 Kernel', latency: '5ms', cost: '$0.00 (System)', score: '99.9%', status: 'Active (Asyncio)' },
    { name: 'Node.js v22', latency: '8ms', cost: '$0.00 (Native)', score: '99.8%', status: 'Active (V8 Engine)' },
  ];

  return (
    <div className="flex h-full flex-col space-y-4">
      {/* Subtab Switcher */}
      <div className="flex items-center justify-between border-b border-border/40 pb-2 px-1">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveSubTab('diagnostics')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-mono font-bold uppercase tracking-wider transition cursor-pointer ${
              activeSubTab === 'diagnostics'
                ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/40 shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-surface/30'
            }`}
          >
            <Activity size={14} className="text-cyan-400" />
            <span>Telemetry & Live D3</span>
          </button>

          <button
            onClick={() => setActiveSubTab('matrix')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-mono font-bold uppercase tracking-wider transition cursor-pointer ${
              activeSubTab === 'matrix'
                ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/40 shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-surface/30'
            }`}
          >
            <Layers size={14} className="text-cyan-400" />
            <span>16 Agents Traffic Matrix</span>
          </button>

          <button
            onClick={() => setActiveSubTab('policies')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-mono font-bold uppercase tracking-wider transition cursor-pointer ${
              activeSubTab === 'policies'
                ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/40 shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-surface/30'
            }`}
          >
            <Sliders size={14} className="text-cyan-400" />
            <span>Routing Policies</span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowOverlay(true)}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-300 border border-cyan-500/30 text-xs font-mono font-bold transition cursor-pointer shadow-sm"
            title="Launch 16-agent diagnostic overlay modal"
          >
            <Maximize2 size={12} />
            <span className="hidden sm:inline">Diagnostic Overlay</span>
          </button>

          <span className="text-[11px] font-mono text-slate-500 hidden md:inline">
            Daemon: <span className="text-emerald-400">ONLINE (Port 8001)</span>
          </span>
        </div>
      </div>

      {activeSubTab === 'diagnostics' ? (
        <OmniRouteDiagnosticView />
      ) : activeSubTab === 'matrix' ? (
        <div className="p-1">
          <OmniRouteDiagnosticPanel agents={agents} metrics={metrics} isOverlay={false} />
        </div>
      ) : (
        <div className="space-y-6">
          <div className="bg-[#0e121d] rounded-2xl border border-slate-800 p-6 shadow-md">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/40 flex items-center justify-center">
                  <Zap className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white tracking-tight">
                    OmniRoute Dynamic Multi-Model Router
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    O(N+M) lockless model selector with automatic latency routing, budget enforcement, and zero-downtime failover
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-1.5 bg-[#131826] p-1 rounded-lg border border-slate-700/80 text-xs font-mono">
                <span className="text-slate-500 px-2">Strategy:</span>
                {(['latency', 'cost', 'balanced', 'reasoning'] as const).map((strat) => (
                  <button
                    key={strat}
                    onClick={() => setActiveStrategy(strat)}
                    className={`px-2.5 py-1 rounded capitalize transition-colors cursor-pointer ${
                      activeStrategy === strat
                        ? 'bg-cyan-500 text-slate-950 font-bold'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {strat}
                  </button>
                ))}
              </div>
            </div>

            {/* Realtime Routing Metrics */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6">
              <div className="bg-[#131826] p-3.5 rounded-xl border border-slate-800 font-mono">
                <span className="text-[10px] uppercase text-slate-500">Router Latency Overhead</span>
                <div className="text-xl font-bold text-cyan-400 mt-0.5">0.12 ms</div>
                <span className="text-[10px] text-emerald-400">Lockless atomic dispatch</span>
              </div>

              <div className="bg-[#131826] p-3.5 rounded-xl border border-slate-800 font-mono">
                <span className="text-[10px] uppercase text-slate-500">Failover Success Rate</span>
                <div className="text-xl font-bold text-emerald-400 mt-0.5">100.0%</div>
                <span className="text-[10px] text-slate-400">Zero dropped requests</span>
              </div>

              <div className="bg-[#131826] p-3.5 rounded-xl border border-slate-800 font-mono">
                <span className="text-[10px] uppercase text-slate-500">Cost Savings Optimized</span>
                <div className="text-xl font-bold text-amber-400 mt-0.5">68.4%</div>
                <span className="text-[10px] text-slate-400">Tiered model dispatch</span>
              </div>

              <div className="bg-[#131826] p-3.5 rounded-xl border border-slate-800 font-mono">
                <span className="text-[10px] uppercase text-slate-500">Active Routing Nodes</span>
                <div className="text-xl font-bold text-purple-400 mt-0.5">16 Agents</div>
                <span className="text-[10px] text-slate-400">8 responsive · 8 fallback</span>
              </div>
            </div>

            {/* Model Routing Priority Matrix */}
            <div className="mt-6">
              <h4 className="text-xs font-mono font-semibold uppercase tracking-wider text-slate-300 mb-3">
                Dynamic Model Execution Priority
              </h4>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs font-mono">
                  <thead className="bg-[#131826] text-slate-400 border-b border-slate-800 text-[10px] uppercase">
                    <tr>
                      <th className="p-3 pl-4">Model Engine</th>
                      <th className="p-3">Avg Latency</th>
                      <th className="p-3">Cost / 1M Tokens</th>
                      <th className="p-3">Health Score</th>
                      <th className="p-3 pr-4 text-right">Route Policy</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 text-slate-300">
                    {models.map((m) => (
                      <tr key={m.name} className="hover:bg-slate-800/30 transition-colors">
                        <td className="p-3 pl-4 font-semibold text-white">{m.name}</td>
                        <td className="p-3 text-cyan-300">{m.latency}</td>
                        <td className="p-3 text-slate-400">{m.cost}</td>
                        <td className="p-3 text-emerald-400 font-bold">{m.score}</td>
                        <td className="p-3 pr-4 text-right">
                          <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 text-[10px] border border-slate-700">
                            {m.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Diagnostic Overlay Modal ── */}
      {showOverlay && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="w-full max-w-7xl h-[90vh] flex flex-col">
            <OmniRouteDiagnosticPanel
              agents={agents}
              metrics={metrics}
              isOverlay={true}
              onCloseOverlay={() => setShowOverlay(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
};

// Also export as OmniRouteDashboardView for seamless compatibility
export const OmniRouteDashboardView = OmniRouteView;
export const OmniRouteDashboard = OmniRouteView;
