import React from 'react';
import {
  Compass,
  Terminal,
  CheckCircle2,
  HardDrive,
  Cpu,
  RefreshCw,
  Server,
  Code2
} from 'lucide-react';
import { BrainRecord } from '../../types/missionControl';

interface DiscoveryDashboardViewProps {
  brains: BrainRecord[];
  onRescan: () => Promise<void>;
  isRescanning: boolean;
}

export const DiscoveryDashboardView: React.FC<DiscoveryDashboardViewProps> = ({
  brains,
  onRescan,
  isRescanning,
}) => {
  const localBrains = brains.filter((b) => b.brain_type === 'local_cli' || b.brain_type === 'orchestrator' || b.vendor === 'custom');

  return (
    <div className="space-y-6">
      <div className="bg-[#0e121d] rounded-2xl border border-slate-800 p-6 shadow-md">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center justify-center">
              <Compass className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white tracking-tight">
                Local Environment & Brain Runtime Discovery
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Automated non-blocking probe for host CLIs, binary runtimes, MCP servers, and language compilers
              </p>
            </div>
          </div>

          <button
            onClick={() => onRescan()}
            disabled={isRescanning}
            className="flex items-center space-x-1.5 px-3.5 py-2 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 rounded-lg text-xs font-mono font-semibold transition-all cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRescanning ? 'animate-spin' : ''}`} />
            <span>{isRescanning ? 'Probing...' : 'Rescan Environment'}</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
          {localBrains.map((b) => (
            <div
              key={b.id}
              className="bg-[#131826] border border-slate-800 rounded-xl p-4 flex flex-col justify-between hover:border-slate-700 transition-colors font-mono"
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-2">
                    <Terminal className="w-4 h-4 text-emerald-400" />
                    <h4 className="text-sm font-semibold text-white">{b.display_name}</h4>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[10px] bg-emerald-950 text-emerald-400 border border-emerald-800 font-bold">
                    VALIDATED
                  </span>
                </div>

                <div className="space-y-1.5 text-xs text-slate-400">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Version:</span>
                    <span className="text-slate-200">v{b.version}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Runtime:</span>
                    <span className="text-cyan-300">{b.runtime}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Executable:</span>
                    <span className="text-slate-300 truncate max-w-[150px]">{b.metadata?.executable || '/usr/bin'}</span>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-800">
                  <span className="text-[10px] text-slate-500 uppercase tracking-wider block mb-1.5">
                    Discovered Tools:
                  </span>
                  <div className="flex flex-wrap gap-1">
                    {b.supported_tools.map((tool) => (
                      <span
                        key={tool}
                        className="px-1.5 py-0.5 bg-slate-800 text-slate-300 text-[10px] rounded"
                      >
                        {tool}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-800 text-[10px] text-slate-500 flex justify-between">
                <span>Binding: Active</span>
                <span className="text-emerald-400">Isolated Container</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
