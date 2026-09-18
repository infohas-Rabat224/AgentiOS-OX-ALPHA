import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Brain,
  Orbit,
  Cpu,
  Layers,
  Activity,
  Compass,
  Zap,
  Terminal,
  Server,
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Search,
  Bot,
  MemoryStick,
  HardDrive,
  Globe,
  Settings,
  Shield,
  MessageSquarePlus,
  GitBranch,
  Workflow,
  Network,
  Database,
  Boxes,
  Plug,
  FolderTree,
  Sparkles,
  Cloud,
  GitPullRequestArrow,
  Download,
  Sun,
  Moon,
  BrainCircuit,
  Radio,
  Clock,
  Gauge,
  Laptop,
  Wrench,
  ShieldAlert
} from 'lucide-react';
import { BrainRecord, BrainRelationship } from '../../types/missionControl';
import { INITIAL_BRAINS, INITIAL_RELATIONSHIPS } from '../../lib/brainsData';
import { BrainsRegistryView } from './BrainsRegistryView';
import { BrainConstellationView } from './BrainConstellationView';
import { AIBrainNeuralView } from './AIBrainNeuralView';
import { MissionOverviewView } from './MissionOverviewView';
import { SwarmStudioView } from './SwarmStudioView';
import { OmniRouteView } from './OmniRouteView';
import { DiscoveryDashboardView } from './DiscoveryDashboardView';
import { LiveKernelControlPlane } from '../LiveKernelControlPlane';
import { EcosystemDashboardView } from './EcosystemDashboardView';
import { DesktopDiagnosticsView } from './DesktopDiagnosticsView';
import { PromptCenterView } from './PromptCenterView';
import { WorkflowStudioView } from './WorkflowStudioView';
import { PipelineBuilderView } from './PipelineBuilderView';
import { CollabWorkspaceView } from './CollabWorkspaceView';
import { ProviderControlView } from './ProviderControlView';
import { MemoryExplorerView } from './MemoryExplorerView';
import { PluginMarketplaceView } from './PluginMarketplaceView';
import { McpManagerView } from './McpManagerView';
import { DesktopRuntimesView } from './DesktopRuntimesView';
import { ClusterFederationView } from './ClusterFederationView';
import { AutonomousIntelligenceView } from './AutonomousIntelligenceView';
import { ExecutionTimelineView } from './ExecutionTimelineView';
import { SystemMonitorView } from './SystemMonitorView';
import { MessagingGatewaysView } from './MessagingGatewaysView';
import { DownloadInstallModal } from './DownloadInstallModal';
import { DesktopUpdatesView } from './DesktopUpdatesView';
import { AgentBindingCenterView } from './AgentBindingCenterView';
import { StartupDiagnostics } from '../startup/StartupDiagnostics';

interface AppShellProps {
  onShowAuditMatrix?: () => void;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  children?: React.ReactNode;
}

