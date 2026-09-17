import React, { useState } from 'react';
import { BOTTLENECK_ITEMS } from '../data/bottlenecksData';
import { BottleneckItem } from '../types';
import { Code2, Copy, Check, ArrowRight, ShieldAlert, Sparkles } from 'lucide-react';

interface CodeComparatorProps {
  selectedBottleneck: BottleneckItem | null;
  onSelectBottleneck: (item: BottleneckItem) => void;
}

export const CodeComparator: React.FC<CodeComparatorProps> = ({
  selectedBottleneck,
  onSelectBottleneck,
}) => {
  const currentItem = selectedBottleneck || BOTTLENECK_ITEMS[0];
  const [copiedOriginal, setCopiedOriginal] = useState(false);
  const [copiedOptimized, setCopiedOptimized] = useState(false);

  const handleCopy = (text: string, type: 'original' | 'optimized') => {
    navigator.clipboard.writeText(text);
    if (type === 'original') {
      setCopiedOriginal(true);
      setTimeout(() => setCopiedOriginal(false), 2000);
    } else {
      setCopiedOptimized(true);
      setTimeout(() => setCopiedOptimized(false), 2000);
    }
  };

  return (
    <div className="space-y-6">
      {/* Selector Header */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2">
              <span className="px-2.5 py-0.5 rounded text-xs font-mono font-medium bg-slate-900 text-white">
                CODE DIFF COMPARATOR
              </span>
              <span className="text-xs text-slate-500 font-mono">
                Exact Source References
              </span>
            </div>
            <h2 className="text-lg font-bold text-slate-900 tracking-tight mt-1">
              Side-by-Side Architectural Code Refactoring
            </h2>
          </div>

          <div className="flex items-center space-x-2">
            <span className="text-xs text-slate-500 font-medium">Select Bottleneck:</span>
            <select
              value={currentItem.id}
              onChange={(e) => {
                const found = BOTTLENECK_ITEMS.find((b) => b.id === e.target.value);
                if (found) onSelectBottleneck(found);
              }}
              className="text-xs border border-slate-300 rounded-md px-3 py-1.5 bg-slate-50 font-medium focus:bg-white focus:outline-hidden"
            >
              {BOTTLENECK_ITEMS.map((item) => (
                <option key={item.id} value={item.id}>
                  [{item.severity}] {item.title}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Info Banner */}
        <div className="mt-4 p-3 bg-slate-50 rounded-lg border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between text-xs gap-2">
          <div className="flex items-center space-x-2">
            <span className="font-semibold text-slate-800">Target File:</span>
            <code className="text-indigo-700 font-mono bg-white px-1.5 py-0.5 rounded border border-slate-200">
              {currentItem.filePath}
            </code>
            <span className="text-slate-400 font-mono">Lines {currentItem.lineNumbers}</span>
          </div>
          <div className="font-mono font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
            Speedup: {currentItem.speedupMultiplier}
          </div>
        </div>
      </div>

      {/* Side-by-Side Diff Panels */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Left: Original Code */}
        <div className="bg-slate-950 rounded-xl border border-rose-900/50 shadow-md flex flex-col overflow-hidden">
          <div className="bg-slate-900 px-4 py-2.5 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span>
              <span className="text-xs font-semibold text-rose-400 font-mono">
                ORIGINAL: Bottlenecked Code
              </span>
            </div>
            <button
              onClick={() => handleCopy(currentItem.originalCodeSnippet, 'original')}
              className="text-[11px] text-slate-400 hover:text-white flex items-center space-x-1 cursor-pointer"
            >
              {copiedOriginal ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
              <span>{copiedOriginal ? 'Copied' : 'Copy'}</span>
            </button>
          </div>
          <div className="p-4 flex-1 overflow-x-auto bg-slate-950 font-mono text-xs text-rose-200 leading-relaxed">
            <pre>
              <code>{currentItem.originalCodeSnippet}</code>
            </pre>
          </div>
          <div className="bg-rose-950/40 p-3 border-t border-rose-900/40 text-xs text-rose-300">
            <strong>Defect: </strong> {currentItem.rootCause}
          </div>
        </div>

        {/* Right: Optimized Code */}
        <div className="bg-slate-950 rounded-xl border border-emerald-900/50 shadow-md flex flex-col overflow-hidden">
          <div className="bg-slate-900 px-4 py-2.5 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
              <span className="text-xs font-semibold text-emerald-400 font-mono flex items-center">
                <Sparkles className="w-3.5 h-3.5 mr-1" />
                OPTIMIZED: Non-blocking & Concurrent
              </span>
            </div>
            <button
              onClick={() => handleCopy(currentItem.optimizedCodeSnippet, 'optimized')}
              className="text-[11px] text-slate-400 hover:text-white flex items-center space-x-1 cursor-pointer"
            >
              {copiedOptimized ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
              <span>{copiedOptimized ? 'Copied' : 'Copy'}</span>
            </button>
          </div>
          <div className="p-4 flex-1 overflow-x-auto bg-slate-950 font-mono text-xs text-emerald-200 leading-relaxed">
            <pre>
              <code>{currentItem.optimizedCodeSnippet}</code>
            </pre>
          </div>
          <div className="bg-emerald-950/40 p-3 border-t border-emerald-900/40 text-xs text-emerald-300">
            <strong>Improvement: </strong> {currentItem.optimizationSummary}
          </div>
        </div>
      </div>
    </div>
  );
};
