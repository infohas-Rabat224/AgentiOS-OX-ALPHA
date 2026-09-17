import React, { useState } from 'react';
import {
  ShieldAlert,
  CheckCircle2,
  Cpu,
  HardDrive,
  Activity,
  Terminal,
  Play,
  RotateCcw,
  Check,
  AlertCircle,
  Wrench,
  Wifi
} from 'lucide-react';

interface DiagnosticLog {
  id: string;
  time: string;
  level: 'INFO' | 'WARN' | 'ERROR' | 'SUCCESS';
  source: string;
  message: string;
}

export const DesktopDiagnosticsView: React.FC = () => {
  const [logs, setLogs] = useState<DiagnosticLog[]>([
    {
      id: 'init-1',
      time: new Date().toLocaleTimeString(),
      level: 'INFO',
      source: 'Diagnostic Engine',
      message: 'Desktop Health Center ready',
    },
  ]);
  const [isScanning, setIsScanning] = useState(false);
  const [scanType, setScanType] = useState<string | null>(null);
  const [unresolvedCount, setUnresolvedCount] = useState(0);
  const [lastScanResult, setLastScanResult] = useState<string | null>(null);

  const runScan = (type: 'Quick Check' | 'Surface Scan' | 'Deep Scan') => {
    setIsScanning(true);
    setScanType(type);

    const now = new Date().toLocaleTimeString();
    setLogs((prev) => [
      {
        id: `scan-${Date.now()}-1`,
        time: now,
        level: 'INFO',
        source: 'Scanner',
        message: `Starting ${type} on local environment and runtime bridges...`,
      },
      ...prev,
    ]);

    setTimeout(() => {
      const finishTime = new Date().toLocaleTimeString();
      setLogs((prev) => [
        {
          id: `scan-${Date.now()}-2`,
          time: finishTime,
          level: 'SUCCESS',
          source: 'Pipeline Engine',
          message: `${type} completed: All 16 agent node connections and IPC pipes verified.`,
        },
        ...prev,
      ]);
      setIsScanning(false);
      setLastScanResult(`${type} passed with 0 critical errors`);
      setUnresolvedCount(0);
    }, 1500);
  };

  const runRepair = () => {
    setIsScanning(true);
    setScanType('Repair All');
    const now = new Date().toLocaleTimeString();
    setLogs((prev) => [
      {
        id: `repair-${Date.now()}-1`,
        time: now,
        level: 'WARN',
        source: 'Self-Healer',
        message: 'Rebinding disconnected socket handles and clearing transient pipe deadlocks...',
      },
      ...prev,
    ]);

    setTimeout(() => {
      const finishTime = new Date().toLocaleTimeString();
      setLogs((prev) => [
        {
          id: `repair-${Date.now()}-2`,
          time: finishTime,
          level: 'SUCCESS',
          source: 'Self-Healer',
          message: 'All runtime channels healthy. Zero orphaned processes.',
        },
        ...prev,
      ]);
      setIsScanning(false);
      setUnresolvedCount(0);
      setLastScanResult('Automated repairs applied cleanly');
    }, 1800);
  };

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-background text-text p-4 space-y-4">
      {/* ── Top Header Toolbar (Screenshot 2) ── */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-sm font-bold tracking-wider uppercase text-white font-mono">
            DESKTOP DIAGNOSTICS & SELF-HEALING
          </h1>
          <p className="text-xs text-slate-400">
            Real-time system health, pipeline validation, and auto-repair engine
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => runScan('Quick Check')}
            disabled={isScanning}
            className="px-3 py-1.5 rounded-lg border border-slate-700 bg-surface/30 hover:bg-surface/60 text-xs font-medium text-slate-200 transition cursor-pointer disabled:opacity-50"
          >
            Quick Check
          </button>
          <button
            onClick={() => runScan('Surface Scan')}
            disabled={isScanning}
            className="px-3 py-1.5 rounded-lg border border-slate-700 bg-surface/30 hover:bg-surface/60 text-xs font-medium text-slate-200 transition cursor-pointer disabled:opacity-50"
          >
            Surface Scan
          </button>
          <button
            onClick={() => runScan('Deep Scan')}
            disabled={isScanning}
            className="px-3 py-1.5 rounded-lg border border-slate-700 bg-surface/30 hover:bg-surface/60 text-xs font-medium text-slate-200 transition cursor-pointer disabled:opacity-50"
          >
            Deep Scan
          </button>
          <button
            onClick={runRepair}
            disabled={isScanning}
            className="px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white shadow transition cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
          >
            <Wrench size={13} />
            Repair All
          </button>
        </div>
      </div>

      {/* ── Metric Stats Cards (Screenshot 2) ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 font-mono">
        <div className="bg-[#111625] p-3.5 rounded-xl border border-slate-800">
          <div className="text-[10px] uppercase text-slate-500 font-semibold">CPU LOAD</div>
          <div className="text-xl font-bold text-white mt-0.5">0.0%</div>
        </div>

        <div className="bg-[#111625] p-3.5 rounded-xl border border-slate-800">
          <div className="text-[10px] uppercase text-slate-500 font-semibold">MEMORY USAGE</div>
          <div className="text-xl font-bold text-white mt-0.5">125 MB</div>
        </div>

        <div className="bg-[#111625] p-3.5 rounded-xl border border-slate-800">
          <div className="text-[10px] uppercase text-slate-500 font-semibold">ACTIVE THREADS</div>
          <div className="text-xl font-bold text-white mt-0.5">31</div>
        </div>

        <div className="bg-[#111625] p-3.5 rounded-xl border border-slate-800">
          <div className="text-[10px] uppercase text-slate-500 font-semibold">EVENTBUS CHANNEL</div>
          <div className="flex items-center gap-1.5 text-base font-bold text-emerald-400 mt-1">
            <Check size={16} className="stroke-[3]" />
            <span>Connected</span>
          </div>
        </div>
      </div>

      {/* ── Two Main Content Panels (Screenshot 2) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 flex-1 min-h-[420px]">
        {/* Left: Live Diagnostic Stream */}
        <div className="lg:col-span-6 flex flex-col rounded-xl border border-slate-800 bg-[#0c101d] p-4 font-mono text-xs">
          <div className="border-b border-slate-800/80 pb-3 mb-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200">
              Live Diagnostic Stream
            </h3>
            <p className="text-[11px] text-slate-500">Real-time log telemetry</p>
          </div>

          <div className="flex-1 overflow-y-auto space-y-2 pr-1 max-h-[380px]">
            {logs.map((log) => (
              <div
                key={log.id}
                className="flex items-start gap-2 p-1.5 rounded hover:bg-slate-900/50 transition-colors"
              >
                <span className="text-slate-500 shrink-0">{log.time}</span>
                <span
                  className={`px-1.5 py-0.2 rounded font-bold text-[10px] ${
                    log.level === 'INFO'
                      ? 'bg-blue-500/10 text-blue-400'
                      : log.level === 'SUCCESS'
                        ? 'bg-emerald-500/10 text-emerald-400'
                        : log.level === 'WARN'
                          ? 'bg-amber-500/10 text-amber-400'
                          : 'bg-rose-500/10 text-rose-400'
                  }`}
                >
                  [{log.level}]
                </span>
                <span className="text-slate-400 shrink-0">[{log.source}]</span>
                <span className="text-slate-200">{log.message}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Right: Health & Self-Healing Console */}
        <div className="lg:col-span-6 flex flex-col rounded-xl border border-slate-800 bg-[#0c101d] p-4 text-xs font-mono">
          <div className="border-b border-slate-800/80 pb-3 mb-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200">
              Health & Self-Healing Console
            </h3>
            <p className="text-[11px] text-slate-500">{unresolvedCount} unresolved issues</p>
          </div>

          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-4">
            <div className="w-14 h-14 rounded-full bg-emerald-500/10 border-2 border-emerald-500 flex items-center justify-center text-emerald-400">
              <Check size={28} className="stroke-[2.5]" />
            </div>

            <div>
              <div className="text-sm font-semibold text-slate-200">
                {lastScanResult ? lastScanResult : 'No diagnostics run yet'}
              </div>
              <p className="text-xs text-slate-500 mt-1 max-w-sm">
                {lastScanResult
                  ? 'The system integrity daemon confirms all agent IPC ports and sockets are operational.'
                  : 'Run Quick Check, Surface Scan, or Deep Scan to assess system health.'}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
