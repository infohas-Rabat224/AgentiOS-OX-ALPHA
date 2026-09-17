import React from 'react';
import {
  Brain,
  Cpu,
  Zap,
  Activity,
  Server,
  Layers,
  CheckCircle2,
  HardDrive,
  Clock,
  Sparkles,
  ExternalLink,
  RefreshCw
} from 'lucide-react';
import { BrainRecord } from '../../types/missionControl';
import { getVendorColor, brainStatusToColor, VENDOR_NAMES } from '../../lib/brainsData';

interface BrainCardProps {
  brain: BrainRecord;
  isSelected?: boolean;
  onSelect: (brain: BrainRecord) => void;
  onRefresh?: (brain: BrainRecord) => void;
}

export const BrainCard: React.FC<BrainCardProps> = ({
  brain,
  isSelected,
  onSelect,
  onRefresh,
}) => {
  const vendorColor = getVendorColor(brain.vendor || brain.runtime);
  const statusColor = brainStatusToColor(brain.status);
  const isHealthy = brain.health === 'healthy' || brain.health === 1.0;

  return (
    <div
      onClick={() => onSelect(brain)}
      className={`group relative rounded-xl border p-4 transition-all duration-200 cursor-pointer overflow-hidden ${
        isSelected
          ? 'bg-slate-900/95 border-cyan-400/80 shadow-lg shadow-cyan-500/10 ring-1 ring-cyan-400'
          : 'bg-[#10141f]/90 hover:bg-[#151a29] border-slate-800 hover:border-slate-700 shadow-md'
      }`}
    >
      {/* Top ambient glow accent based on vendor */}
      <div
        className="absolute top-0 left-0 right-0 h-[2px] opacity-80 group-hover:opacity-100 transition-opacity"
        style={{
          background: `linear-gradient(90deg, transparent, ${vendorColor}, transparent)`,
        }}
      />

      {/* Card Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center space-x-3">
          {/* Vendor Avatar */}
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center font-mono font-bold text-sm shadow-inner shrink-0"
            style={{
              backgroundColor: `${vendorColor}18`,
              border: `1px solid ${vendorColor}50`,
              color: vendorColor,
            }}
          >
            {brain.display_name.charAt(0).toUpperCase()}
          </div>

          <div>
            <div className="flex items-center space-x-2">
              <h4 className="text-sm font-semibold text-slate-100 group-hover:text-cyan-300 transition-colors truncate max-w-[170px]">
                {brain.display_name}
              </h4>
              <span className="text-[10px] font-mono text-slate-400 px-1.5 py-0.5 rounded bg-slate-800/80 border border-slate-700/60">
                v{brain.version}
              </span>
            </div>
            <p className="text-[11px] text-slate-400 flex items-center space-x-1.5 mt-0.5">
              <span>{VENDOR_NAMES[brain.vendor] || brain.vendor}</span>
              <span>•</span>
              <span className="capitalize text-slate-300">{brain.brain_type.replace('_', ' ')}</span>
            </p>
          </div>
        </div>

        {/* Status Indicator Pill */}
        <div className="flex flex-col items-end">
          <span
            className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold"
            style={{
              backgroundColor: `${statusColor}18`,
              color: statusColor,
              border: `1px solid ${statusColor}40`,
            }}
          >
            <span
              className="w-1.5 h-1.5 rounded-full mr-1.5 animate-pulse"
              style={{ backgroundColor: statusColor }}
            />
            {brain.status.toUpperCase()}
          </span>
          <span className="text-[9px] text-slate-500 font-mono mt-1">
            {brain.latency ? `${brain.latency}ms latency` : 'ready'}
          </span>
        </div>
      </div>

      {/* Metrics Row: Memory & CPU */}
      <div className="grid grid-cols-2 gap-2 mt-4 pt-3 border-t border-slate-800/80 text-[11px]">
        <div className="bg-slate-900/60 rounded-md p-2 border border-slate-800/60">
          <div className="flex justify-between items-center text-slate-400 text-[10px] mb-1">
            <span className="flex items-center">
              <HardDrive className="w-3 h-3 mr-1 text-slate-400" />
              Memory
            </span>
            <span className="font-mono text-slate-200">{brain.memory_usage ? `${brain.memory_usage.toFixed(1)} MB` : '32 MB'}</span>
          </div>
          <div className="w-full bg-slate-800 h-1 rounded-full overflow-hidden">
            <div
              className="bg-cyan-400 h-full rounded-full transition-all duration-500"
              style={{ width: `${Math.min(100, ((brain.memory_usage || 32) / 300) * 100)}%` }}
            />
          </div>
        </div>

        <div className="bg-slate-900/60 rounded-md p-2 border border-slate-800/60">
          <div className="flex justify-between items-center text-slate-400 text-[10px] mb-1">
            <span className="flex items-center">
              <Cpu className="w-3 h-3 mr-1 text-slate-400" />
              CPU Load
            </span>
            <span className="font-mono text-slate-200">{brain.cpu_usage ? `${brain.cpu_usage.toFixed(1)}%` : '0.8%'}</span>
          </div>
          <div className="w-full bg-slate-800 h-1 rounded-full overflow-hidden">
            <div
              className="bg-emerald-400 h-full rounded-full transition-all duration-500"
              style={{ width: `${Math.min(100, ((brain.cpu_usage || 0.8) / 10) * 100)}%` }}
            />
          </div>
        </div>
      </div>

      {/* Capabilities Tags */}
      <div className="mt-3 flex flex-wrap gap-1">
        {brain.capabilities.slice(0, 4).map((cap) => (
          <span
            key={cap}
            className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-slate-800/60 text-slate-300 border border-slate-700/40"
          >
            {cap.replace(/_/g, ' ')}
          </span>
        ))}
        {brain.capabilities.length > 4 && (
          <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-cyan-950/40 text-cyan-400 border border-cyan-800/30">
            +{brain.capabilities.length - 4}
          </span>
        )}
      </div>

      {/* Footer Details */}
      <div className="mt-3 pt-2.5 border-t border-slate-800/60 flex items-center justify-between text-[10px] text-slate-400 font-mono">
        <span className="flex items-center text-slate-400">
          <Clock className="w-3 h-3 mr-1 text-slate-500" />
          Uptime: {Math.floor((brain.uptime || 3600) / 60)}m
        </span>

        <div className="flex items-center space-x-2">
          {brain.available_context > 0 && (
            <span className="text-cyan-400 font-mono">
              {(brain.available_context / 1000).toFixed(0)}k ctx
            </span>
          )}
          <span className="text-slate-500 hover:text-cyan-300 transition-colors">
            Inspect →
          </span>
        </div>
      </div>
    </div>
  );
};
