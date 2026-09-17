import React, { useState } from 'react';
import { Sparkles, RefreshCw, CheckCircle2, AlertTriangle, Play, Zap, Shield, Cpu, Activity } from 'lucide-react';
import { BrainRecord } from '../../types/missionControl';

interface EcosystemDashboardViewProps {
  brains?: BrainRecord[];
}

export const EcosystemDashboardView: React.FC<EcosystemDashboardViewProps> = ({ brains = [] }) => {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [runningAction, setRunningAction] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => setIsRefreshing(false), 800);
  };

  const handleRunAction = (actionName: string) => {
    setRunningAction(actionName);
    setTimeout(() => {
      setRunningAction(null);
      setActionSuccess(actionName);
      setTimeout(() => setActionSuccess(null), 3000);
    }, 1200);
  };

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-background text-text p-4 space-y-4">
      {/* ── Top Metric Stats Row ── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="bg-[#111625] px-4 py-2.5 rounded-xl border border-slate-800 min-w-[110px]">
            <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold font-mono">
              RUNTIMES
            </div>
            <div className="text-xl font-bold text-white font-mono mt-0.5">16</div>
          </div>

          <div className="bg-[#111625] px-4 py-2.5 rounded-xl border border-slate-800 min-w-[110px]">
            <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold font-mono">
              HEALTHY
            </div>
            <div className="text-xl font-bold text-emerald-400 font-mono mt-0.5">8</div>
          </div>

          <div className="bg-[#111625] px-4 py-2.5 rounded-xl border border-slate-800 min-w-[110px]">
            <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold font-mono">
              CAPABILITIES
            </div>
            <div className="text-xl font-bold text-white font-mono mt-0.5">28</div>
          </div>

          <div className="bg-[#111625] px-4 py-2.5 rounded-xl border border-slate-800 min-w-[110px]">
            <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold font-mono">
              COLLABORATIONS
            </div>
            <div className="text-xl font-bold text-white font-mono mt-0.5">0</div>
          </div>

          <div className="bg-[#111625] px-4 py-2.5 rounded-xl border border-slate-800 min-w-[110px]">
            <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold font-mono">
              EVOLUTIONS
            </div>
            <div className="text-xl font-bold text-white font-mono mt-0.5">0</div>
          </div>

          <div className="bg-[#111625] px-4 py-2.5 rounded-xl border border-slate-800 min-w-[110px]">
            <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold font-mono">
              AVG TRUST
            </div>
            <div className="text-xl font-bold text-white font-mono mt-0.5">0%</div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            LIVE
          </span>
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-surface/30 px-3 py-1.5 text-xs text-slate-300 hover:text-white hover:bg-surface/50 transition cursor-pointer disabled:opacity-50"
          >
            <RefreshCw size={13} className={isRefreshing ? 'animate-spin' : ''} />
            {isRefreshing ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
      </div>

      {/* ── Middle Two Panels (Screenshot 1 Layout) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Left: Ecosystem Health */}
        <div className="rounded-xl border border-slate-800/80 bg-[#0c101d] p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-bold text-white tracking-tight">Ecosystem Health</h3>
                <span className="text-[11px] text-amber-400 font-semibold">degraded</span>
              </div>
            </div>

            <div className="space-y-4 font-mono text-xs">
              <div>
                <div className="flex justify-between items-center text-slate-400 text-[11px] mb-1">
                  <span>Overall Health Score</span>
                  <span className="text-amber-400 font-bold">52.5%</span>
                </div>
                <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-amber-400 via-orange-500 to-rose-500 rounded-full"
                    style={{ width: '52.5%' }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-x-6 gap-y-3 pt-2 text-[11px]">
                <div>
                  <div className="flex justify-between text-slate-400 mb-1">
                    <span>Availability</span>
                    <span className="text-white">50%</span>
                  </div>
                  <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                    <div className="h-full bg-indigo-500 w-[50%]" />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-slate-400 mb-1">
                    <span>Performance</span>
                    <span className="text-white">100%</span>
                  </div>
                  <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                    <div className="h-full bg-indigo-500 w-[100%]" />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-slate-400 mb-1">
                    <span>Collaboration</span>
                    <span className="text-white">50%</span>
                  </div>
                  <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                    <div className="h-full bg-indigo-500 w-[50%]" />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-slate-400 mb-1">
                    <span>Evolution</span>
                    <span className="text-white">0%</span>
                  </div>
                  <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                    <div className="h-full bg-indigo-500 w-[0%]" />
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-800/80">
                <div className="text-rose-400 font-semibold text-xs mb-1">Issues</div>
                <div className="text-slate-400 text-[11px]">• 8 runtime(s) unhealthy</div>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Runtime Distribution */}
        <div className="rounded-xl border border-slate-800/80 bg-[#0c101d] p-5 flex flex-col justify-between">
          <div>
            <div className="mb-4">
              <h3 className="text-sm font-bold text-white tracking-tight">Runtime Distribution</h3>
              <span className="text-[11px] text-slate-500">Health breakdown</span>
            </div>

            <div className="space-y-3 font-mono text-xs">
              <div>
                <div className="flex justify-between text-slate-400 text-[11px] mb-1">
                  <span>Healthy</span>
                  <span className="text-emerald-400 font-bold">8 / 16</span>
                </div>
                <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-400 w-[50%] rounded-full" />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-slate-400 text-[11px] mb-1">
                  <span>Degraded</span>
                  <span className="text-amber-400">0 / 16</span>
                </div>
                <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
                  <div className="h-full bg-amber-400 w-[0%] rounded-full" />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-slate-400 text-[11px] mb-1">
                  <span>Unhealthy</span>
                  <span className="text-rose-400 font-bold">8 / 16</span>
                </div>
                <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
                  <div className="h-full bg-rose-500 w-[50%] rounded-full" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-3">
                <div className="bg-[#111625] p-3 rounded-lg border border-slate-800">
                  <div className="text-[10px] text-slate-500">Avg Health</div>
                  <div className="text-sm font-bold text-white mt-0.5">50.5</div>
                </div>

                <div className="bg-[#111625] p-3 rounded-lg border border-slate-800">
                  <div className="text-[10px] text-slate-500">Avg Latency</div>
                  <div className="text-sm font-bold text-white mt-0.5">0ms</div>
                </div>

                <div className="bg-[#111625] p-3 rounded-lg border border-slate-800">
                  <div className="text-[10px] text-slate-500">Active Swarms</div>
                  <div className="text-sm font-bold text-white mt-0.5">1</div>
                </div>

                <div className="bg-[#111625] p-3 rounded-lg border border-slate-800">
                  <div className="text-[10px] text-slate-500">Completed Missions</div>
                  <div className="text-sm font-bold text-white mt-0.5">0</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Bottom Panel: Ecosystem Actions (Screenshot 1 Layout) ── */}
      <div className="rounded-xl border border-slate-800/80 bg-[#0c101d] p-5">
        <div className="mb-4">
          <h3 className="text-sm font-bold text-white tracking-tight">Ecosystem Actions</h3>
          <span className="text-[11px] text-slate-500">Self-optimization controls</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 font-mono">
          {/* Action 1 */}
          <div className="bg-[#111625] p-3.5 rounded-xl border border-slate-800 flex flex-col justify-between space-y-3">
            <div>
              <div className="text-xs font-bold text-white">Analyze</div>
              <div className="text-[10px] text-slate-500 mt-0.5">Run evolution analyzers</div>
            </div>
            <button
              onClick={() => handleRunAction('analyze')}
              disabled={runningAction === 'analyze'}
              className="w-full py-1.5 rounded-lg bg-[#1a233d] hover:bg-[#232f52] text-indigo-200 text-xs font-semibold transition cursor-pointer disabled:opacity-50"
            >
              {runningAction === 'analyze' ? 'Running...' : actionSuccess === 'analyze' ? 'Completed' : 'Run'}
            </button>
          </div>

          {/* Action 2 */}
          <div className="bg-[#111625] p-3.5 rounded-xl border border-slate-800 flex flex-col justify-between space-y-3">
            <div>
              <div className="text-xs font-bold text-white">Optimize</div>
              <div className="text-[10px] text-slate-500 mt-0.5">Continuous self-optimization</div>
            </div>
            <button
              onClick={() => handleRunAction('optimize')}
              disabled={runningAction === 'optimize'}
              className="w-full py-1.5 rounded-lg bg-[#1a233d] hover:bg-[#232f52] text-indigo-200 text-xs font-semibold transition cursor-pointer disabled:opacity-50"
            >
              {runningAction === 'optimize' ? 'Running...' : actionSuccess === 'optimize' ? 'Completed' : 'Run'}
            </button>
          </div>

          {/* Action 3 */}
          <div className="bg-[#111625] p-3.5 rounded-xl border border-slate-800 flex flex-col justify-between space-y-3">
            <div>
              <div className="text-xs font-bold text-white">Evolve</div>
              <div className="text-[10px] text-slate-500 mt-0.5">Force evolution cycle</div>
            </div>
            <button
              onClick={() => handleRunAction('evolve')}
              disabled={runningAction === 'evolve'}
              className="w-full py-1.5 rounded-lg bg-[#1a233d] hover:bg-[#232f52] text-indigo-200 text-xs font-semibold transition cursor-pointer disabled:opacity-50"
            >
              {runningAction === 'evolve' ? 'Running...' : actionSuccess === 'evolve' ? 'Completed' : 'Run'}
            </button>
          </div>

          {/* Action 4 */}
          <div className="bg-[#111625] p-3.5 rounded-xl border border-slate-800 flex flex-col justify-between space-y-3">
            <div>
              <div className="text-xs font-bold text-white">Rebuild</div>
              <div className="text-[10px] text-slate-500 mt-0.5">Rebuild graph from registry</div>
            </div>
            <button
              onClick={() => handleRunAction('rebuild')}
              disabled={runningAction === 'rebuild'}
              className="w-full py-1.5 rounded-lg bg-[#1a233d] hover:bg-[#232f52] text-indigo-200 text-xs font-semibold transition cursor-pointer disabled:opacity-50"
            >
              {runningAction === 'rebuild' ? 'Running...' : actionSuccess === 'rebuild' ? 'Completed' : 'Run'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
