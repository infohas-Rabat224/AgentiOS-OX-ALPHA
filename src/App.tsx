import React, { useState } from 'react';
import { MissionControlShell } from './components/mission-control/AppShell';
import { BottleneckOverview } from './components/BottleneckOverview';
import { SubsystemDeepDive } from './components/SubsystemDeepDive';
import { BenchmarkSimulator } from './components/BenchmarkSimulator';
import { ArchitectureBlueprint } from './components/ArchitectureBlueprint';
import { CodeComparator } from './components/CodeComparator';
import { RepoExplorer } from './components/RepoExplorer';
import { BOTTLENECK_ITEMS } from './data/bottlenecksData';
import { BottleneckItem } from './types';
import { ShieldCheck, GitBranch, Cpu, CheckCircle, FileDown } from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState<string>('brain');
  const [auditSubTab, setAuditSubTab] = useState<'overview' | 'deep-dive' | 'benchmarks' | 'blueprints' | 'diffs' | 'repo'>('overview');
  const [selectedBottleneck, setSelectedBottleneck] = useState<BottleneckItem | null>(BOTTLENECK_ITEMS[0]);

  const handleSelectBottleneck = (item: BottleneckItem) => {
    setSelectedBottleneck(item);
    setAuditSubTab('deep-dive');
  };

  return (
    <MissionControlShell activeTab={activeTab} setActiveTab={setActiveTab}>
      {/* Forensic Audit & Optimization Sub-views embedded under the Audit tab */}
      <div className="space-y-4">
        {/* Sub-tab navigation for Audit */}
        <div className="flex flex-wrap items-center justify-between gap-3 bg-[#0e121d] p-3 rounded-xl border border-slate-800">
          <div className="flex flex-wrap items-center gap-1.5 font-mono text-xs">
            {(
              [
                { id: 'overview', label: 'Bottlenecks Overview' },
                { id: 'deep-dive', label: 'Forensic Deep-Dive' },
                { id: 'benchmarks', label: 'Micro-Benchmarks' },
                { id: 'diffs', label: 'Code Comparisons' },
                { id: 'blueprints', label: 'Modernization Blueprints' },
                { id: 'repo', label: 'Repository Tree' },
              ] as const
            ).map((st) => (
              <button
                key={st.id}
                onClick={() => setAuditSubTab(st.id)}
                className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                  auditSubTab === st.id
                    ? 'bg-cyan-500/20 text-cyan-300 font-semibold border border-cyan-500/40'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                }`}
              >
                {st.label}
              </button>
            ))}
          </div>
          <span className="text-[11px] font-mono text-emerald-400 flex items-center">
            <ShieldCheck className="w-3.5 h-3.5 mr-1" />
            7 Subsystems Audited & Verified
          </span>
        </div>

        {/* Audit Sub-view Content */}
        <div className="mt-2 text-slate-900 bg-slate-50 rounded-2xl p-6 border border-slate-700 shadow-xl overflow-hidden">
          {auditSubTab === 'overview' && (
            <BottleneckOverview
              onSelectBottleneck={handleSelectBottleneck}
              onNavigateTab={(tab) => {
                if (tab === 'deep-dive' || tab === 'benchmarks' || tab === 'diffs' || tab === 'blueprints' || tab === 'repo') {
                  setAuditSubTab(tab as any);
                }
              }}
            />
          )}

          {auditSubTab === 'deep-dive' && (
            <SubsystemDeepDive
              selectedBottleneck={selectedBottleneck}
              onSelectBottleneck={setSelectedBottleneck}
              onNavigateTab={(tab) => {
                if (tab === 'overview' || tab === 'benchmarks' || tab === 'diffs') {
                  setAuditSubTab(tab as any);
                }
              }}
            />
          )}

          {auditSubTab === 'benchmarks' && <BenchmarkSimulator />}

          {auditSubTab === 'blueprints' && <ArchitectureBlueprint />}

          {auditSubTab === 'diffs' && (
            <CodeComparator
              selectedBottleneck={selectedBottleneck}
              onSelectBottleneck={setSelectedBottleneck}
            />
          )}

          {auditSubTab === 'repo' && <RepoExplorer />}
        </div>
      </div>
    </MissionControlShell>
  );
}

