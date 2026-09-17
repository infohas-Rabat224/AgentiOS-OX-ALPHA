import React from 'react';
import { GitBranch, Cpu, Zap, ShieldAlert, BarChart3, Code2, Layers, BookOpen, Download, Activity } from 'lucide-react';

interface HeaderProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onExportReport: () => void;
}

export const Header: React.FC<HeaderProps> = ({ activeTab, setActiveTab, onExportReport }) => {
  const navItems = [
    { id: 'live-kernel', label: 'Live OS Control Plane', icon: Activity, live: true },
    { id: 'overview', label: 'Bottleneck Matrix', icon: ShieldAlert, count: 8 },
    { id: 'deep-dive', label: 'Subsystem Deep Dive', icon: Layers },
    { id: 'benchmarks', label: 'Benchmark Profiler', icon: BarChart3 },
    { id: 'blueprints', label: 'Architectural Blueprints', icon: Zap },
    { id: 'diffs', label: 'Code Fixes & Diffs', icon: Code2 },
    { id: 'repo', label: 'Repository Explorer', icon: BookOpen },
  ];

  return (
    <header className="border-b border-slate-200 bg-white sticky top-0 z-30 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-lg bg-slate-900 text-emerald-400 flex items-center justify-center font-mono font-bold text-lg shadow-sm">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="text-base font-semibold text-slate-900 tracking-tight">
                  AgenticOS Core Performance Debugger
                </h1>
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <GitBranch className="w-3 h-3 mr-1" />
                  rachidSabah/AgenticosHybrid
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Clean Architecture Kernel Forensic Audit & Optimization Suite
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={onExportReport}
              className="inline-flex items-center px-3 py-1.5 rounded-md text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 transition-colors shadow-2xs cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 mr-1.5 text-slate-600" />
              Export Forensic Report (.md)
            </button>
            <div className="hidden sm:flex items-center space-x-1.5 px-2.5 py-1 bg-amber-50 border border-amber-200 rounded-md text-amber-800 text-xs">
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
              <span className="font-medium">2 Critical Deadlock / Busy-Spins Found</span>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex space-x-1 overflow-x-auto no-scrollbar border-t border-slate-100 py-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`flex items-center space-x-2 px-3.5 py-2 text-xs font-medium rounded-md whitespace-nowrap transition-colors cursor-pointer ${
                  isActive
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-emerald-400' : 'text-slate-400'}`} />
                <span>{item.label}</span>
                {(item as any).live && (
                  <span className="relative flex h-2 w-2 ml-1">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                )}
                {item.count !== undefined && (
                  <span
                    className={`ml-1.5 px-1.5 py-0.2 rounded-full text-[10px] ${
                      isActive ? 'bg-slate-800 text-emerald-300' : 'bg-slate-200 text-slate-700'
                    }`}
                  >
                    {item.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </header>
  );
};
