import React, { useState, useEffect } from 'react';
import {
  Zap,
  Activity,
  ArrowRight,
  ShieldCheck,
  RefreshCw,
  Cpu,
  Layers,
  Send,
  AlertTriangle,
  CheckCircle2,
  Sliders,
  Play,
  Pause,
  Terminal,
  Clock,
  Coins,
  Bot,
  Maximize2
} from 'lucide-react';
import {
  omniRouterService,
  AgentNode,
  RoutingDecision,
  RoutingStrategy,
  TrafficMetric,
  TimeSeriesPoint
} from '../../services/omniRouter';
import { OmniRouteD3Chart } from './OmniRouteD3Chart';
import { OmniRouteDiagnosticPanel } from './OmniRouteDiagnosticPanel';

export const OmniRouteDiagnosticView: React.FC = () => {
  const [agents, setAgents] = useState<AgentNode[]>(omniRouterService.getAgents());
  const [trafficHistory, setTrafficHistory] = useState<RoutingDecision[]>(omniRouterService.getTrafficHistory());
  const [timeSeries, setTimeSeries] = useState<TimeSeriesPoint[]>(omniRouterService.getTimeSeries());
  const [metrics, setMetrics] = useState<TrafficMetric>(omniRouterService.getMetrics());
  const [strategy, setStrategy] = useState<RoutingStrategy>('balanced');
  const [testIntent, setTestIntent] = useState('');
  const [lastDecision, setLastDecision] = useState<RoutingDecision | null>(null);
  const [isSimulating, setIsSimulating] = useState(omniRouterService.isTrafficSimulating());
  const [showDiagnosticOverlay, setShowDiagnosticOverlay] = useState(false);
  const [latencyThreshold, setLatencyThreshold] = useState<number>(26);
  const [visibleAgents, setVisibleAgents] = useState<Record<string, boolean>>({
    claude: true,
    python: true,
    hermes: true,
    node: true,
    codex: true,
    others: true,
  });

  useEffect(() => {
    const unsubscribe = omniRouterService.subscribe(() => {
      setAgents([...omniRouterService.getAgents()]);
      setTrafficHistory([...omniRouterService.getTrafficHistory()]);
      setTimeSeries([...omniRouterService.getTimeSeries()]);
      setMetrics(omniRouterService.getMetrics());
      setIsSimulating(omniRouterService.isTrafficSimulating());
    });
    return unsubscribe;
  }, []);

  const handleDispatch = (intentToRun?: string) => {
    const prompt = intentToRun || testIntent || 'Optimize AST parsing and type verification';
    const decision = omniRouterService.route({
      id: `manual-${Date.now().toString(36)}`,
      timestamp: new Date().toLocaleTimeString(),
      intent: prompt,
      strategy,
      promptLength: 1200,
    });
    setLastDecision(decision);
    if (!intentToRun) setTestIntent('');
  };

  const toggleSim = () => {
    omniRouterService.toggleSimulation();
    setIsSimulating(omniRouterService.isTrafficSimulating());
  };

  const healthyCount = agents.filter((a) => a.status === 'healthy').length;
  const totalTraffic = agents.reduce((acc, a) => acc + a.totalRouted, 0);

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-background text-text p-4 space-y-4">
      {/* ── Top Header Toolbar ── */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border/50 bg-surface/30 px-5 py-3 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/40 flex items-center justify-center">
            <Zap className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-bold tracking-wider uppercase">
                OMNIROUTER · ACTIVE TRAFFIC MONITOR
              </h1>
              <span className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
                16 DISCOVERED AGENTS
              </span>
            </div>
            <p className="text-[11px] text-faint">
              O(N+M) Lockless Intelligent Dispatch across all 16 Agent Runtimes
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Strategy Selector */}
          <div className="flex items-center space-x-1 bg-[#131826] p-1 rounded-lg border border-slate-700/80 text-xs font-mono">
            <span className="text-slate-500 px-2 text-[10px]">Strategy:</span>
            {(['balanced', 'latency', 'cost', 'reasoning', 'coding'] as const).map((strat) => (
              <button
                key={strat}
                onClick={() => setStrategy(strat)}
                className={`px-2.5 py-1 rounded capitalize transition-colors cursor-pointer ${
                  strategy === strat
                    ? 'bg-cyan-500 text-slate-950 font-bold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {strat}
              </button>
            ))}
          </div>

          {/* 'Pause' / 'Resume' Real-time Data Streaming Toggle Button */}
          <button
            onClick={toggleSim}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-mono font-bold transition cursor-pointer ${
              isSimulating
                ? 'bg-amber-500/15 border-amber-500/40 text-amber-300 hover:bg-amber-500/25 shadow-sm'
                : 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/25 shadow-sm'
            }`}
            title={isSimulating ? 'Pause real-time telemetry streaming to D3 chart' : 'Resume real-time telemetry streaming to D3 chart'}
          >
            {isSimulating ? (
              <>
                <Pause size={13} className="text-amber-400" />
                <span>Pause</span>
              </>
            ) : (
              <>
                <Play size={13} className="text-emerald-400" />
                <span>Resume</span>
              </>
            )}
          </button>

          {/* Diagnostic Overlay Open Button */}
          <button
            onClick={() => setShowDiagnosticOverlay(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/50 text-xs font-mono font-bold transition cursor-pointer shadow-sm"
            title="Open dedicated 16-agent active traffic diagnostic overlay"
          >
            <Maximize2 size={13} />
            <span>16-Agent Diagnostic Overlay</span>
          </button>
        </div>
      </div>

      {/* ── Key Metrics Overview ── */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 font-mono">
        <div className="bg-[#131826] p-3.5 rounded-xl border border-slate-800">
          <span className="text-[10px] uppercase text-slate-500">Router Overhead</span>
          <div className="text-xl font-bold text-cyan-400 mt-0.5">{metrics.routerOverheadMs} ms</div>
          <span className="text-[10px] text-emerald-400">Lockless routing</span>
        </div>

        <div className="bg-[#131826] p-3.5 rounded-xl border border-slate-800">
          <span className="text-[10px] uppercase text-slate-500">Healthy Nodes</span>
          <div className="text-xl font-bold text-emerald-400 mt-0.5">
            {healthyCount} / {agents.length}
          </div>
          <span className="text-[10px] text-slate-400">8 online · 8 down/unhealthy</span>
        </div>

        <div className="bg-[#131826] p-3.5 rounded-xl border border-slate-800">
          <span className="text-[10px] uppercase text-slate-500">Avg Route Latency</span>
          <div className="text-xl font-bold text-amber-400 mt-0.5">{metrics.avgLatencyMs} ms</div>
          <span className="text-[10px] text-slate-400">p95: {metrics.p95LatencyMs} ms</span>
        </div>

        <div className="bg-[#131826] p-3.5 rounded-xl border border-slate-800">
          <span className="text-[10px] uppercase text-slate-500">Cost Savings</span>
          <div className="text-xl font-bold text-purple-400 mt-0.5">
            {metrics.costSavingsPercent}%
          </div>
          <span className="text-[10px] text-slate-400">Tiered local dispatch</span>
        </div>

        <div className="bg-[#131826] p-3.5 rounded-xl border border-slate-800">
          <span className="text-[10px] uppercase text-slate-500">Total Routed</span>
          <div className="text-xl font-bold text-white mt-0.5">{metrics.totalRequests}</div>
          <span className="text-[10px] text-emerald-400">Zero dropped requests</span>
        </div>
      </div>

      {/* ── Real-Time D3.js Telemetry Line Chart ── */}
      <OmniRouteD3Chart
        data={timeSeries}
        isStreaming={isSimulating}
        onToggleStreaming={toggleSim}
        latencyThreshold={latencyThreshold}
        onLatencyThresholdChange={setLatencyThreshold}
        visibleAgents={visibleAgents}
        onToggleAgentVisibility={(key) =>
          setVisibleAgents((prev) => ({ ...prev, [key]: !prev[key] }))
        }
        onSelectAllAgents={() =>
          setVisibleAgents({
            claude: true,
            python: true,
            hermes: true,
            node: true,
            codex: true,
            others: true,
          })
        }
        onDeselectAllAgents={() =>
          setVisibleAgents({
            claude: false,
            python: false,
            hermes: false,
            node: false,
            codex: false,
            others: false,
          })
        }
      />

      {/* ── Test Intent Dispatcher & Real-time Evaluation ── */}
      <div className="rounded-xl border border-cyan-500/30 bg-[#0c1222] p-4 space-y-3 shadow-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bot size={16} className="text-cyan-400" />
            <span className="text-xs font-bold uppercase tracking-wider text-cyan-300">
              Interactive OmniRouter Dispatch Test
            </span>
          </div>
          <span className="text-[11px] text-slate-400 font-mono">
            Simulates request distribution & candidate scoring
          </span>
        </div>

        <div className="flex flex-wrap gap-2">
          {[
            'Refactor AST parser in TypeScript',
            'Deep mathematical logic proof',
            'Branch git merge conflict resolve',
            'Python asyncio event loop benchmark',
            'Offline local inference script',
          ].map((intent) => (
            <button
              key={intent}
              onClick={() => handleDispatch(intent)}
              className="px-2.5 py-1 rounded-lg text-[11px] font-mono bg-surface/50 hover:bg-cyan-500/20 text-slate-300 hover:text-cyan-300 border border-slate-700 hover:border-cyan-500/50 transition cursor-pointer"
            >
              {intent}
            </button>
          ))}
        </div>

        <div className="flex gap-2">
          <input
            type="text"
            value={testIntent}
            onChange={(e) => setTestIntent(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleDispatch()}
            placeholder="Type custom task intent to route across the 16 agent brains..."
            className="flex-1 bg-[#050914] border border-slate-700/80 rounded-xl px-3 py-2 text-xs font-mono text-white placeholder:text-slate-500 outline-none focus:border-cyan-500/60"
          />
          <button
            onClick={() => handleDispatch()}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs shadow-lg shadow-cyan-500/20 transition cursor-pointer"
          >
            <Send size={13} />
            <span>Route Request</span>
          </button>
        </div>

        {lastDecision && (
          <div className="mt-3 p-3 bg-[#050914] rounded-xl border border-cyan-500/40 text-xs font-mono space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2">
              <div className="flex items-center gap-2">
                <span className="text-slate-400">WINNING AGENT:</span>
                <span className="px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 font-bold border border-cyan-500/40">
                  {lastDecision.selectedAgent.name}
                </span>
                <span className="text-[10px] text-emerald-400">
                  Score: {lastDecision.confidenceScore}%
                </span>
              </div>
              <div className="flex items-center gap-3 text-[11px] text-slate-400">
                <span>Latency: {lastDecision.estimatedLatencyMs}ms</span>
                <span>Cost: ${lastDecision.estimatedCost.toFixed(5)}</span>
                <span>Circuit: {lastDecision.circuitBreakerStatus}</span>
              </div>
            </div>
            <div className="text-[11px] text-slate-300">
              <span className="text-slate-500 font-semibold">Rationale: </span>
              {lastDecision.rationale}
            </div>
            <div className="flex items-center gap-2 text-[10px] text-slate-400 pt-1">
              <span className="text-slate-500">Fallback Chain:</span>
              {lastDecision.fallbackChain.map((fb, i) => (
                <span key={fb.id} className="flex items-center gap-1 text-slate-300">
                  {i > 0 && <span className="text-slate-600">→</span>}
                  <span className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700">
                    {fb.name}
                  </span>
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Main Grid: 16 Agents Load Distribution + Live Traffic Telemetry Stream ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 flex-1 min-h-0">
        {/* Left Column: 16 Discovered Agent Heatmap & Load Share (7 cols) */}
        <div className="lg:col-span-7 flex flex-col rounded-xl border border-slate-800 bg-[#0b0f1a] p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Layers size={15} className="text-cyan-400" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200">
                16 Discovered Agent Nodes · Traffic Distribution
              </h3>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono text-slate-400">
                {totalTraffic} Total Dispatches
              </span>
              <button
                onClick={() => setShowDiagnosticOverlay(true)}
                className="flex items-center gap-1 px-2 py-0.5 rounded bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-300 border border-cyan-500/30 text-[10px] font-mono transition cursor-pointer"
                title="Expand full diagnostic table"
              >
                <Maximize2 size={10} />
                <span>Full Matrix</span>
              </button>
            </div>
          </div>

          <div className="overflow-y-auto max-h-[380px] pr-1 space-y-2 font-mono text-xs">
            {agents.map((agent) => {
              const sharePercent = totalTraffic > 0 ? Math.round((agent.totalRouted / totalTraffic) * 100) : 0;
              const isDown = agent.status === 'down';
              const isUnhealthy = agent.status === 'unhealthy';

              return (
                <div
                  key={agent.id}
                  className={`p-2.5 rounded-lg border transition-all ${
                    isDown
                      ? 'bg-rose-950/15 border-rose-900/40 text-slate-400'
                      : isUnhealthy
                        ? 'bg-amber-950/15 border-amber-900/40 text-slate-300'
                        : 'bg-[#121829] border-slate-800 hover:border-cyan-500/40 text-white'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <span
                        className={`w-2 h-2 rounded-full ${
                          isDown
                            ? 'bg-rose-500'
                            : isUnhealthy
                              ? 'bg-amber-400'
                              : 'bg-emerald-400 animate-pulse'
                        }`}
                      />
                      <span className="font-bold text-xs">{agent.name}</span>
                      <span className="text-[10px] text-slate-500">[{agent.runtime}]</span>
                    </div>

                    <div className="flex items-center gap-2 text-[10px]">
                      <span className="text-cyan-300">{agent.latencyMs}ms</span>
                      <span className="text-slate-400">|</span>
                      <span className="text-slate-300">{agent.totalRouted} reqs</span>
                      <span
                        className={`px-1.5 py-0.5 rounded uppercase font-bold text-[9px] ${
                          isDown
                            ? 'bg-rose-500/20 text-rose-400'
                            : isUnhealthy
                              ? 'bg-amber-500/20 text-amber-400'
                              : 'bg-emerald-500/20 text-emerald-400'
                        }`}
                      >
                        {agent.status}
                      </span>
                    </div>
                  </div>

                  {/* Load bar */}
                  <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all duration-300 ${
                        isDown
                          ? 'bg-rose-500/40'
                          : isUnhealthy
                            ? 'bg-amber-500'
                            : 'bg-gradient-to-r from-cyan-400 to-indigo-500'
                      }`}
                      style={{ width: `${Math.max(4, sharePercent * 2.5)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column: Live Real-Time Routing Stream (5 cols) */}
        <div className="lg:col-span-5 flex flex-col rounded-xl border border-slate-800 bg-[#080c16] p-4 space-y-3 font-mono">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <div className="flex items-center gap-2">
              <Terminal size={14} className="text-emerald-400" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                Live Traffic Telemetry Feed
              </h3>
            </div>
            <span className="text-[10px] text-slate-500">Active Buffer: 50</span>
          </div>

          <div className="flex-1 overflow-y-auto max-h-[380px] space-y-2 text-[11px] pr-1">
            {trafficHistory.length === 0 ? (
              <div className="text-slate-500 text-center py-8">Waiting for routing traffic...</div>
            ) : (
              trafficHistory.map((item) => (
                <div
                  key={item.requestId}
                  className="p-2 bg-[#0d1322] border border-slate-800/80 rounded-lg space-y-1 hover:border-cyan-500/30 transition-all"
                >
                  <div className="flex items-center justify-between text-[10px]">
                    <div className="flex items-center gap-1.5">
                      <span className="text-slate-500">{item.timestamp}</span>
                      <span className="px-1.5 py-0.2 rounded bg-emerald-500/15 text-emerald-400 font-bold">
                        ROUTED
                      </span>
                      <span className="text-cyan-300 font-bold truncate max-w-[110px]">
                        {item.selectedAgent.name}
                      </span>
                    </div>
                    <span className="text-amber-300">{item.estimatedLatencyMs}ms</span>
                  </div>
                  <div className="text-slate-300 truncate text-[10px]">
                    {item.intent}
                  </div>
                  <div className="flex items-center justify-between text-[9px] text-slate-500">
                    <span>Strategy: {item.strategy}</span>
                    <span>Cost: ${item.estimatedCost.toFixed(5)}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* ── 16-Agent Full Diagnostic Overlay Modal ── */}
      {showDiagnosticOverlay && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="w-full max-w-7xl h-[90vh] flex flex-col">
            <OmniRouteDiagnosticPanel
              agents={agents}
              metrics={metrics}
              isOverlay={true}
              onCloseOverlay={() => setShowDiagnosticOverlay(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
};
