import React, { useState } from 'react';
import { BOTTLENECK_ITEMS } from '../data/bottlenecksData';
import { BottleneckItem } from '../types';
import { Layers, AlertTriangle, CheckCircle, Code2, ArrowRight, Zap, Shield, FileText } from 'lucide-react';

interface SubsystemDeepDiveProps {
  selectedBottleneck: BottleneckItem | null;
  onSelectBottleneck: (item: BottleneckItem) => void;
  onNavigateTab: (tab: string) => void;
}

export const SubsystemDeepDive: React.FC<SubsystemDeepDiveProps> = ({
  selectedBottleneck,
  onSelectBottleneck,
  onNavigateTab,
}) => {
  const currentItem = selectedBottleneck || BOTTLENECK_ITEMS[0];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      {/* Sidebar List */}
      <div className="lg:col-span-4 space-y-2">
        <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-1 mb-2">
          Subsystem Forensics ({BOTTLENECK_ITEMS.length})
        </div>
        <div className="space-y-1.5 max-h-[780px] overflow-y-auto pr-1">
          {BOTTLENECK_ITEMS.map((item) => {
            const isSelected = item.id === currentItem.id;
            return (
              <button
                key={item.id}
                onClick={() => onSelectBottleneck(item)}
                className={`w-full text-left p-3 rounded-lg border transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                    : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span
                    className={`text-[10px] font-mono uppercase px-1.5 py-0.5 rounded font-medium ${
                      isSelected
                        ? 'bg-slate-800 text-emerald-400'
                        : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {item.subsystem}
                  </span>
                  <span
                    className={`text-[10px] font-bold ${
                      item.severity === 'CRITICAL'
                        ? isSelected ? 'text-rose-400' : 'text-rose-600'
                        : item.severity === 'HIGH'
                        ? isSelected ? 'text-amber-400' : 'text-amber-600'
                        : isSelected ? 'text-blue-400' : 'text-blue-600'
                    }`}
                  >
                    {item.severity}
                  </span>
                </div>
                <div className="text-xs font-semibold line-clamp-1">
                  {item.title}
                </div>
                <div className="text-[11px] opacity-70 truncate mt-0.5 font-mono">
                  {item.filePath.split(' ')[0]}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Forensic Analysis Panel */}
      <div className="lg:col-span-8 space-y-5">
        {/* Header Card */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-2xs space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
            <div className="flex items-center space-x-2">
              <span
                className={`px-2.5 py-0.5 rounded text-xs font-bold ${
                  currentItem.severity === 'CRITICAL'
                    ? 'bg-rose-100 text-rose-800 border border-rose-200'
                    : currentItem.severity === 'HIGH'
                    ? 'bg-amber-100 text-amber-800 border border-amber-200'
                    : 'bg-blue-100 text-blue-800 border border-blue-200'
                }`}
              >
                {currentItem.severity} VULNERABILITY
              </span>
              <span className="text-xs font-mono text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                Subsystem: {currentItem.subsystem}
              </span>
            </div>
            <div className="text-xs text-emerald-700 font-mono font-bold bg-emerald-50 px-2.5 py-1 rounded border border-emerald-200">
              Impact: {currentItem.speedupMultiplier}
            </div>
          </div>

          <div>
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">
              {currentItem.title}
            </h2>
            <div className="flex items-center space-x-2 mt-1.5 text-xs text-slate-500 font-mono">
              <FileText className="w-3.5 h-3.5 text-slate-400" />
              <span>Target: {currentItem.filePath}</span>
              <span>•</span>
              <span className="text-indigo-600 font-semibold">Lines: {currentItem.lineNumbers}</span>
            </div>
          </div>

          <p className="text-sm text-slate-700 leading-relaxed bg-slate-50 p-3.5 rounded-lg border border-slate-100">
            {currentItem.summary}
          </p>

          {/* Forensic Diagnostic Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            <div className="border border-slate-200 rounded-lg p-3.5 space-y-1.5 bg-white">
              <div className="flex items-center text-xs font-semibold text-rose-700">
                <AlertTriangle className="w-3.5 h-3.5 mr-1.5 text-rose-600" />
                Root Cause Analysis
              </div>
              <p className="text-xs text-slate-600 leading-normal">
                {currentItem.rootCause}
              </p>
            </div>

            <div className="border border-slate-200 rounded-lg p-3.5 space-y-1.5 bg-white">
              <div className="flex items-center text-xs font-semibold text-amber-800">
                <Shield className="w-3.5 h-3.5 mr-1.5 text-amber-600" />
                Concurrency & Lock Hazards
              </div>
              <p className="text-xs text-slate-600 leading-normal">
                {currentItem.concurrencyRisk}
              </p>
            </div>

            <div className="border border-slate-200 rounded-lg p-3.5 space-y-1.5 bg-white">
              <div className="flex items-center text-xs font-semibold text-slate-800">
                <Layers className="w-3.5 h-3.5 mr-1.5 text-slate-600" />
                Runtime Resource Waste
              </div>
              <p className="text-xs text-slate-600 leading-normal">
                {currentItem.resourceWaste}
              </p>
            </div>

            <div className="border border-slate-200 rounded-lg p-3.5 space-y-1.5 bg-white">
              <div className="flex items-center text-xs font-semibold text-emerald-800">
                <Zap className="w-3.5 h-3.5 mr-1.5 text-emerald-600" />
                Architectural Remedy
              </div>
              <p className="text-xs text-slate-600 leading-normal">
                {currentItem.architectureFix}
              </p>
            </div>
          </div>
        </div>

        {/* Code Comparison Card */}
        <div className="bg-slate-950 rounded-xl p-5 border border-slate-800 text-white space-y-4 shadow-md">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Code2 className="w-4 h-4 text-emerald-400" />
              <h3 className="text-sm font-semibold tracking-tight text-slate-200">
                Source Code Bottleneck vs Architectural Fix
              </h3>
            </div>
            <button
              onClick={() => onNavigateTab('diffs')}
              className="text-xs text-emerald-400 hover:text-emerald-300 flex items-center font-medium cursor-pointer"
            >
              Open Full Diff Viewer
              <ArrowRight className="w-3.5 h-3.5 ml-1" />
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between text-xs text-rose-400 font-mono mb-1.5 px-1">
                <span>🔴 Current Flawed Implementation</span>
                <span className="text-[11px] text-slate-500">{currentItem.filePath}</span>
              </div>
              <pre className="p-3.5 rounded-lg bg-slate-900 border border-rose-900/40 text-rose-200 font-mono text-xs overflow-x-auto leading-relaxed">
                <code>{currentItem.originalCodeSnippet}</code>
              </pre>
            </div>

            <div>
              <div className="flex items-center justify-between text-xs text-emerald-400 font-mono mb-1.5 px-1">
                <span>🟢 Recommended Production Architecture</span>
                <span className="text-[11px] text-emerald-500/80 font-bold">{currentItem.speedupMultiplier}</span>
              </div>
              <pre className="p-3.5 rounded-lg bg-slate-900 border border-emerald-900/40 text-emerald-200 font-mono text-xs overflow-x-auto leading-relaxed">
                <code>{currentItem.optimizedCodeSnippet}</code>
              </pre>
            </div>
          </div>

          <div className="bg-slate-900/90 p-3 rounded-lg border border-slate-800 text-xs text-slate-300 flex items-start space-x-2.5">
            <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-white">Optimization Summary: </span>
              {currentItem.optimizationSummary}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