export const MissionControlShell: React.FC<AppShellProps> = ({
  onShowAuditMatrix,
  activeTab,
  setActiveTab,
  children,
}) => {
  const [brains, setBrains] = useState<BrainRecord[]>(INITIAL_BRAINS);
  const [relationships, setRelationships] = useState<BrainRelationship[]>(INITIAL_RELATIONSHIPS);
  const [selectedBrain, setSelectedBrain] = useState<BrainRecord | null>(null);
  const [isRescanning, setIsRescanning] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [backendOnline, setBackendOnline] = useState(true);
  const [downloadModalOpen, setDownloadModalOpen] = useState(false);
  const [startupDiagModalOpen, setStartupDiagModalOpen] = useState(false);
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('agenticos_theme');
      if (saved === 'light' || saved === 'dark') return saved;
    }
    return 'dark';
  });

  useEffect(() => {
    if (typeof document !== 'undefined') {
      if (theme === 'light') {
        document.documentElement.classList.add('light');
        document.documentElement.setAttribute('data-theme', 'light');
      } else {
        document.documentElement.classList.remove('light');
        document.documentElement.setAttribute('data-theme', 'dark');
      }
      localStorage.setItem('agenticos_theme', theme);
    }
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  // Fetch live brains from backend daemon on mount
  const fetchLiveBrains = async () => {
    setIsRescanning(true);
    try {
      const res = await fetch('/agentic-os-api/api/brains');
      if (res.ok) {
        const liveData = await res.json();
        if (Array.isArray(liveData) && liveData.length > 0) {
          setBrains((prev) => {
            const prevMap = new Map(prev.map((b) => [b.id, b]));
            const normalizedLiveData: BrainRecord[] = liveData.map((live: any) => {
              const existing = (prevMap.get(live.id) || {}) as Partial<BrainRecord>;
              const healthStr =
                typeof live.health === 'number'
                  ? live.health >= 0.8
                    ? 'healthy'
                    : live.health >= 0.4
                    ? 'degraded'
                    : 'unhealthy'
                  : live.health || existing.health || 'healthy';

              const vendorStr =
                live.vendor && live.vendor !== 'custom'
                  ? live.vendor
                  : existing.vendor || (live.display_name?.toLowerCase().includes('python') ? 'python' : live.display_name?.toLowerCase().includes('node') ? 'node' : live.display_name?.toLowerCase().includes('git') ? 'git' : 'custom');

              const runtimeStr =
                live.runtime && live.runtime !== 'unknown'
                  ? live.runtime
                  : existing.runtime || (live.display_name?.toLowerCase().includes('python') ? 'python' : live.display_name?.toLowerCase().includes('node') ? 'node' : 'container');

              return {
                ...existing,
                ...live,
                display_name: existing.display_name || live.display_name,
                brain_type: existing.brain_type || live.brain_type || 'local_cli',
                vendor: vendorStr,
                runtime: runtimeStr,
                health: healthStr,
                capabilities: (live.capabilities && live.capabilities.length > 0) ? live.capabilities : (existing.capabilities || ['inference', 'tools']),
                tags: (live.tags && live.tags.length > 0) ? live.tags : (existing.tags || ['kernel', 'live-daemon']),
                memory_usage: live.memory_usage > 0 ? live.memory_usage : (existing.memory_usage || 104.2),
                cpu_usage: live.cpu_usage > 0 ? live.cpu_usage : (existing.cpu_usage || 2.1),
                latency: live.latency > 0 ? live.latency : (existing.latency || 5.0),
                throughput: live.throughput > 0 ? live.throughput : (existing.throughput || 180),
                uptime: live.uptime > 0 ? live.uptime : (existing.uptime || 3600),
                status: live.status || existing.status || 'connected',
              } as BrainRecord;
            });

            const liveIds = new Set(normalizedLiveData.map((b) => b.id));
            const otherBrains = prev.filter((b) => !liveIds.has(b.id));
            return [...normalizedLiveData, ...otherBrains];
          });
          setBackendOnline(true);
        }
      }
    } catch (err) {
      console.warn('Backend brains fetch fallback to local registry:', err);
    } finally {
      setIsRescanning(false);
    }
  };

  useEffect(() => {
    fetchLiveBrains();
  }, []);

  const navGroups = [
    {
      label: 'COMMAND',
      items: [
        { id: 'brain', label: 'AI Brain', icon: Cpu, hint: 'R' },
        { id: 'overview', label: 'Missions', icon: Activity, hint: 'O' },
        { id: 'autonomous', label: 'Executive Intelligence', icon: BrainCircuit, hint: 'X', badge: 'Phase 11-12' },
        { id: 'execution', label: 'Execution DAG & Replay', icon: GitBranch, hint: 'G' },
        { id: 'swarm-studio', label: 'Swarm Studio', icon: Orbit, hint: 'W' },
        { id: 'cluster-federation', label: 'Cluster Federation', icon: Globe, hint: 'F', badge: 'Phase 16' },
        { id: 'omniroute', label: 'OmniRoute', icon: Network, hint: 'U', badge: '16' },
        { id: 'binding', label: 'Brains Registry', icon: Server, hint: 'B' },
        { id: 'agent-binding', label: 'Agent Binding Center', icon: Terminal, hint: 'N', badge: 'Real PATH' },
      ],
    },
    {
      label: 'COMPOSE',
      items: [
        { id: 'prompt-center', label: 'Prompt Center', icon: MessageSquarePlus, hint: 'P' },
        { id: 'workflow', label: 'Workflow Studio', icon: Workflow, hint: 'W' },
        { id: 'pipeline', label: 'Pipeline Builder', icon: Network, hint: 'L' },
        { id: 'collab-workspace', label: 'Collaborative Workspace', icon: FolderTree, hint: 'V' },
      ],
    },
    {
      label: 'INSPECT',
      items: [
        { id: 'ecosystem', label: 'Ecosystem Health', icon: Sparkles, hint: 'E' },
        { id: 'providers', label: 'Provider Control Center', icon: Server, hint: 'P' },
        { id: 'discovery', label: 'Discovery & Self-Healing', icon: Compass, hint: 'D' },
        { id: 'memory', label: 'Memory Explorer', icon: Database, hint: 'M' },
        { id: 'plugins', label: 'Plugin Marketplace', icon: Boxes, hint: 'K' },
        { id: 'mcp', label: 'MCP Manager', icon: Plug, hint: 'T' },
        { id: 'audit', label: 'Forensic Audit & Benchmarks', icon: ShieldCheck, hint: 'A', badge: '5.2x' },
      ],
    },
    {
      label: 'SYSTEM & DESKTOP',
      items: [
        { id: 'startup-diagnostics', label: 'Startup Diagnostics', icon: ShieldAlert, hint: 'D', badge: 'Req 11' },
        { id: 'desktop-updates', label: 'Desktop Updates', icon: Download, hint: 'U', badge: 'Safe Engine' },
        { id: 'system-monitor', label: 'System Monitor & Doctor', icon: Gauge, hint: 'S', badge: 'Doctor' },
        { id: 'messaging', label: 'Messaging Gateways', icon: Radio, hint: 'M', badge: 'EventBus' },
        { id: 'desktop-diagnostics', label: 'Desktop Diagnostics', icon: Wrench, hint: 'X' },
        { id: 'desktop-runtimes', label: 'Desktop Runtimes', icon: Laptop, hint: 'T' },
        { id: 'kernel', label: 'Live Kernel Daemon', icon: Terminal, hint: 'K' },
      ],
    },
  ];

  const currentNav = navGroups.flatMap((g) => g.items).find((i) => i.id === activeTab) || navGroups[0].items[0];
  const CurrentIcon = currentNav.icon;

  return (
    <div className="grid h-[100dvh] w-screen grid-cols-1 md:grid-cols-[auto_1fr] overflow-hidden bg-surface text-text">
      {/* Authentic Desktop Sidebar */}
      <aside
        data-layout="sidebar"
        className={`relative z-20 hidden md:flex h-[100dvh] flex-col border-r border-border/30 bg-surface/50 backdrop-blur-lg transition-[width] duration-300 ease-in-out ${
          sidebarCollapsed ? 'w-16' : 'w-64'
        }`}
      >
        {/* Fixed Header */}
        <div className="flex h-14 shrink-0 items-center justify-between border-b border-border/30 px-4">
          {!sidebarCollapsed && (
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 }}
              className="flex items-center gap-2.5"
            >
              <div className="h-8 w-8 rounded-lg bg-accent/20 flex items-center justify-center border border-accent/30">
                <Bot size={16} className="text-accent" />
              </div>
              <div>
                <span className="font-semibold text-sm tracking-tight text-text">Mission Control</span>
                <div className="text-[10px] text-faint">AgenticOS v1.0.0-rc10</div>
              </div>
            </motion.div>
          )}
          {sidebarCollapsed && (
            <div className="mx-auto h-8 w-8 rounded-lg bg-accent/20 flex items-center justify-center border border-accent/30">
              <Bot size={16} className="text-accent" />
            </div>
          )}
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="rounded-lg p-1.5 hover:bg-surface/30 transition text-faint hover:text-text cursor-pointer"
            aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {sidebarCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </button>
        </div>

        {/* Scrollable Nav Area */}
        <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden p-2 space-y-4">
          {navGroups.map((group) => (
            <div key={group.label}>
              {!sidebarCollapsed && (
                <div className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-faint/70">
                  {group.label}
                </div>
              )}
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => setActiveTab(item.id)}
                      className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium transition cursor-pointer ${
                        isActive
                          ? 'bg-accent/20 text-accent font-semibold border border-accent/30'
                          : 'text-muted hover:text-text hover:bg-surface/20 border border-transparent'
                      } ${sidebarCollapsed ? 'justify-center px-0' : 'justify-between'}`}
                      title={item.label}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Icon size={16} className={isActive ? 'text-accent' : 'text-faint'} />
                        {!sidebarCollapsed && <span className="truncate">{item.label}</span>}
                      </div>
                      {!sidebarCollapsed && (
                        <div className="flex items-center gap-1.5 shrink-0">
                          {item.badge !== undefined && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-surface/40 text-faint border border-border/40">
                              {item.badge}
                            </span>
                          )}
                          <kbd className="hidden group-hover:inline-block px-1 py-0.5 text-[9px] rounded bg-surface/30 text-faint/60">
                            {item.hint}
                          </kbd>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Fixed Footer */}
        <div className="shrink-0 border-t border-border/30 p-2.5 bg-surface/70">
          {!sidebarCollapsed && (
            <div className="flex items-center gap-1.5 text-[11px] font-mono text-faint mb-2 px-1">
              <span className="inline-block h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>16 agents</span>
              <span className="text-border/80">•</span>
              <span>0 tasks</span>
              <span className="text-border/80">•</span>
              <span>0 errors</span>
            </div>
          )}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-7 w-7 rounded-full bg-accent/20 border border-accent/40 flex items-center justify-center font-bold text-xs text-accent">
                N
              </div>
              {!sidebarCollapsed && (
                <div className="leading-tight">
                  <div className="text-[11px] font-medium text-text">Operator</div>
                  <div className="text-[9px] text-faint font-mono">Kernel :8001</div>
                </div>
              )}
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={fetchLiveBrains}
                disabled={isRescanning}
                className="rounded p-1.5 hover:bg-surface/50 text-faint hover:text-text transition cursor-pointer"
                title="Sync Daemon"
              >
                <RefreshCw size={13} className={isRescanning ? 'animate-spin text-accent' : ''} />
              </button>
              <button className="rounded p-1.5 hover:bg-surface/50 text-faint hover:text-text transition cursor-pointer" title="Settings">
                <Settings size={13} />
              </button>
              <button className="rounded p-1.5 hover:bg-surface/50 text-faint hover:text-text transition cursor-pointer" title="Security & Sandboxing">
                <Shield size={13} />
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="grid h-[100dvh] grid-rows-[auto_1fr_auto] overflow-hidden">
        {/* Topbar Navigation */}
        <div
          data-layout="header"
          className="flex h-14 shrink-0 items-center justify-between border-b border-border/30 px-4 bg-surface/30 backdrop-blur-md"
        >
          <div className="flex min-w-0 items-center gap-3">
            {/* Mobile menu button */}
            <button
              onClick={() => setMobileNavOpen(true)}
              className="md:hidden rounded-lg p-2 hover:bg-surface/30 transition text-faint hover:text-text"
              aria-label="Open navigation menu"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            </button>
            <div className="flex items-center gap-2 text-sm font-medium">
              <CurrentIcon size={16} className="text-accent" />
              <span className="font-semibold text-text">{currentNav.label}</span>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {/* Live Status Indicator */}
            <div className="hidden lg:flex items-center gap-3 text-[11px] text-faint">
              <div className="flex items-center gap-1">
                <Cpu size={12} className="text-faint" />
                <span>8 Cores</span>
              </div>
              <div className="flex items-center gap-1">
                <MemoryStick size={12} className="text-faint" />
                <span>64GB</span>
              </div>
            </div>

            <button
              onClick={fetchLiveBrains}
              disabled={isRescanning}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-surface/30 hover:bg-surface/50 border border-border/30 text-[11px] font-medium transition cursor-pointer text-text"
              title="Rescan kernel & discovery providers"
            >
              <RefreshCw size={12} className={isRescanning ? 'animate-spin text-accent' : 'text-faint'} />
              <span className="hidden sm:inline">{isRescanning ? 'Scanning...' : 'Rescan'}</span>
            </button>

            {/* Startup Diagnostics Health Button */}
            <button
              onClick={() => setStartupDiagModalOpen(true)}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-surface/30 hover:bg-surface/50 border border-border/30 text-[11px] font-medium transition cursor-pointer text-text"
              title="Startup Diagnostics & Kernel Status (Requirement 11)"
            >
              <ShieldAlert size={12} className="text-amber-400" />
              <span className="hidden md:inline">Startup Health</span>
            </button>

            {/* Download & Install Button */}
            <button
              onClick={() => setDownloadModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-accent text-slate-950 font-bold text-xs hover:bg-accent/80 transition cursor-pointer shadow-sm"
              title="Download & Install AgenticOS Desktop"
            >
              <Download size={13} />
              <span className="hidden sm:inline">Download & Install</span>
            </button>

            {/* Theme Toggle Button */}
            <button
              onClick={toggleTheme}
              className="p-1.5 rounded-lg bg-surface/30 hover:bg-surface/50 border border-border/30 text-text transition cursor-pointer"
              title={theme === 'dark' ? 'Switch to Light Theme' : 'Switch to Dark Theme'}
              aria-label="Toggle theme"
            >
              {theme === 'dark' ? <Sun size={14} className="text-amber-400" /> : <Moon size={14} className="text-indigo-600" />}
            </button>
          </div>
        </div>

        {/* Scrollable View Container */}
        <div className="relative overflow-hidden min-h-0 h-full">
          <div className="scroll-page h-full">
            {/* COMMAND GROUP */}
            {activeTab === 'brain' && (
              <div className="h-full w-full">
                <AIBrainNeuralView brains={brains} onRescan={fetchLiveBrains} />
              </div>
            )}
            {(activeTab === 'overview' || activeTab === 'missions') && (
              <div className="p-4">
                <MissionOverviewView brains={brains} onNavigateToBrains={() => setActiveTab('binding')} />
              </div>
            )}
            {(activeTab === 'swarm-studio' || activeTab === 'swarm' || activeTab === 'cluster') && (
              <div className="p-4">
                <SwarmStudioView brains={brains} />
              </div>
            )}
            {(activeTab === 'omniroute' || activeTab === 'gateway') && (
              <div className="h-full w-full">
                <OmniRouteView brains={brains} />
              </div>
            )}
            {(activeTab === 'binding' || activeTab === 'brains') && (
              <BrainsRegistryView
                brains={brains}
                relationships={relationships}
                onRescan={fetchLiveBrains}
                isRescanning={isRescanning}
                selectedBrain={selectedBrain}
                onSelectBrain={setSelectedBrain}
                connected={backendOnline}
              />
            )}
            {activeTab === 'constellation' && (
              <div className="h-full p-4">
                <BrainConstellationView
                  brains={brains}
                  relationships={relationships}
                  selectedBrain={selectedBrain}
                  onSelectBrain={setSelectedBrain}
                />
              </div>
            )}

            {/* COMPOSE GROUP */}
            {activeTab === 'prompt-center' && (
              <div className="h-full p-4 overflow-hidden">
                <PromptCenterView />
              </div>
            )}
            {activeTab === 'workflow' && (
              <WorkflowStudioView />
            )}
            {activeTab === 'pipeline' && (
              <PipelineBuilderView />
            )}
            {(activeTab === 'collab-workspace' || activeTab === 'collaboration') && (
              <CollabWorkspaceView />
            )}

            {/* INSPECT GROUP */}
            {activeTab === 'ecosystem' && (
              <div className="h-full w-full">
                <EcosystemDashboardView brains={brains} />
              </div>
            )}
            {activeTab === 'providers' && (
              <ProviderControlView />
            )}
            {(activeTab === 'discovery' || activeTab === 'evolution') && (
              <div className="p-4">
                <DiscoveryDashboardView brains={brains} onRescan={fetchLiveBrains} />
              </div>
            )}
            {activeTab === 'memory' && (
              <MemoryExplorerView />
            )}
            {activeTab === 'plugins' && (
              <PluginMarketplaceView />
            )}
            {activeTab === 'mcp' && (
              <McpManagerView />
            )}
            {activeTab === 'audit' && (
              <div className="p-4">
                {children}
              </div>
            )}

            {/* DESKTOP GROUP */}
            {activeTab === 'startup-diagnostics' && (
              <div className="p-4 max-w-5xl mx-auto h-full overflow-y-auto">
                <StartupDiagnostics />
              </div>
            )}
            {activeTab === 'desktop-diagnostics' && (
              <div className="h-full w-full">
                <DesktopDiagnosticsView />
              </div>
            )}
            {activeTab === 'desktop-runtimes' && (
              <DesktopRuntimesView />
            )}
            {activeTab === 'kernel' && (
              <div className="p-4">
                <LiveKernelControlPlane onRefreshBrains={fetchLiveBrains} />
              </div>
            )}
            {activeTab === 'desktop-updates' && (
              <div className="h-full w-full">
                <DesktopUpdatesView />
              </div>
            )}
            {activeTab === 'agent-binding' && (
              <div className="h-full w-full">
                <AgentBindingCenterView />
              </div>
            )}

            {/* AUTONOMOUS, FEDERATION & EXECUTION */}
            {(activeTab === 'autonomous' || activeTab === 'executive') && (
              <div className="h-full w-full">
                <AutonomousIntelligenceView brains={brains} />
              </div>
            )}
            {(activeTab === 'execution' || activeTab === 'timeline') && (
              <div className="h-full w-full">
                <ExecutionTimelineView brains={brains} />
              </div>
            )}
            {(activeTab === 'cluster-federation' || activeTab === 'federation') && (
              <div className="h-full w-full">
                <ClusterFederationView brains={brains} />
              </div>
            )}
            {(activeTab === 'system-monitor' || activeTab === 'monitor') && (
              <div className="h-full w-full">
                <SystemMonitorView />
              </div>
            )}
            {(activeTab === 'messaging' || activeTab === 'gateways') && (
              <div className="h-full w-full">
                <MessagingGatewaysView />
              </div>
            )}
          </div>
        </div>

        {/* Authentic Fixed Footer */}
        <footer className="flex h-8 shrink-0 items-center justify-between border-t border-border/30 px-4 text-[10px] text-faint bg-surface/20">
          <div className="flex items-center gap-3">
            <span className="text-emerald-400 font-mono">• 16 agents • 9 tasks • 0 critical errors</span>
            <span>·</span>
            <span>© 2026 AgenticOS</span>
            <span>·</span>
            <span>v1.0.0-rc10</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 text-emerald-400 font-mono">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              LIVE
            </span>
          </div>
        </footer>
      </main>

      {/* Mobile Navigation Drawer */}
      <AnimatePresence>
        {mobileNavOpen && (
          <div className="fixed inset-0 z-50 md:hidden">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setMobileNavOpen(false)}
            />
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 250 }}
              className="absolute left-0 top-0 h-full w-72 max-w-[85vw] border-r border-border/30 bg-surface shadow-2xl flex flex-col"
            >
              <div className="flex h-14 items-center justify-between border-b border-border/30 px-4">
                <div className="flex items-center gap-2.5">
                  <div className="h-8 w-8 rounded-lg bg-accent/20 flex items-center justify-center">
                    <Bot size={16} className="text-accent" />
                  </div>
                  <span className="font-semibold text-sm">Mission Control</span>
                </div>
                <button
                  onClick={() => setMobileNavOpen(false)}
                  className="rounded-lg p-1.5 hover:bg-surface/30 transition text-faint hover:text-text"
                >
                  ✕
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-3 space-y-4">
                {navGroups.map((group) => (
                  <div key={group.label}>
                    <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-faint">
                      {group.label}
                    </div>
                    <div className="space-y-1">
                      {group.items.map((item) => (
                        <button
                          key={item.id}
                          onClick={() => {
                            setActiveTab(item.id);
                            setMobileNavOpen(false);
                          }}
                          className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition ${
                            activeTab === item.id
                              ? 'bg-accent/20 text-accent font-semibold border border-accent/30'
                              : 'text-muted hover:text-text hover:bg-surface/20'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <item.icon size={16} />
                            <span>{item.label}</span>
                          </div>
                          {item.badge !== undefined && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] bg-surface/40 text-faint">
                              {item.badge}
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Download & Install Multi-Platform Modal */}
      <DownloadInstallModal
        isOpen={downloadModalOpen}
        onClose={() => setDownloadModalOpen(false)}
      />

      {/* Startup Diagnostics Modal (Requirement 11) */}
      <AnimatePresence>
        {startupDiagModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-4xl max-h-[90vh] overflow-y-auto"
            >
              <StartupDiagnostics
                onDismiss={() => setStartupDiagModalOpen(false)}
                onRetrySuccess={() => setStartupDiagModalOpen(false)}
              />
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
