import React, { useState, useEffect, useCallback } from 'react';
import {
  AlertTriangle,
  Server,
  Activity,
  Copy,
  Check,
  RefreshCw,
  ExternalLink,
  FileText,
  Cpu,
  HardDrive,
  Globe,
  ShieldAlert,
  ShieldCheck,
  Clock,
  Terminal,
  Layers,
  ChevronDown,
  ChevronUp,
  RotateCcw
} from 'lucide-react';
import { tauriBridge, StartupDiagnostics as IStartupDiagnostics } from '../../services/tauriBridge';

interface StartupDiagnosticsProps {
  forcedFailure?: boolean;
  onDismiss?: () => void;
  onRetrySuccess?: () => void;
  compact?: boolean;
}

export const StartupDiagnostics: React.FC<StartupDiagnosticsProps> = ({
  forcedFailure = false,
  onDismiss,
  onRetrySuccess,
  compact = false,
}) => {
  const [diagnostics, setDiagnostics] = useState<IStartupDiagnostics | null>(null);
  const [loading, setLoading] = useState(true);
  const [isRetrying, setIsRetrying] = useState(false);
  const [copied, setCopied] = useState(false);
  const [logOpened, setLogOpened] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [simulateFailure, setSimulateFailure] = useState(forcedFailure);
  const [expandedTrace, setExpandedTrace] = useState(true);

  const fetchDiagnostics = useCallback(async () => {
    try {
      const data = await tauriBridge.getStartupDiagnostics();
      if (simulateFailure) {
        setDiagnostics({
          ...data,
          status: 'FAILED',
          is_healthy: false,
          backend_pid: null,
          error_reason: 'Port 8001 connection refused: AgenticOS kernel daemon failed to bind within 15s timeout.',
          diagnostic_trace: [
            'Component: Backend Kernel',
            'Status: FAILED',
            'Reason: Connection refused to http://127.0.0.1:8001/healthz',
            'PID: null (Process terminated or failed to spawn)',
            'Port: 8001 (Kernel) / 3000 (Gateway)',
            'Architecture: x86_64 PE32+ (Windows)',
            'Kernel Binary: %LOCALAPPDATA%\\AgenticOS\\agenticos-kernel.exe',
            'Job Object Limit: JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE active',
            'Exception Code: 0xC0000005 (Simulated / Unhandled port bind collision)',
            `Log: %LOCALAPPDATA%\\AgenticOS\\logs\\startup.log`,
          ].join('\n'),
        });
      } else {
        setDiagnostics(data);
      }
    } catch (err: any) {
      setDiagnostics({
        status: 'FAILED',
        component: 'Backend Kernel',
        is_healthy: false,
        backend_pid: null,
        kernel_port: 8001,
        frontend_port: 3000,
        health_url: 'http://127.0.0.1:8001/healthz',
        uptime_seconds: 0,
        error_reason: err?.message || 'CRITICAL: Failed to query runtime diagnostics',
        diagnostic_trace: `Fatal error during diagnostic probe: ${err?.message}\nLog: %LOCALAPPDATA%\\AgenticOS\\logs\\startup.log`,
        log_path: '%LOCALAPPDATA%\\AgenticOS\\logs\\startup.log',
        platform: 'windows',
        os_version: 'Windows 11 x64',
        arch: 'x64',
        hostname: 'Windows-Host',
        total_memory_mb: 16384,
        available_memory_mb: 8192,
        cpu_cores: 8,
        subsystems: {
          container: 'offline',
          lifecycle: 'failed',
          omniroute: 'offline',
          bus: 'offline',
          discovery: 'offline',
        },
        timestamp: new Date().toISOString(),
      });
    } finally {
      setLoading(false);
    }
  }, [simulateFailure]);

  useEffect(() => {
    fetchDiagnostics();
    if (!autoRefresh) return;

    const interval = setInterval(fetchDiagnostics, 4000);
    return () => clearInterval(interval);
  }, [fetchDiagnostics, autoRefresh]);

  const handleRetry = async () => {
    setIsRetrying(true);
    try {
      const refreshed = await tauriBridge.retryKernelStartup();
      if (simulateFailure) {
        setSimulateFailure(false);
      }
      setDiagnostics(refreshed);
      if (refreshed.is_healthy && onRetrySuccess) {
        onRetrySuccess();
      }
    } catch (err) {
      console.error('Retry failed:', err);
    } finally {
      setIsRetrying(false);
    }
  };

  const handleCopy = async () => {
    if (!diagnostics) return;
    await tauriBridge.copyDiagnosticReport(diagnostics);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleOpenLog = async () => {
    const opened = await tauriBridge.openDiagnosticLog();
    setLogOpened(true);
    setTimeout(() => setLogOpened(false), 3000);
    if (!opened) {
      // Fallback: download or view log text
      const blob = new Blob([diagnostics?.diagnostic_trace || 'No log data available.'], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'AgenticOS-startup.log';
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  if (loading && !diagnostics) {
    return (
      <div className="p-8 flex flex-col items-center justify-center bg-slate-950 rounded-2xl border border-slate-800 text-slate-300">
        <RefreshCw className="w-8 h-8 text-cyan-400 animate-spin mb-3" />
        <p className="font-mono text-sm">Probing AgenticOS runtime daemon (Port 8001)...</p>
      </div>
    );
  }

  const isFailed = diagnostics?.status === 'FAILED' || !diagnostics?.is_healthy;

  return (
    <div
      id="startup-diagnostics-container"
      className={`relative rounded-2xl transition-all duration-300 overflow-hidden font-sans ${
        isFailed
          ? 'bg-[#0e090a] border-2 border-red-500/50 shadow-2xl shadow-red-950/40'
          : 'bg-[#0b101b] border border-cyan-500/30 shadow-xl'
      } ${compact ? 'p-4' : 'p-6'}`}
    >
      {/* Top Banner / Error Status Header */}
      <div className="flex flex-wrap items-start justify-between gap-4 pb-4 border-b border-slate-800/80">
        <div className="flex items-start gap-3">
          <div
            className={`p-2.5 rounded-xl border ${
              isFailed
                ? 'bg-red-500/10 border-red-500/40 text-red-400 shadow-inner'
                : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
            }`}
          >
            {isFailed ? <AlertTriangle className="w-6 h-6" /> : <ShieldCheck className="w-6 h-6" />}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold tracking-tight text-white">
                {isFailed ? 'AgenticOS could not start.' : 'AgenticOS Runtime Operational'}
              </h2>
              <span
                className={`px-2.5 py-0.5 rounded-full text-xs font-mono font-bold tracking-wide uppercase ${
                  isFailed
                    ? 'bg-red-500 text-white shadow-sm shadow-red-500/50'
                    : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                }`}
              >
                {diagnostics?.status || 'UNKNOWN'}
              </span>
            </div>
            <p className="text-sm text-slate-400 mt-1">
              Component:{' '}
              <strong className="text-slate-200 font-mono font-semibold">
                {diagnostics?.component || 'Backend Kernel'}
              </strong>{' '}
              —{' '}
              <span className="text-slate-400 text-xs">
                Target Port {diagnostics?.kernel_port} • Host {diagnostics?.hostname}
              </span>
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Simulate Failure Switch for Verification */}
          <button
            onClick={() => setSimulateFailure(!simulateFailure)}
            title="Toggle failure simulation for testing Requirement 11"
            className={`text-xs px-2.5 py-1.5 rounded-lg font-mono border transition-all cursor-pointer ${
              simulateFailure
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
            }`}
          >
            {simulateFailure ? 'Failure Simulation ON' : 'Test Failure UI'}
          </button>

          <button
            id="btn-copy-diagnostic"
            onClick={handleCopy}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-lg border border-slate-700 transition cursor-pointer"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-slate-400" />}
            {copied ? 'Copied to Clipboard' : 'Copy Diagnostic'}
          </button>

          <button
            id="btn-open-log"
            onClick={handleOpenLog}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-lg border border-slate-700 transition cursor-pointer"
          >
            <FileText className="w-3.5 h-3.5 text-cyan-400" />
            {logOpened ? 'Opening Viewer...' : 'Open Log'}
          </button>

          <button
            id="btn-retry-startup"
            onClick={handleRetry}
            disabled={isRetrying}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-lg shadow-sm transition cursor-pointer ${
              isFailed
                ? 'bg-red-600 hover:bg-red-500 text-white shadow-red-900/40'
                : 'bg-cyan-600 hover:bg-cyan-500 text-white'
            } ${isRetrying ? 'opacity-60 cursor-wait' : ''}`}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRetrying ? 'animate-spin' : ''}`} />
            {isRetrying ? 'Re-probing Port 8001...' : 'Retry Startup'}
          </button>
        </div>
      </div>

      {/* Requirement 11 Structured Failure Notice */}
      {isFailed && (
        <div className="my-4 p-4 rounded-xl bg-red-950/30 border border-red-500/30 text-slate-200 space-y-2">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs font-mono">
            <div>
              <span className="text-red-400 uppercase font-bold tracking-wider">Status:</span>{' '}
              <span className="text-red-200 font-bold">FAILED</span>
            </div>
            <div>
              <span className="text-red-400 uppercase font-bold tracking-wider">Component:</span>{' '}
              <span className="text-white font-medium">{diagnostics?.component}</span>
            </div>
            <div className="md:col-span-2">
              <span className="text-red-400 uppercase font-bold tracking-wider">Reason:</span>{' '}
              <span className="text-amber-200 font-medium">
                {diagnostics?.error_reason || 'Backend daemon did not reply with HTTP 200 within timeout.'}
              </span>
            </div>
            <div className="md:col-span-2">
              <span className="text-red-400 uppercase font-bold tracking-wider">Log:</span>{' '}
              <code className="text-cyan-300 bg-slate-900/80 px-2 py-0.5 rounded border border-slate-800 select-all">
                {diagnostics?.log_path || '%LOCALAPPDATA%\\AgenticOS\\logs\\startup.log'}
              </code>
            </div>
          </div>
        </div>
      )}

      {/* Telemetry Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 my-4">
        {/* Metric: Backend PID */}
        <div className="p-3 bg-slate-900/60 rounded-xl border border-slate-800">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
            <span>Backend PID</span>
            <Server className="w-3.5 h-3.5 text-cyan-400" />
          </div>
          <div className="text-base font-mono font-bold text-white">
            {diagnostics?.backend_pid ? (
              <span className="text-emerald-400">#{diagnostics.backend_pid}</span>
            ) : (
              <span className="text-red-400">Offline</span>
            )}
          </div>
          <span className="text-[10px] font-mono text-slate-400">
            {diagnostics?.backend_pid ? 'Active Win32 Process' : 'No Process Handle'}
          </span>
        </div>

        {/* Metric: Port 8001 Health */}
        <div className="p-3 bg-slate-900/60 rounded-xl border border-slate-800">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
            <span>Port 8001 Health</span>
            <Activity className="w-3.5 h-3.5 text-indigo-400" />
          </div>
          <div className="text-base font-mono font-bold">
            {diagnostics?.is_healthy ? (
              <span className="text-emerald-400">200 OK</span>
            ) : (
              <span className="text-red-400">Refused</span>
            )}
          </div>
          <span className="text-[10px] font-mono text-slate-400">
            {diagnostics?.is_healthy ? `${diagnostics.uptime_seconds.toFixed(1)}s Uptime` : 'No Health Response'}
          </span>
        </div>

        {/* Metric: Platform Environment */}
        <div className="p-3 bg-slate-900/60 rounded-xl border border-slate-800">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
            <span>Platform</span>
            <Cpu className="w-3.5 h-3.5 text-purple-400" />
          </div>
          <div className="text-base font-mono font-bold text-white truncate">
            {diagnostics?.platform.toUpperCase()} / {diagnostics?.arch}
          </div>
          <span className="text-[10px] font-mono text-slate-400 truncate block">
            {diagnostics?.cpu_cores} Cores • {diagnostics?.hostname}
          </span>
        </div>

        {/* Metric: Memory Status */}
        <div className="p-3 bg-slate-900/60 rounded-xl border border-slate-800">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
            <span>Memory Load</span>
            <HardDrive className="w-3.5 h-3.5 text-amber-400" />
          </div>
          <div className="text-base font-mono font-bold text-white">
            {diagnostics?.available_memory_mb} / {diagnostics?.total_memory_mb} MB
          </div>
          <span className="text-[10px] font-mono text-slate-400">
            {Math.round(((diagnostics?.total_memory_mb || 100) - (diagnostics?.available_memory_mb || 50)) / (diagnostics?.total_memory_mb || 100) * 100)}% Utilized
          </span>
        </div>
      </div>

      {/* Subsystems Status Grid */}
      <div className="p-3 bg-slate-900/40 rounded-xl border border-slate-800/80 my-3">
        <div className="flex items-center justify-between text-xs text-slate-400 mb-2 font-mono">
          <span className="flex items-center gap-1.5 font-semibold text-slate-300">
            <Layers className="w-3.5 h-3.5 text-cyan-400" />
            Kernel Subsystems Health Matrix
          </span>
          <span className="text-[11px] text-slate-400">Port 8001 /healthz schema</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          {diagnostics?.subsystems &&
            Object.entries(diagnostics.subsystems).map(([name, status]) => {
              const isOk = status === 'ok' || status === 'healthy' || status === 'ready';
              return (
                <div
                  key={name}
                  className="px-2.5 py-1.5 rounded-lg bg-slate-950/70 border border-slate-800 flex items-center justify-between"
                >
                  <span className="text-xs font-mono text-slate-300 capitalize">{name}</span>
                  <span
                    className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${
                      isOk ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'
                    }`}
                  >
                    {status}
                  </span>
                </div>
              );
            })}
        </div>
      </div>

      {/* Diagnostic Trace Section with Collapsible View */}
      <div className="mt-3">
        <button
          onClick={() => setExpandedTrace(!expandedTrace)}
          className="w-full flex items-center justify-between px-3 py-2 bg-slate-900/60 hover:bg-slate-900 rounded-lg text-xs font-mono text-slate-300 border border-slate-800 transition cursor-pointer"
        >
          <span className="flex items-center gap-1.5 font-semibold">
            <Terminal className="w-3.5 h-3.5 text-cyan-400" />
            Full Diagnostic Telemetry Trace
          </span>
          {expandedTrace ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>

        {expandedTrace && (
          <div className="mt-2 p-3 bg-black/80 rounded-xl border border-slate-800 font-mono text-xs text-slate-300 overflow-x-auto max-h-56 select-text space-y-1">
            <div className="text-cyan-400 font-semibold mb-1">
              [DIAGNOSTIC] Generated: {diagnostics?.timestamp}
            </div>
            <pre className="whitespace-pre-wrap text-slate-300 leading-relaxed">
              {diagnostics?.diagnostic_trace}
            </pre>
          </div>
        )}
      </div>

      {/* Footer Info */}
      <div className="mt-4 pt-3 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono text-slate-400">
        <div className="flex items-center gap-3">
          <span>Target Binary: {diagnostics?.kernel_binary_path || '%LOCALAPPDATA%\\AgenticOS\\agenticos-kernel.exe'}</span>
          <span>•</span>
          <span>Health Poller: 4.0s interval</span>
        </div>
        {onDismiss && (
          <button
            onClick={onDismiss}
            className="text-slate-400 hover:text-white transition cursor-pointer underline"
          >
            Dismiss Screen
          </button>
        )}
      </div>
    </div>
  );
};
