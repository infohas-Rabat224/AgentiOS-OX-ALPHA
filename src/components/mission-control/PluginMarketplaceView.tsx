import React, { useState } from 'react';
import {
  Boxes,
  Search,
  CheckCircle2,
  ShieldCheck,
  Zap,
  Terminal,
  Globe,
  Database,
  GitBranch,
  Lock,
  Download,
  Settings,
  ExternalLink
} from 'lucide-react';

interface PluginItem {
  id: string;
  name: string;
  description: string;
  category: 'devtools' | 'security' | 'web' | 'data' | 'integrations';
  version: string;
  author: string;
  isInstalled: boolean;
  isEnabled: boolean;
  securityScore: string;
  permissions: string[];
  icon: any;
}

const INITIAL_PLUGINS: PluginItem[] = [
  {
    id: 'p-playwright',
    name: 'Playwright Headless Browser',
    description: 'Enables agents to navigate web apps, capture DOM snapshots, take screenshots, and evaluate client-side JavaScript.',
    category: 'web',
    version: 'v1.42.0',
    author: 'AgenticOS Core',
    isInstalled: true,
    isEnabled: true,
    securityScore: 'A+ (Sandboxed)',
    permissions: ['Network Egress', 'Chromium Subprocess'],
    icon: Globe
  },
  {
    id: 'p-microvm',
    name: 'MicroVM Python Sandbox',
    description: 'Kernel-level hypervisor jail to safely execute untrusted Python code, run tests, and benchmark performance with CPU/RAM limits.',
    category: 'security',
    version: 'v2.1.0',
    author: 'AgenticOS Security',
    isInstalled: true,
    isEnabled: true,
    securityScore: 'A+ (Rootless Jail)',
    permissions: ['MicroVM Hypervisor', 'Isolated VFS'],
    icon: ShieldCheck
  },
  {
    id: 'p-git',
    name: 'Git Autonomous Operator',
    description: 'Automated branch switching, semantic git diff evaluation, conflict resolution, and authenticated commit signing.',
    category: 'devtools',
    version: 'v3.0.4',
    author: 'AgenticOS DevTools',
    isInstalled: true,
    isEnabled: true,
    securityScore: 'A (Audited)',
    permissions: ['Git CLI', 'SSH Keyring'],
    icon: GitBranch
  },
  {
    id: 'p-docker',
    name: 'Docker Container Runtime',
    description: 'Allows agents to orchestrate multi-container microservices, inspect docker-compose topologies, and pull OCI images.',
    category: 'devtools',
    version: 'v24.0.7',
    author: 'Docker Inc.',
    isInstalled: true,
    isEnabled: false,
    securityScore: 'A- (Socket Guard)',
    permissions: ['Docker Unix Socket'],
    icon: Terminal
  },
  {
    id: 'p-postgres',
    name: 'PostgreSQL & CloudSQL Inspector',
    category: 'data',
    description: 'Direct introspection of relational database schemas, query execution plans, and automated index recommendation.',
    version: 'v1.1.2',
    author: 'AgenticOS Data',
    isInstalled: true,
    isEnabled: true,
    securityScore: 'A+ (Read-Only Pool)',
    permissions: ['TCP Socket (Port 5432)'],
    icon: Database
  },
  {
    id: 'p-cve-scanner',
    name: 'Zero-Day Vulnerability Scanner',
    description: 'Continuous CVE detection, dependency advisory analysis, and automated security patch synthesis.',
    category: 'security',
    version: 'v1.0.8',
    author: 'OSV / Trivy Core',
    isInstalled: false,
    isEnabled: false,
    securityScore: 'A+ (Deterministic)',
    permissions: ['Read-only Manifests'],
    icon: Lock
  }
];

