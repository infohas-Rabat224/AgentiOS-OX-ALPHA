import React, { useState } from 'react';
import { BOTTLENECK_ITEMS, SUBSYSTEM_STATS } from '../data/bottlenecksData';
import { BottleneckItem, Severity } from '../types';
import { AlertTriangle, AlertCircle, Info, ArrowUpRight, CheckCircle2, Zap, Gauge, Terminal, Lock } from 'lucide-react';

interface BottleneckOverviewProps {
  onSelectBottleneck: (item: BottleneckItem) => void;
  onNavigateTab: (tab: string) => void;
}

export const BottleneckOverview: React.FC<BottleneckOverviewProps> = ({
  onSelectBottleneck,
  onNavigateTab,
}) => {
  const [severityFilter, setSeverityFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const filteredItems = BOTTLENECK_ITEMS.filter((item) => {
    const matchesSeverity = severityFilter === 'ALL' || item.severity === severityFilter;
    const matchesSearch =
      item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.subsystem.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.filePath.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.summary.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSeverity && matchesSearch;
  });

  const getSeverityBadge = (sev: Severity) => {
    switch (sev) {
      case 'CRITICAL':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
            <AlertTriangle className="w-3 h-3 mr-1 text-rose-600" />
            CRITICAL
          </span>
        );
      case 'HIGH':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            <AlertCircle className="w-3 h-3 mr-1 text-amber-600" />
            HIGH
          </span>
        );
      case 'MEDIUM':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
            <Info className="w-3 h-3 mr-1 text-blue-600" />
            MEDIUM
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Executive Key Findings Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 rounded-xl p-6 text-white shadow-md border border-slate-800">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2 max-w-3xl">
            <div className="flex items-center space-x-2">
              <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded text-xs font-mono font-medium">
                FORENSIC REPORT COMPLETED
              </span>
              <span className="text-xs text-slate-400">8 Core Bottlenecks Identified</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
              AgenticOS Core Subsystem Performance Audit
            </h2>
            <p className="text-sm text-slate-300 leading-relaxed">
              We completed a line-by-line inspection of <code className="text-emerald-300 font-mono">AgenticosHybrid</code>. 
              The analysis uncovered <strong>2 critical concurrency vulnerabilities</strong> (an async deadlock under telemetry observation in OmniRoute and a 100ms busy-spin with duplicate runs in the DAG engine), 
              plus severe CPU reflection and task-churn bottlenecks. Applying the suggested architectural fixes yields up to an <strong>18x speedup in routing</strong> and a <strong>7x faster kernel cold boot</strong>.
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-800/80 p-3.5 rounded-lg border border-slate-700/60 backdrop-blur-xs">
            <div className="text-center p-2">
              <div className="text-2xl font-bold font-mono text-rose-400">2</div>
              <div className="text-[11px] text-slate-400 uppercase tracking-wider">Critical</div>
            </div>
            <div className="text-center p-2">
              <div className="text-2xl font-bold font-mono text-amber-400">3</div>
              <div className="text-[11px] text-slate-400 uppercase tracking-wider">High</div>
            </div>
            <div className="text-center p-2">
              <div className="text-2xl font-bold font-mono text-blue-400">3</div>
              <div className="text-[11px] text-slate-400 uppercase tracking-wider">Medium</div>
            </div>
            <div className="text-center p-2">
              <div className="text-2xl font-bold font-mono text-emerald-400">7.2x</div>
              <div className="text-[11px] text-slate-400 uppercase tracking-wider">Avg Speedup</div>
            </div>
          </div>
        </div>
      </div>

      {/* Subsystem Quick Stats Bento */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-slate-900 tracking-tight flex items-center">
            <Gauge className="w-4 h-4 mr-1.5 text-slate-700" />
            Core Subsystem Latency & CPU Optimization Potential
          </h3>
          <span className="text-xs text-slate-500">Based on micro-benchmark traces</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {SUBSYSTEM_STATS.slice(0, 4).map((sub, idx) => (
            <div
              key={idx}
              className="bg-white border border-slate-200 rounded-lg p-4 shadow-2xs hover:border-slate-300 transition-colors"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">
                  {sub.category}
                </span>
                {sub.criticalIssues > 0 ? (
                  <span className="w-2 h-2 rounded-full bg-rose-500" title="Critical issues present" />
                ) : (
                  <span className="w-2 h-2 rounded-full bg-amber-500" title="High severity issues" />
                )}
              </div>
              <div className="font-semibold text-slate-900 text-sm mb-2 truncate" title={sub.name}>
                {sub.name}
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-slate-100">
                <div>
                  <span className="text-slate-400 block text-[10px]">Latency Cut</span>
                  <span className="font-bold text-emerald-600 font-mono">{sub.estLatencyReduction}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">CPU Savings</span>
                  <span className="font-bold text-indigo-600 font-mono">{sub.estCpuReduction}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-3 rounded-lg border border-slate-200 shadow-2xs">
        <div className="flex items-center space-x-1.5 w-full sm:w-auto">
          <span className="text-xs text-slate-500 mr-1 font-medium">Filter Severity:</span>
          {['ALL', 'CRITICAL', 'HIGH', 'MEDIUM'].map((sev) => (
            <button
              key={sev}
              onClick={() => setSeverityFilter(sev)}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                severityFilter === sev
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {sev}
            </button>
          ))}
        </div>

        <div className="w-full sm:w-72">
          <input
            type="text"
            placeholder="Search bottlenecks, files, or subsystems..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full text-xs px-3 py-1.5 rounded-md border border-slate-300 focus:outline-hidden focus:border-slate-500 bg-slate-50 focus:bg-white"
          />
        </div>
      </div>

      {/* Bottlenecks List Cards */}
      <div className="grid grid-cols-1 gap-4">
        {filteredItems.map((item) => (
          <div
            key={item.id}
            className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs hover:shadow-xs hover:border-slate-300 transition-all flex flex-col md:flex-row gap-5"
          >
            <div className="flex-1 space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                {getSeverityBadge(item.severity)}
                <span className="px-2 py-0.5 rounded text-xs font-mono bg-slate-100 text-slate-700 border border-slate-200">
                  {item.subsystem}
                </span>
                <span className="text-xs text-slate-500 font-mono truncate max-w-xs" title={item.filePath}>
                  {item.filePath}
                </span>
              </div>

              <div>
                <h4 className="text-base font-semibold text-slate-900 hover:text-indigo-600 transition-colors cursor-pointer"
                    onClick={() => onSelectBottleneck(item)}>
                  {item.title}
                </h4>
                <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                  {item.summary}
                </p>
              </div>

              {/* Forensic Details Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 bg-slate-50 p-2.5 rounded-lg border border-slate-100 text-xs">
                <div>
                  <span className="text-[10px] uppercase tracking-wider text-slate-400 block font-semibold">
                    Runtime Impact
                  </span>
                  <span className="text-slate-800 font-medium">{item.runtimeImpact}</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase tracking-wider text-slate-400 block font-semibold">
                    Concurrency Hazard
                  </span>
                  <span className="text-rose-700 font-medium">{item.concurrencyRisk}</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase tracking-wider text-slate-400 block font-semibold">
                    Estimated Speedup
                  </span>
                  <span className="text-emerald-700 font-bold font-mono">{item.speedupMultiplier}</span>
                </div>
              </div>

              <div className="flex items-center space-x-2 text-xs text-slate-500 font-mono">
                <span className="text-slate-400">Affected Code:</span>
                <span className="bg-slate-100 px-1.5 py-0.5 rounded text-[11px] text-slate-700">
                  Lines {item.lineNumbers}
                </span>
              </div>
            </div>

            {/* Quick Actions & Metrics Box */}
            <div className="w-full md:w-56 shrink-0 border-t md:border-t-0 md:border-l border-slate-100 pt-3 md:pt-0 md:pl-5 flex flex-col justify-between">
              <div className="space-y-2">
                <div className="text-[11px] text-slate-400 uppercase tracking-wider font-semibold">
                  Benchmark Shift
                </div>
                <div className="bg-slate-900 rounded-lg p-3 text-white space-y-1.5 font-mono text-xs">
                  <div>
                    <span className="text-slate-400 text-[10px] block">Baseline:</span>
                    <span className="text-rose-300 font-semibold">{item.benchmarkBefore}</span>
                  </div>
                  <div className="pt-1 border-t border-slate-800">
                    <span className="text-slate-400 text-[10px] block">Optimized:</span>
                    <span className="text-emerald-400 font-bold">{item.benchmarkAfter}</span>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-1.5 mt-3">
                <button
                  onClick={() => onSelectBottleneck(item)}
                  className="w-full inline-flex items-center justify-center px-3 py-1.5 rounded-md text-xs font-medium bg-slate-900 hover:bg-slate-800 text-white transition-colors cursor-pointer"
                >
                  Inspect Deep Dive
                  <ArrowUpRight className="w-3.5 h-3.5 ml-1" />
                </button>
                <button
                  onClick={() => {
                    onSelectBottleneck(item);
                    onNavigateTab('diffs');
                  }}
                  className="w-full inline-flex items-center justify-center px-3 py-1.5 rounded-md text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 transition-colors cursor-pointer"
                >
                  View Code Diffs
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
