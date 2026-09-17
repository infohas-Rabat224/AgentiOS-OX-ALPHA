import React from 'react';
import {
  X,
  Brain,
  Cpu,
  HardDrive,
  Activity,
  Terminal,
  Server,
  Zap,
  CheckCircle2,
  AlertCircle,
  Copy,
  ExternalLink,
  ShieldAlert
} from 'lucide-react';
import { BrainRecord } from '../../types/missionControl';
import { getVendorColor, brainStatusToColor, VENDOR_NAMES } from '../../lib/brainsData';

interface BrainDetailModalProps {
  brain: BrainRecord | null;
  onClose: () => void;
  onPing?: (id: string) => void;
}

export const BrainDetailModal: React.FC<BrainDetailModalProps> = ({
  brain,
  onClose,
  onPing,
}) => {
  if (!brain) return null;

  const vendorColor = getVendorColor(brain.vendor || brain.runtime);
  const statusColor = brainStatusToColor(brain.status);

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-[#0e121d] border border-slate-700/80 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Top Header with ambient vendor color strip */}
        <div className="relative p-6 border-b border-slate-800 bg-[#131826]">
          <div
            className="absolute top-0 left-0 right-0 h-[3px]"
            style={{ backgroundColor: vendorColor }}
          />
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center space-x-3">
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center font-mono font-bold text-lg shadow-inner shrink-0"
                style={{
                  backgroundColor: `${vendorColor}20`,
                  border: `1px solid ${vendorColor}60`,
                  color: vendorColor,
                }}
              >
                {brain.display_name.charAt(0).toUpperCase()}
              </div>

              <div>
                <div className="flex items-center space-x-2">
                  <h3 className="text-lg font-bold text-white tracking-tight">
                    {brain.display_name}
                  </h3>
                  <span className="px-2 py-0.5 rounded text-xs font-mono font-medium bg-slate-800 text-slate-300 border border-slate-700">
                    v{brain.version}
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-1 font-mono">
                  ID: <span className="text-slate-300">{brain.id}</span> • Vendor:{' '}
                  <span className="text-cyan-400">{VENDOR_NAMES[brain.vendor] || brain.vendor}</span>
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg bg-slate-800/80 hover:bg-slate-700 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Status and Telemetry Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mt-5">
            <div className="bg-slate-900/80 p-2.5 rounded-lg border border-slate-800/80">
              <span className="text-[10px] uppercase tracking-wider text-slate-500 font-mono">Status</span>
              <div className="text-xs font-mono font-semibold mt-0.5 flex items-center" style={{ color: statusColor }}>
                <span className="w-2 h-2 rounded-full mr-1.5 animate-pulse" style={{ backgroundColor: statusColor }} />
                {brain.status.toUpperCase()}
              </div>
            </div>

            <div className="bg-slate-900/80 p-2.5 rounded-lg border border-slate-800/80">
              <span className="text-[10px] uppercase tracking-wider text-slate-500 font-mono">Latency</span>
              <div className="text-xs font-mono font-semibold text-slate-200 mt-0.5">
                {brain.latency || 5} ms
              </div>
            </div>

            <div className="bg-slate-900/80 p-2.5 rounded-lg border border-slate-800/80">
              <span className="text-[10px] uppercase tracking-wider text-slate-500 font-mono">Throughput</span>
              <div className="text-xs font-mono font-semibold text-slate-200 mt-0.5">
                {brain.throughput || 120} req/s
              </div>
            </div>

            <div className="bg-slate-900/80 p-2.5 rounded-lg border border-slate-800/80">
              <span className="text-[10px] uppercase tracking-wider text-slate-500 font-mono">Context Window</span>
              <div className="text-xs font-mono font-semibold text-cyan-300 mt-0.5">
                {brain.available_context ? `${(brain.available_context / 1000).toFixed(0)}k tokens` : '128k tokens'}
              </div>
            </div>
          </div>
        </div>

        {/* Scrollable Body */}
        <div className="p-6 overflow-y-auto space-y-6 text-xs text-slate-300 flex-1">
          {/* Capabilities */}
          <div>
            <h4 className="font-mono font-semibold text-slate-200 uppercase tracking-wider text-[11px] mb-2.5 flex items-center">
              <Zap className="w-3.5 h-3.5 mr-1.5 text-cyan-400" />
              Registered Capabilities
            </h4>
            <div className="flex flex-wrap gap-1.5">
              {brain.capabilities.map((cap) => (
                <span
                  key={cap}
                  className="px-2 py-1 rounded-md bg-cyan-950/40 text-cyan-300 border border-cyan-800/40 font-mono text-[11px]"
                >
                  {cap}
                </span>
              ))}
            </div>
          </div>

          {/* Supported Tools and Models */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-slate-900/60 p-3.5 rounded-xl border border-slate-800">
              <h4 className="font-mono font-semibold text-slate-200 text-[11px] uppercase tracking-wider mb-2 flex items-center">
                <Terminal className="w-3.5 h-3.5 mr-1.5 text-emerald-400" />
                Supported Tools ({brain.supported_tools?.length || 0})
              </h4>
              <div className="space-y-1">
                {brain.supported_tools && brain.supported_tools.length > 0 ? (
                  brain.supported_tools.map((t) => (
                    <div key={t} className="font-mono text-slate-300 bg-slate-800/40 px-2 py-1 rounded text-[11px]">
                      $ {t}
                    </div>
                  ))
                ) : (
                  <span className="text-slate-500 italic">No external tools declared</span>
                )}
              </div>
            </div>

            <div className="bg-slate-900/60 p-3.5 rounded-xl border border-slate-800">
              <h4 className="font-mono font-semibold text-slate-200 text-[11px] uppercase tracking-wider mb-2 flex items-center">
                <Cpu className="w-3.5 h-3.5 mr-1.5 text-purple-400" />
                Underlying Models ({brain.supported_models?.length || 0})
              </h4>
              <div className="space-y-1">
                {brain.supported_models && brain.supported_models.length > 0 ? (
                  brain.supported_models.map((m) => (
                    <div key={m} className="font-mono text-slate-300 bg-slate-800/40 px-2 py-1 rounded text-[11px]">
                      {m}
                    </div>
                  ))
                ) : (
                  <span className="text-slate-500 italic">Direct native execution</span>
                )}
              </div>
            </div>
          </div>

          {/* Workspace and Environment */}
          <div className="bg-slate-900/60 p-3.5 rounded-xl border border-slate-800">
            <h4 className="font-mono font-semibold text-slate-200 text-[11px] uppercase tracking-wider mb-2 flex items-center">
              <Server className="w-3.5 h-3.5 mr-1.5 text-amber-400" />
              Runtime Environment & Binding
            </h4>
            <div className="grid grid-cols-2 gap-3 text-[11px] font-mono">
              <div>
                <span className="text-slate-500">Workspace Path:</span>
                <p className="text-slate-300 truncate mt-0.5">{brain.workspace || '/app/applet'}</p>
              </div>
              <div>
                <span className="text-slate-500">Connection State:</span>
                <p className="text-emerald-400 mt-0.5 capitalize">{brain.connection_state}</p>
              </div>
              <div>
                <span className="text-slate-500">Discovered At:</span>
                <p className="text-slate-300 mt-0.5">{new Date(brain.discovered_at).toLocaleString()}</p>
              </div>
              <div>
                <span className="text-slate-500">Total Executed Sessions:</span>
                <p className="text-cyan-300 mt-0.5 font-bold">{brain.session_count || 0}</p>
              </div>
            </div>
          </div>

          {/* Raw Metadata JSON */}
          <div>
            <h4 className="font-mono font-semibold text-slate-400 text-[11px] uppercase tracking-wider mb-1.5">
              Raw Metadata Inspection
            </h4>
            <pre className="bg-[#080a10] text-emerald-400 p-3 rounded-lg border border-slate-800 font-mono text-[10px] overflow-x-auto">
              {JSON.stringify(brain, null, 2)}
            </pre>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-slate-800 bg-[#131826] flex items-center justify-between">
          <span className="text-[11px] font-mono text-slate-500">
            AgenticOS Brain Control Plane
          </span>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => onPing && onPing(brain.id)}
              className="px-3 py-1.5 rounded-lg text-xs font-mono font-medium text-slate-200 bg-slate-800 hover:bg-slate-700 transition-colors cursor-pointer"
            >
              Ping Heartbeat
            </button>
            <button
              onClick={onClose}
              className="px-4 py-1.5 rounded-lg text-xs font-medium text-slate-900 bg-cyan-400 hover:bg-cyan-300 font-semibold transition-colors cursor-pointer"
            >
              Close Inspector
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