export const PluginMarketplaceView: React.FC = () => {
  const [plugins, setPlugins] = useState<PluginItem[]>(INITIAL_PLUGINS);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<string>('all');

  const filtered = plugins.filter((p) => {
    const matchesCat = category === 'all' || p.category === category;
    const matchesQuery =
      search.trim() === '' ||
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.description.toLowerCase().includes(search.toLowerCase());
    return matchesCat && matchesQuery;
  });

  const handleToggleEnable = (id: string) => {
    setPlugins((prev) =>
      prev.map((p) => (p.id === id ? { ...p, isEnabled: !p.isEnabled } : p))
    );
  };

  const handleInstall = (id: string) => {
    setPlugins((prev) =>
      prev.map((p) => (p.id === id ? { ...p, isInstalled: true, isEnabled: true } : p))
    );
  };

  return (
    <div className="space-y-4 p-4 font-mono text-xs">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-[#0d121f] p-3.5 rounded-2xl border border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
            <Boxes size={18} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-white tracking-wide uppercase">Plugin Marketplace</h2>
              <span className="px-2 py-0.5 rounded text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/30 font-semibold">
                SANDBOXED EXTENSIONS
              </span>
            </div>
            <p className="text-[11px] text-slate-400 font-sans mt-0.5">
              Equip discovered agent runtimes with audited toolkits, browser automations, and container runtimes.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[11px] text-slate-400">
            Active: <strong className="text-emerald-400">{plugins.filter((p) => p.isEnabled).length}</strong> / {plugins.length}
          </span>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-[#0a0f1d] p-3 rounded-2xl border border-slate-800">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search plugins by name, capabilities, or permissions..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-[#12182b] border border-slate-700/80 rounded-xl pl-9 pr-4 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 text-xs"
          />
        </div>

        <div className="flex items-center gap-1.5 bg-[#12182b] p-1 rounded-xl border border-slate-800 shrink-0 overflow-x-auto">
          {['all', 'security', 'web', 'devtools', 'data'].map((cat) => (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              className={`px-2.5 py-1 rounded-lg uppercase text-[10px] font-bold transition cursor-pointer whitespace-nowrap ${
                category === cat
                  ? 'bg-amber-500 text-slate-950 font-bold shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Plugin Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
        {filtered.map((plugin) => {
          const Icon = plugin.icon;
          return (
            <div
              key={plugin.id}
              className={`p-4 rounded-2xl border transition-all flex flex-col justify-between space-y-3 ${
                plugin.isEnabled
                  ? 'border-slate-700 bg-[#0a0f1d] shadow-lg shadow-black/40'
                  : 'border-slate-800/80 bg-[#080c16] opacity-80'
              }`}
            >
              <div className="space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-amber-500/15 text-amber-400 border border-amber-500/30 flex items-center justify-center shrink-0">
                      <Icon size={16} />
                    </div>
                    <div>
                      <h4 className="font-bold text-white text-xs">{plugin.name}</h4>
                      <span className="text-[10px] text-slate-400 font-sans">
                        {plugin.version} · by {plugin.author}
                      </span>
                    </div>
                  </div>

                  <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                    {plugin.securityScore}
                  </span>
                </div>

                <p className="text-[11px] text-slate-300 font-sans leading-relaxed line-clamp-3">
                  {plugin.description}
                </p>

                {/* Permissions tag cloud */}
                <div className="flex flex-wrap gap-1 pt-1">
                  {plugin.permissions.map((perm) => (
                    <span
                      key={perm}
                      className="px-1.5 py-0.2 rounded text-[9px] bg-[#12182b] text-slate-400 border border-slate-800"
                    >
                      {perm}
                    </span>
                  ))}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="border-t border-slate-800/80 pt-3 flex items-center justify-between">
                <span className="text-[10px] text-slate-500 uppercase">{plugin.category}</span>

                {plugin.isInstalled ? (
                  <button
                    onClick={() => handleToggleEnable(plugin.id)}
                    className={`px-3 py-1 rounded-xl text-[10px] font-bold border transition cursor-pointer flex items-center gap-1.5 ${
                      plugin.isEnabled
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 hover:bg-emerald-500/30'
                        : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700'
                    }`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        plugin.isEnabled ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'
                      }`}
                    />
                    <span>{plugin.isEnabled ? 'Enabled' : 'Disabled'}</span>
                  </button>
                ) : (
                  <button
                    onClick={() => handleInstall(plugin.id)}
                    className="px-3 py-1 rounded-xl text-[10px] font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 transition cursor-pointer flex items-center gap-1"
                  >
                    <Download size={11} />
                    <span>Install Plugin</span>
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
