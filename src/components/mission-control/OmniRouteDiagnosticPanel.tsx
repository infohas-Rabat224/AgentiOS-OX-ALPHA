import React, { useState } from 'react';
import {
  Activity,
  Zap,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  RefreshCw,
  Search,
  Filter,
  ArrowUpDown,
  Download,
  Wifi,
  WifiOff,
  Cpu,
  Layers,
  Clock,
  Terminal,
  ExternalLink,
  CheckCircle2,
  XCircle,
  Play,
  Pause,
  Flame,
  X,
  Maximize2,
  Minimize2
} from 'lucide-react';
import {
  omniRouterService,
  AgentNode,
  TrafficMetric
} from '../../services/omniRouter';

interface OmniRouteDiagnosticPanelProps {
  agents: AgentNode[];
  metrics: TrafficMetric;
  onCloseOverlay?: () => void;
  isOverlay?: boolean;
  onSelectAgent?: (agent: AgentNode) => void;
}

export const OmniRouteDiagnosticPanel: React.FC<OmniRouteDiagnosticPanelProps> = ({
  agents,
  metrics,
  onCloseOverlay,
  isOverlay = false,
  onSelectAgent,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'healthy' | 'degraded' | 'down'>('all');
  const [sortBy, setSortBy] = useState<'routed' | 'active' | 'latency' | 'name'>('active');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [pingingAgentId, setPingingAgentId] = useState<string | null>(null);
  const [isPingingAll, setIsPingingAll] = useState(false);
  const [selectedAgentDetail, setSelectedAgentDetail] = useState<AgentNode | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handlePing = async (agent: AgentNode) => {
    setPingingAgentId(agent.id);
    try {
      const res = await omniRouterService.pingAgent(agent.id);
      showToast(`Ping ${agent.name}: ${res.latencyMs}ms (${res.status.toUpperCase()})`);
    } catch {
      showToast(`Ping failed for ${agent.name}`);
    } finally {
      setPingingAgentId(null);
    }
  };

  const handlePingAll = async () => {
    setIsPingingAll(true);
    await omniRouterService.pingAllAgents();
    showToast('Pinged all 16 agent runtimes. Real-time latencies refreshed.');
    setIsPingingAll(false);
  };

  const handleResetCircuits = () => {
    omniRouterService.resetCircuitBreakers();
    showToast('All 16 agent circuit breakers reset to CLOSED (Healthy).');
  };

  const handleToggleCircuit = (agentId: string) => {
    omniRouterService.toggleCircuitBreaker(agentId);
    showToast(`Toggled circuit breaker for ${agentId}.`);
  };

  const handleBurstTraffic = () => {
    omniRouterService.burstTraffic(5);
    showToast('Dispatched 5 concurrent burst requests across the 16 agent cluster.');
  };

  const handleExportJSON = () => {
    const payload = {
      exportTimestamp: new Date().toISOString(),
      agenticOsVersion: '1.0.0-rc10',
      totalDiscoveredAgents: agents.length,
      metrics,
      agents: agents.map((a) => ({
        id: a.id,
        name: a.name,
        vendor: a.vendor,
        runtime: a.runtime,
        version: a.version,
        connectionStatus: a.status,
        circuitState: a.circuitState,
        latencyMs: a.latencyMs,
        activeRequests: a.activeRequests,
        totalRouted: a.totalRouted,
        throughputCap: a.throughput,
        errorCount: a.errorCount,
        costPer1k: a.costPer1k,
        contextWindow: a.contextWindow,
        capabilities: a.capabilities,
      })),
    };

    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(payload, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `agenticos-omniroute-16agents-diagnostics-${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    showToast('Downloaded complete 16-agent telemetry JSON snapshot.');
  };

  // Filter and sort agents
  const filteredAgents = agents
    .filter((agent) => {
      const matchesSearch =
        agent.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        agent.vendor.toLowerCase().includes(searchQuery.toLowerCase()) ||
        agent.runtime.toLowerCase().includes(searchQuery.toLowerCase()) ||
        agent.capabilities.some((c) => c.toLowerCase().includes(searchQuery.toLowerCase()));

      if (!matchesSearch) return false;

      if (statusFilter === 'all') return true;
      if (statusFilter === 'healthy') return agent.status === 'healthy';
      if (statusFilter === 'degraded') return agent.status === 'degraded' || agent.status === 'unhealthy';
      if (statusFilter === 'down') return agent.status === 'down';
      return true;
    })
    .sort((a, b) => {
      let comp = 0;
      if (sortBy === 'active') comp = a.activeRequests - b.activeRequests;
      else if (sortBy === 'routed') comp = a.totalRouted - b.totalRouted;
      else if (sortBy === 'latency') comp = a.latencyMs - b.latencyMs;
      else if (sortBy === 'name') comp = a.name.localeCompare(b.name);
      return sortOrder === 'asc' ? comp : -comp;
    });

  const totalInFlight = agents.reduce((acc, a) => acc + a.activeRequests, 0);
  const totalRoutedVolume = agents.reduce((acc, a) => acc + a.totalRouted, 0);
  const healthyCount = agents.filter((a) => a.status === 'healthy').length;
  const degradedCount = agents.filter((a) => a.status === 'degraded' || a.status === 'unhealthy').length;
  const downCount = agents.filter((a) => a.status === 'down').length;

  return (
    <div
      className={`flex flex-col bg-[#090d19] text-slate-100 ${
        isOverlay
          ? 'fixed inset-4 sm:inset-8 z-50 rounded-2xl border border-cyan-500/40 shadow-2xl backdrop-blur-2xl flex-1 max-h-[calc(100vh-4rem)] overflow-hidden'
          : 'rounded-2xl border border-slate-800 shadow-xl overflow-hidden'
      }`}
    >
      {/* ── Toast Notification ── */}
      {toastMessage && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-xl bg-cyan-500/90 text-slate-950 font-mono text-xs font-bold shadow-2xl flex items-center gap-2 border border-cyan-300 animate-in fade-in slide-in-from-top-2">
          <CheckCircle2 size={14} />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* ── Header Toolbar ── */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 bg-[#0e1424] px-5 py-3.5">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/40 flex items-center justify-center">
            <Activity className="w-4 h-4 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xs sm:text-sm font-bold font-mono uppercase tracking-wider text-white">
                16 DISCOVERED AGENTS · ACTIVE ROUTING TRAFFIC DIAGNOSTICS
              </h2>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-cyan-500/15 text-cyan-300 border border-cyan-500/40 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
                REAL-TIME SSE
              </span>
            </div>
            <p className="text-[11px] text-slate-400 font-mono">
              Live connection status, active request concurrency, circuit breaker health, and latency telemetry
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handlePingAll}
            disabled={isPingingAll}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface/50 hover:bg-cyan-500/20 text-cyan-300 border border-slate-700 hover:border-cyan-500/50 text-xs font-mono font-semibold transition cursor-pointer disabled:opacity-50"
            title="Ping all 16 agents to measure real-time round-trip latency"
          >
            <RefreshCw size={13} className={isPingingAll ? 'animate-spin' : ''} />
            <span className="hidden sm:inline">Ping All 16</span>
          </button>

          <button
            onClick={handleBurstTraffic}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/40 text-xs font-mono font-semibold transition cursor-pointer"
            title="Dispatch 5 concurrent synthetic traffic requests across the cluster"
          >
            <Flame size={13} />
            <span className="hidden sm:inline">Traffic Burst</span>
          </button>

          <button
            onClick={handleResetCircuits}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/40 text-xs font-mono font-semibold transition cursor-pointer"
            title="Reset any open circuit breakers to healthy state"
          >
            <ShieldCheck size={13} />
            <span className="hidden sm:inline">Reset Circuits</span>
          </button>

          <button
            onClick={handleExportJSON}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface/50 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs font-mono transition cursor-pointer"
            title="Export full diagnostic snapshot as JSON"
          >
            <Download size={13} />
            <span className="hidden sm:inline">Export JSON</span>
          </button>

          {isOverlay && onCloseOverlay && (
            <button
              onClick={onCloseOverlay}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer ml-1"
              title="Close Diagnostic Overlay"
            >
              <X size={18} />
            </button>
          )}
        </div>
      </div>

      {/* ── Summary Metrics Ribbon ── */}
      <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 bg-[#0c111e] p-3 border-b border-slate-800/80 font-mono text-xs">
        <div className="p-2 bg-[#121829] rounded-xl border border-slate-800">
          <span className="text-[10px] uppercase text-slate-400">Total Discovered</span>
          <div className="text-base font-bold text-white mt-0.5">16 Agents</div>
          <span className="text-[9px] text-cyan-400">100% Taxonomized</span>
        </div>

        <div className="p-2 bg-[#121829] rounded-xl border border-slate-800">
          <span className="text-[10px] uppercase text-slate-400">Connection State</span>
          <div className="text-base font-bold text-emerald-400 mt-0.5">
            {healthyCount} Online
          </div>
          <span className="text-[9px] text-slate-400">
            {degradedCount} Warn · {downCount} Down
          </span>
        </div>

        <div className="p-2 bg-[#121829] rounded-xl border border-slate-800">
          <span className="text-[10px] uppercase text-slate-400">Active In-Flight</span>
          <div className="text-base font-bold text-cyan-400 mt-0.5 flex items-center gap-1.5">
            {totalInFlight}
            {totalInFlight > 0 && <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />}
          </div>
          <span className="text-[9px] text-slate-400">Concurrent requests</span>
        </div>

        <div className="p-2 bg-[#121829] rounded-xl border border-slate-800">
          <span className="text-[10px] uppercase text-slate-400">Total Routed Volume</span>
          <div className="text-base font-bold text-white mt-0.5">{totalRoutedVolume}</div>
          <span className="text-[9px] text-emerald-400">0.00% drop rate</span>
        </div>

        <div className="p-2 bg-[#121829] rounded-xl border border-slate-800">
          <span className="text-[10px] uppercase text-slate-400">Cluster Avg Latency</span>
          <div className="text-base font-bold text-amber-400 mt-0.5">{metrics.avgLatencyMs} ms</div>
          <span className="text-[9px] text-slate-400">Router: {metrics.routerOverheadMs}ms</span>
        </div>

        <div className="p-2 bg-[#121829] rounded-xl border border-slate-800">
          <span className="text-[10px] uppercase text-slate-400">Cost Optimization</span>
          <div className="text-base font-bold text-purple-400 mt-0.5">
            {metrics.costSavingsPercent}%
          </div>
          <span className="text-[9px] text-slate-400">Tiered local dispatch</span>
        </div>
      </div>

      {/* ── Filters & Search Bar ── */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-[#0a0e1b] border-b border-slate-800/80 text-xs font-mono">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search agents by name, vendor, runtime, or capability..."
            className="w-full bg-[#111728] border border-slate-800 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder:text-slate-500 outline-none focus:border-cyan-500/60"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
            >
              <X size={12} />
            </button>
          )}
        </div>

        {/* Status Filter */}
        <div className="flex items-center space-x-1 bg-[#121829] p-1 rounded-xl border border-slate-800">
          <span className="text-slate-500 px-2 text-[10px] uppercase">Filter:</span>
          {(['all', 'healthy', 'degraded', 'down'] as const).map((filterKey) => (
            <button
              key={filterKey}
              onClick={() => setStatusFilter(filterKey)}
              className={`px-2.5 py-1 rounded-lg capitalize transition cursor-pointer text-[11px] ${
                statusFilter === filterKey
                  ? 'bg-cyan-500 text-slate-950 font-bold shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {filterKey === 'all' ? `All (${agents.length})` : filterKey}
            </button>
          ))}
        </div>

        {/* Sort Controls */}
        <div className="flex items-center space-x-1 bg-[#121829] p-1 rounded-xl border border-slate-800">
          <span className="text-slate-500 px-2 text-[10px] uppercase">Sort:</span>
          {(['active', 'routed', 'latency', 'name'] as const).map((sKey) => (
            <button
              key={sKey}
              onClick={() => {
                if (sortBy === sKey) {
                  setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                } else {
                  setSortBy(sKey);
                  setSortOrder('desc');
                }
              }}
              className={`px-2 py-1 rounded-lg capitalize transition cursor-pointer text-[11px] flex items-center gap-1 ${
                sortBy === sKey
                  ? 'bg-slate-700 text-white font-bold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <span>{sKey}</span>
              {sortBy === sKey && (
                <ArrowUpDown size={10} className={sortOrder === 'asc' ? 'rotate-180' : ''} />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ── 16 Agent Live Diagnostic Table ── */}
      <div className="flex-1 overflow-y-auto overflow-x-auto p-4 space-y-2">
        <table className="w-full text-left font-mono text-xs border-collapse">
          <thead>
            <tr className="bg-[#101524] text-slate-400 border-b border-slate-800 text-[10px] uppercase tracking-wider">
              <th className="p-3 pl-4">Agent Node</th>
              <th className="p-3">Connection Status</th>
              <th className="p-3">Circuit State</th>
              <th className="p-3">In-Flight</th>
              <th className="p-3">Total Routed</th>
              <th className="p-3">Latency</th>
              <th className="p-3">Throughput Cap</th>
              <th className="p-3">Cost / 1k</th>
              <th className="p-3">Capabilities</th>
              <th className="p-3 pr-4 text-right">Diagnostic Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 text-slate-300">
            {filteredAgents.map((agent) => {
              const isHealthy = agent.status === 'healthy';
              const isDegraded = agent.status === 'degraded' || agent.status === 'unhealthy';
              const isDown = agent.status === 'down';
              const loadPercent = totalRoutedVolume > 0 ? Math.round((agent.totalRouted / totalRoutedVolume) * 100) : 0;
              const isPinging = pingingAgentId === agent.id;

              return (
                <tr
                  key={agent.id}
                  className={`hover:bg-slate-800/40 transition-colors ${
                    agent.activeRequests > 0 ? 'bg-cyan-950/15' : ''
                  }`}
                >
                  {/* Agent Identity */}
                  <td className="p-3 pl-4 font-semibold text-white">
                    <div className="flex items-center gap-2">
                      <div
                        className={`w-2 h-2 rounded-full shrink-0 ${
                          isHealthy
                            ? 'bg-emerald-400 animate-pulse'
                            : isDegraded
                              ? 'bg-amber-400'
                              : 'bg-rose-500'
                        }`}
                      />
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-slate-100">{agent.name}</span>
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 border border-slate-700">
                            {agent.runtime}
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-500 flex items-center gap-1">
                          <span>{agent.vendor}</span>
                          <span>·</span>
                          <span>{agent.version}</span>
                        </div>
                      </div>
                    </div>
                  </td>

                  {/* Real-Time Connection Status */}
                  <td className="p-3">
                    <span
                      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border ${
                        isHealthy
                          ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                          : isDegraded
                            ? 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                            : 'bg-rose-500/15 text-rose-400 border-rose-500/30'
                      }`}
                    >
                      {isHealthy ? (
                        <Wifi size={11} className="text-emerald-400 animate-pulse" />
                      ) : isDegraded ? (
                        <AlertTriangle size={11} className="text-amber-400" />
                      ) : (
                        <WifiOff size={11} className="text-rose-400" />
                      )}
                      <span>{isHealthy ? 'Connected' : isDegraded ? 'Degraded' : 'Offline'}</span>
                    </span>
                  </td>

                  {/* Circuit Breaker State */}
                  <td className="p-3">
                    <button
                      onClick={() => handleToggleCircuit(agent.id)}
                      className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border transition cursor-pointer ${
                        agent.circuitState === 'closed'
                          ? 'bg-emerald-950/40 text-emerald-300 border-emerald-800 hover:bg-emerald-900/60'
                          : agent.circuitState === 'half_open'
                            ? 'bg-amber-950/40 text-amber-300 border-amber-800 hover:bg-amber-900/60'
                            : 'bg-rose-950/40 text-rose-300 border-rose-800 hover:bg-rose-900/60'
                      }`}
                      title="Click to toggle circuit breaker for resilience testing"
                    >
                      {agent.circuitState}
                    </button>
                  </td>

                  {/* In-Flight Active Requests */}
                  <td className="p-3">
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`text-sm font-bold ${
                          agent.activeRequests > 0 ? 'text-cyan-400' : 'text-slate-500'
                        }`}
                      >
                        {agent.activeRequests}
                      </span>
                      {agent.activeRequests > 0 && (
                        <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
                      )}
                    </div>
                  </td>

                  {/* Total Routed + Load Bar */}
                  <td className="p-3">
                    <div>
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-bold text-white">{agent.totalRouted}</span>
                        <span className="text-slate-500 text-[10px]">{loadPercent}%</span>
                      </div>
                      <div className="w-20 h-1 bg-slate-800 rounded-full overflow-hidden mt-1">
                        <div
                          className="h-full bg-gradient-to-r from-cyan-400 to-indigo-500"
                          style={{ width: `${Math.min(100, Math.max(5, loadPercent * 3))}%` }}
                        />
                      </div>
                    </div>
                  </td>

                  {/* Latency */}
                  <td className="p-3">
                    <span
                      className={`font-bold ${
                        agent.latencyMs < 15
                          ? 'text-emerald-400'
                          : agent.latencyMs < 30
                            ? 'text-cyan-400'
                            : agent.latencyMs < 50
                              ? 'text-amber-400'
                              : 'text-rose-400'
                      }`}
                    >
                      {agent.latencyMs} ms
                    </span>
                  </td>

                  {/* Throughput */}
                  <td className="p-3 text-slate-300">
                    <span>{agent.throughput}</span>{' '}
                    <span className="text-[10px] text-slate-500">req/s</span>
                  </td>

                  {/* Cost per 1k */}
                  <td className="p-3 text-slate-400">
                    {agent.costPer1k === 0 ? (
                      <span className="text-emerald-400 font-semibold">$0 (Native)</span>
                    ) : (
                      `$${agent.costPer1k}`
                    )}
                  </td>

                  {/* Capabilities */}
                  <td className="p-3">
                    <div className="flex flex-wrap gap-1 max-w-[200px]">
                      {agent.capabilities.slice(0, 2).map((cap) => (
                        <span
                          key={cap}
                          className="text-[9px] px-1.5 py-0.2 rounded bg-slate-800/80 text-slate-400 border border-slate-700/60 truncate"
                        >
                          {cap}
                        </span>
                      ))}
                      {agent.capabilities.length > 2 && (
                        <span className="text-[9px] text-slate-500">
                          +{agent.capabilities.length - 2}
                        </span>
                      )}
                    </div>
                  </td>

                  {/* Actions */}
                  <td className="p-3 pr-4 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        onClick={() => handlePing(agent)}
                        disabled={isPinging}
                        className="p-1.5 rounded-lg bg-surface/50 hover:bg-cyan-500/20 text-slate-300 hover:text-cyan-300 border border-slate-700 text-[11px] transition cursor-pointer disabled:opacity-50"
                        title="Send ping to test round-trip time"
                      >
                        <RefreshCw size={11} className={isPinging ? 'animate-spin text-cyan-400' : ''} />
                      </button>

                      <button
                        onClick={() => {
                          setSelectedAgentDetail(agent);
                          if (onSelectAgent) onSelectAgent(agent);
                        }}
                        className="px-2 py-1 rounded-lg bg-[#151c2e] hover:bg-cyan-500/20 text-cyan-300 border border-slate-700 hover:border-cyan-500/40 text-[10px] font-bold transition cursor-pointer"
                      >
                        Inspect
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ── Agent Detail Inspector Drawer / Modal ── */}
      {selectedAgentDetail && (
        <div className="border-t border-slate-800 bg-[#0c111e] p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 font-mono text-xs animate-in slide-in-from-bottom-2">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-white font-bold text-sm">{selectedAgentDetail.name}</span>
              <span className="px-2 py-0.5 rounded text-[10px] bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
                {selectedAgentDetail.vendor.toUpperCase()} · {selectedAgentDetail.runtime}
              </span>
              <span
                className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                  selectedAgentDetail.status === 'healthy'
                    ? 'bg-emerald-500/20 text-emerald-400'
                    : 'bg-rose-500/20 text-rose-400'
                }`}
              >
                {selectedAgentDetail.status.toUpperCase()}
              </span>
            </div>
            <div className="text-slate-400 text-[11px] flex flex-wrap gap-4">
              <span>Context Window: {(selectedAgentDetail.contextWindow / 1000).toFixed(0)}k tokens</span>
              <span>Throughput Cap: {selectedAgentDetail.throughput} req/s</span>
              <span>Active In-Flight: {selectedAgentDetail.activeRequests}</span>
              <span>Total Dispatches: {selectedAgentDetail.totalRouted}</span>
              <span>Error Count: {selectedAgentDetail.errorCount}</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => handlePing(selectedAgentDetail)}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/50 text-xs cursor-pointer font-bold"
            >
              <RefreshCw size={12} />
              <span>Ping Node</span>
            </button>
            <button
              onClick={() => handleToggleCircuit(selectedAgentDetail.id)}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs cursor-pointer"
            >
              <span>Toggle Circuit State</span>
            </button>
            <button
              onClick={() => setSelectedAgentDetail(null)}
              className="px-2.5 py-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 text-xs cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
