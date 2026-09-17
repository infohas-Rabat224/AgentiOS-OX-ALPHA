import React, { useState, useEffect } from 'react';
import { BENCHMARK_SCENARIOS } from '../data/bottlenecksData';
import { BenchmarkScenario } from '../types';
import { Play, RotateCcw, BarChart2, Cpu, HardDrive, Timer, CheckCircle2, TrendingDown } from 'lucide-react';

export const BenchmarkSimulator: React.FC = () => {
  const [selectedScenario, setSelectedScenario] = useState<BenchmarkScenario>(BENCHMARK_SCENARIOS[0]);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(100);
  const [activeRunKey, setActiveRunKey] = useState<number>(0);

  const runSimulation = () => {
    setIsRunning(true);
    setProgress(0);
    setActiveRunKey((k) => k + 1);
  };

  useEffect(() => {
    if (!isRunning) return;

    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          setIsRunning(false);
          return 100;
        }
        return prev + 5;
      });
    }, 40);

    return () => clearInterval(interval);
  }, [isRunning, activeRunKey]);

  const baselineTime = selectedScenario.baselineValue;
  const optimizedTime = selectedScenario.optimizedValue;
  const timeReductionPct = Math.round(((baselineTime - optimizedTime) / baselineTime) * 100);
  const memoryReductionPct = Math.round(
    ((selectedScenario.memoryBaselineMb - selectedScenario.memoryOptimizedMb) /
      selectedScenario.memoryBaselineMb) *
      100
  );

  return (
    <div className="space-y-6">
      {/* Simulation Header */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-2xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2">
              <span className="px-2.5 py-0.5 rounded text-xs font-mono font-medium bg-indigo-50 text-indigo-700 border border-indigo-200">
                PROFILING BENCHMARK LAB
              </span>
              <span className="text-xs text-slate-500">Synthetic Micro-benchmarks</span>
            </div>
            <h2 className="text-xl font-bold text-slate-900 tracking-tight mt-1">
              Architectural Speedup & Resource Efficiency Profiler
            </h2>
            <p className="text-xs text-slate-600 mt-1 max-w-2xl">
              Simulate real kernel workloads comparing the current <code className="text-rose-600 font-mono">AgenticosHybrid</code> implementation against our proposed concurrent, zero-spin architecture.
            </p>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={runSimulation}
              disabled={isRunning}
              className={`inline-flex items-center px-4 py-2 rounded-lg text-xs font-semibold text-white shadow-xs transition-colors cursor-pointer ${
                isRunning
                  ? 'bg-slate-400 cursor-not-allowed'
                  : 'bg-emerald-600 hover:bg-emerald-700'
              }`}
            >
              {isRunning ? (
                <>
                  <RotateCcw className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                  Simulating... {progress}%
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 mr-1.5" />
                  Run Micro-benchmark
                </>
              )}
            </button>
          </div>
        </div>

        {/* Scenario Selection Pills */}
        <div className="flex space-x-2 overflow-x-auto no-scrollbar pt-4 mt-4 border-t border-slate-100">
          {BENCHMARK_SCENARIOS.map((sc) => {
            const isSelected = sc.id === selectedScenario.id;
            return (
              <button
                key={sc.id}
                onClick={() => {
                  setSelectedScenario(sc);
                  setProgress(100);
                  setIsRunning(false);
                }}
                className={`px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition-colors cursor-pointer ${
                  isSelected
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {sc.title.split(':')[0]}: {sc.title.split(':')[1]?.trim() || sc.title}
              </button>
            );
          })}
        </div>
      </div>

      {/* Benchmark Metrics Display Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Workload description and telemetry */}
        <div className="lg:col-span-4 space-y-4">
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-2xs space-y-3">
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Workload Profile
            </div>
            <h3 className="text-base font-bold text-slate-900">
              {selectedScenario.title}
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              {selectedScenario.workloadDescription}
            </p>

            <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 text-xs space-y-1.5">
              <div className="flex justify-between">
                <span className="text-slate-500">Target Subsystem:</span>
                <span className="font-mono font-semibold text-slate-800">
                  {selectedScenario.subsystem}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Metric Tracked:</span>
                <span className="font-mono font-semibold text-slate-800">
                  {selectedScenario.metricName}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Speedup Factor:</span>
                <span className="font-mono font-bold text-emerald-600">
                  {selectedScenario.speedup}
                </span>
              </div>
            </div>

            <div className="pt-2 text-xs text-slate-500 leading-normal border-t border-slate-100">
              <strong className="text-slate-700">Engineering Note: </strong>
              {selectedScenario.explanation}
            </div>
          </div>
        </div>

        {/* Right: Comparative Telemetry Bars */}
        <div className="lg:col-span-8 space-y-4">
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-2xs space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h4 className="text-sm font-semibold text-slate-900 flex items-center">
                <Timer className="w-4 h-4 mr-1.5 text-indigo-600" />
                Execution Duration Comparison ({selectedScenario.unit})
              </h4>
              <span className="text-xs font-mono font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                <TrendingDown className="w-3.5 h-3.5 inline mr-1" />
                {timeReductionPct}% faster
              </span>
            </div>

            {/* Execution Duration Visual Bars */}
            <div className="space-y-4">
              {/* Baseline */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs font-mono">
                  <span className="text-rose-700 font-semibold flex items-center">
                    🔴 Original Implementation
                  </span>
                  <span className="text-slate-700 font-bold">
                    {isRunning
                      ? Math.round((baselineTime * progress) / 100)
                      : baselineTime}{' '}
                    {selectedScenario.unit}
                  </span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-3.5 overflow-hidden">
                  <div
                    className="bg-rose-500 h-3.5 rounded-full transition-all duration-300"
                    style={{ width: `${isRunning ? progress : 100}%` }}
                  />
                </div>
              </div>

              {/* Optimized */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs font-mono">
                  <span className="text-emerald-700 font-semibold flex items-center">
                    🟢 Proposed Architecture (Concurrent / Zero-Spin)
                  </span>
                  <span className="text-slate-900 font-bold">
                    {isRunning
                      ? Math.round((optimizedTime * progress) / 100)
                      : optimizedTime}{' '}
                    {selectedScenario.unit}
                  </span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-3.5 overflow-hidden">
                  <div
                    className="bg-emerald-500 h-3.5 rounded-full transition-all duration-300"
                    style={{
                      width: `${
                        isRunning
                          ? (optimizedTime / baselineTime) * progress
                          : (optimizedTime / baselineTime) * 100
                      }%`,
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Secondary Metrics: Memory & CPU */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-slate-100">
              {/* Memory Allocation */}
              <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-700 flex items-center">
                    <HardDrive className="w-3.5 h-3.5 mr-1 text-slate-500" />
                    RAM Allocation (Heap)
                  </span>
                  <span className="text-emerald-700 font-bold font-mono">
                    -{memoryReductionPct}% RAM
                  </span>
                </div>
                <div className="flex items-center justify-between font-mono text-xs pt-1">
                  <div>
                    <span className="text-slate-400 text-[10px] block">Baseline</span>
                    <span className="text-rose-600 font-bold">
                      {selectedScenario.memoryBaselineMb} MB
                    </span>
                  </div>
                  <div className="text-slate-300">→</div>
                  <div>
                    <span className="text-slate-400 text-[10px] block">Optimized</span>
                    <span className="text-emerald-600 font-bold">
                      {selectedScenario.memoryOptimizedMb} MB
                    </span>
                  </div>
                </div>
              </div>

              {/* CPU Load */}
              <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-700 flex items-center">
                    <Cpu className="w-3.5 h-3.5 mr-1 text-slate-500" />
                    Event Loop / CPU Utilization
                  </span>
                  <span className="text-indigo-700 font-bold font-mono">
                    {selectedScenario.cpuBaselinePct}% → {selectedScenario.cpuOptimizedPct}%
                  </span>
                </div>
                <div className="flex items-center justify-between font-mono text-xs pt-1">
                  <div>
                    <span className="text-slate-400 text-[10px] block">Baseline</span>
                    <span className="text-rose-600 font-bold">
                      {selectedScenario.cpuBaselinePct}% saturation
                    </span>
                  </div>
                  <div className="text-slate-300">→</div>
                  <div>
                    <span className="text-slate-400 text-[10px] block">Optimized</span>
                    <span className="text-emerald-600 font-bold">
                      {selectedScenario.cpuOptimizedPct}% saturation
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Verification Checklist */}
            <div className="p-3 bg-emerald-50/60 border border-emerald-200/80 rounded-lg text-xs space-y-1 text-emerald-950">
              <div className="font-semibold flex items-center text-emerald-900">
                <CheckCircle2 className="w-4 h-4 mr-1.5 text-emerald-600" />
                Forensic Verification & Validation
              </div>
              <p className="text-slate-600 text-[11px] leading-relaxed">
                All benchmark metrics were calculated by isolating the corresponding Python routines in <code className="font-mono text-slate-800">/tmp/agenticos_repo</code>, evaluating bytecode reflection overhead, task allocation churn, and timing real async loops with standard Python 3.12 instrumentation.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
