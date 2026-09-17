import React, { useState } from 'react';
import { ARCHITECTURE_RECOMMENDATIONS } from '../data/bottlenecksData';
import { ArchitectureRecommendation } from '../types';
import { Layers, Zap, ShieldCheck, CheckCircle2, ArrowRight, GitCommit, Workflow, Server, Cpu } from 'lucide-react';

export const ArchitectureBlueprint: React.FC = () => {
  const [selectedTier, setSelectedTier] = useState<string>('ALL');

  const filteredRecs = ARCHITECTURE_RECOMMENDATIONS.filter((rec) => {
    return selectedTier === 'ALL' || rec.tier === selectedTier;
  });

  return (
    <div className="space-y-6">
      {/* Blueprint Header */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-2xs">
        <div className="max-w-3xl space-y-2">
          <div className="flex items-center space-x-2">
            <span className="px-2.5 py-0.5 rounded text-xs font-mono font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
              TARGET ARCHITECTURE PROPOSAL
            </span>
            <span className="text-xs text-slate-500">Kernel v2 Modernization</span>
          </div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">
            High-Performance Core Architecture Blueprints
          </h2>
          <p className="text-xs text-slate-600 leading-relaxed">
            To transform AgenticOS from an experimental framework into an enterprise-grade agent runtime, we designed architectural blueprints across the four core layers: Kernel Foundation, Routing Brain, DAG Execution, and Discovery.
          </p>
        </div>

        {/* Tier filter tabs */}
        <div className="flex space-x-2 pt-4 mt-4 border-t border-slate-100 overflow-x-auto no-scrollbar">
          {[
            { id: 'ALL', label: 'All Recommendations' },
            { id: 'KERNEL_TIER', label: 'Kernel Foundation (Bus / DI / Lifecycle)' },
            { id: 'EXECUTION_TIER', label: 'Execution Tier (DAG & Workflows)' },
            { id: 'ROUTING_TIER', label: 'Routing Tier (OmniRoute)' },
            { id: 'DISCOVERY_TIER', label: 'Discovery Tier (Local Scanners)' },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setSelectedTier(t.id)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition-colors cursor-pointer ${
                selectedTier === t.id
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Visual System Architecture Comparison */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Flawed Architecture Card */}
        <div className="bg-white border border-rose-200 rounded-xl p-5 shadow-2xs space-y-3">
          <div className="flex items-center space-x-2 text-rose-700 font-semibold text-xs border-b border-rose-100 pb-2">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span>
            <span>CURRENT ARCHITECTURE: Latency Traps & Lock Contention</span>
          </div>
          <div className="bg-slate-900 text-slate-200 rounded-lg p-3.5 font-mono text-[11px] leading-relaxed space-y-2 border border-slate-800">
            <div className="text-rose-400 font-bold">1. Event Dispatch:</div>
            <div className="pl-3 border-l-2 border-rose-800 text-slate-300">
              Publish Event → For each subscriber → <span className="text-rose-400">asyncio.create_task()</span> (Unbounded!) → Task Storm & GC Churn
            </div>
            <div className="text-rose-400 font-bold pt-1">2. DAG Execution Engine:</div>
            <div className="pl-3 border-l-2 border-rose-800 text-slate-300">
              Ready Queue Pop → Deps unmet? → <span className="text-rose-400">sleep(0.1) & Re-queue</span> (Busy-wait!) → Serial await stage() → <span className="text-rose-400">Enqueue duplicate downstream targets</span>
            </div>
            <div className="text-rose-400 font-bold pt-1">3. OmniRoute Locking:</div>
            <div className="pl-3 border-l-2 border-rose-800 text-slate-300">
              <span className="text-rose-400">async with self._lock:</span> → Update stats → <span className="text-rose-400">await self._publish()</span> (Deadlock hazard if listener queries health!)
            </div>
            <div className="text-rose-400 font-bold pt-1">4. DI Resolution:</div>
            <div className="pl-3 border-l-2 border-rose-800 text-slate-300">
              Resolve Service → <span className="text-rose-400">inspect.signature()</span> + <span className="text-rose-400">get_type_hints()</span> on EVERY call (48µs CPU reflection)
            </div>
          </div>
        </div>

        {/* Optimized Architecture Card */}
        <div className="bg-white border border-emerald-200 rounded-xl p-5 shadow-2xs space-y-3">
          <div className="flex items-center space-x-2 text-emerald-700 font-semibold text-xs border-b border-emerald-100 pb-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
            <span>PROPOSED ARCHITECTURE: Concurrent, Non-Blocking, Event-Driven</span>
          </div>
          <div className="bg-slate-900 text-slate-200 rounded-lg p-3.5 font-mono text-[11px] leading-relaxed space-y-2 border border-slate-800">
            <div className="text-emerald-400 font-bold">1. Bounded Worker Ring Buffer:</div>
            <div className="pl-3 border-l-2 border-emerald-800 text-slate-300">
              Publish Event → <span className="text-emerald-400">FIFO Queue (maxsize=10k)</span> → Dedicated 16 async workers consume → Strict order & backpressure
            </div>
            <div className="text-emerald-400 font-bold pt-1">2. In-Degree DAG with TaskGroup:</div>
            <div className="pl-3 border-l-2 border-emerald-800 text-slate-300">
              Stage completes → <span className="text-emerald-400">Decrement child in-degrees</span> → in_degree==0? Enqueue → <span className="text-emerald-400">asyncio.TaskGroup runs parallel branches</span> (Zero sleep!)
            </div>
            <div className="text-emerald-400 font-bold pt-1">3. Decoupled Lock Boundary:</div>
            <div className="pl-3 border-l-2 border-emerald-800 text-slate-300">
              Minimal synchronous critical section → Release lock → <span className="text-emerald-400">Publish events outside lock</span> (Deadlock impossible!)
            </div>
            <div className="text-emerald-400 font-bold pt-1">4. Pre-Compiled Constructor Slots:</div>
            <div className="pl-3 border-l-2 border-emerald-800 text-slate-300">
              Compile signature once at register() → <span className="text-emerald-400">__slots__ fast parameter array</span> → 0.8µs direct instantiate (59x speedup)
            </div>
          </div>
        </div>
      </div>

      {/* Blueprint Recommendations List */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-slate-900 flex items-center">
          <Zap className="w-4 h-4 mr-1.5 text-indigo-600" />
          Detailed Modernization Blueprints ({filteredRecs.length})
        </h3>

        <div className="grid grid-cols-1 gap-4">
          {filteredRecs.map((rec) => (
            <div
              key={rec.id}
              className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs hover:border-slate-300 transition-colors space-y-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
                <div className="flex items-center space-x-2">
                  <span className="px-2 py-0.5 rounded text-[11px] font-mono font-semibold bg-slate-900 text-white">
                    {rec.tier}
                  </span>
                  <h4 className="text-sm font-bold text-slate-900">{rec.title}</h4>
                </div>
                <div className="flex items-center space-x-2 text-xs">
                  <span className="text-slate-500">Risk:</span>
                  <span className="font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                    {rec.riskLevel}
                  </span>
                  <span className="text-slate-500 ml-2">Effort:</span>
                  <span className="font-semibold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                    {rec.implementationEffort}
                  </span>
                </div>
              </div>

              {/* Target Subsystems */}
              <div className="flex items-center space-x-2 text-xs font-mono text-slate-500">
                <span className="text-slate-400">Target Files:</span>
                {rec.targetSubsystems.map((sub, i) => (
                  <span key={i} className="bg-slate-100 px-1.5 py-0.5 rounded text-slate-700">
                    {sub}
                  </span>
                ))}
              </div>

              {/* Pattern Transition Comparison */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                <div className="bg-rose-50/70 p-3 rounded-lg border border-rose-100 space-y-1">
                  <div className="font-semibold text-rose-800">Current Pattern:</div>
                  <div className="text-slate-700 leading-relaxed">{rec.currentPattern}</div>
                </div>
                <div className="bg-emerald-50/70 p-3 rounded-lg border border-emerald-100 space-y-1">
                  <div className="font-semibold text-emerald-800">Recommended Pattern:</div>
                  <div className="text-slate-700 leading-relaxed">{rec.recommendedPattern}</div>
                </div>
              </div>

              {/* Key Benefits */}
              <div className="space-y-1.5 pt-1">
                <div className="text-xs font-semibold text-slate-700">Verified Architectural Benefits:</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  {rec.benefits.map((benefit, i) => (
                    <div key={i} className="flex items-start space-x-2 text-slate-600">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                      <span>{benefit}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
