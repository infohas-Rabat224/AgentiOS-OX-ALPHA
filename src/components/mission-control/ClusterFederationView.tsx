import React, { useState } from 'react';
import {
  Globe,
  Server,
  Shield,
  RefreshCw,
  Cpu,
  Activity,
  Zap,
  CheckCircle2,
  AlertTriangle,
  Radio,
  Network,
  ArrowRightLeft,
  Crown,
  Database,
  Layers,
  Sparkles
} from 'lucide-react';
import { BrainRecord } from '../../types/missionControl';

interface ClusterFederationViewProps {
  brains?: BrainRecord[];
}

interface ClusterNode {
  id: string;
  name: string;
  region: string;
  role: 'leader' | 'worker';
  status: 'online' | 'degraded' | 'syncing';
  heartbeatMs: number;
  cpuUsage: number;
  memUsage: number;
  activeBrains: number;
  latencyToLeader: number;
  endpoint: string;
}

const INITIAL_NODES: ClusterNode[] = [
  {
    id: 'node-local',
    name: 'agenticos-host-01 (Local Kernel)',
    region: 'local-edge',
    role: 'leader',
    status: 'online',
    heartbeatMs: 12,
    cpuUsage: 14.2,
    memUsage: 38.5,
    activeBrains: 16,
    latencyToLeader: 0,
    endpoint: 'http://127.0.0.1:8000',
  },
  {
    id: 'node-us-east',
    name: 'cluster-worker-us-east',
    region: 'us-east-1 (N. Virginia)',
    role: 'worker',
    status: 'online',
    heartbeatMs: 24,
    cpuUsage: 32.1,
    memUsage: 61.4,
    activeBrains: 8,
    latencyToLeader: 18.4,
    endpoint: 'https://cluster-useast.agenticos.internal:8000',
  },
  {
    id: 'node-eu-west',
    name: 'cluster-worker-eu-west',
    region: 'eu-west-1 (Frankfurt)',
    role: 'worker',
    status: 'online',
    heartbeatMs: 38,
    cpuUsage: 22.8,
    memUsage: 45.2,
    activeBrains: 6,
    latencyToLeader: 32.1,
    endpoint: 'https://cluster-euwest.agenticos.internal:8000',
  },
  {
    id: 'node-ap-south',
    name: 'cluster-worker-asia-tokyo',
    region: 'ap-northeast-1 (Tokyo)',
    role: 'worker',
    status: 'online',
    heartbeatMs: 76,
    cpuUsage: 19.5,
    memUsage: 41.0,
    activeBrains: 4,
    latencyToLeader: 68.9,
    endpoint: 'https://cluster-tokyo.agenticos.internal:8000',
  },
];

export const ClusterFederationView: React.FC<ClusterFederationViewProps> = ({ brains = [] }) => {
  const [nodes, setNodes] = useState<ClusterNode[]>(INITIAL_NODES);
  const [activeTab, setActiveTab] = useState<'topology' | 'nodes' | 'scheduler' | 'consensus' | 'failover'>('topology');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const [consensusType, setConsensusType] = useState<'majority' | 'weighted' | 'confidence' | 'leader' | 'quorum'>('majority');

  const showNotification = (msg: string) => {
    setActionNotice(msg);
    setTimeout(() => setActionNotice(null), 3500);
  };

  const handleDiscover = () => {
    setIsRefreshing(true);
    setTimeout(() => {
      setIsRefreshing(false);
      showNotification('Federation Discovery complete: 4 active cluster hosts verified with valid heartbeats.');
    }, 1000);
  };

  const handleRebalance = () => {
    showNotification('Global Mission Scheduler rebalanced 9-factor cluster workload across 4 nodes.');
  };

  const handleElectLeader = (nodeId: string) => {
    setNodes((prev) =>
      prev.map((n) => ({
        ...n,
        role: n.id === nodeId ? 'leader' : 'worker',
      }))
    );
    showNotification(`Elected ${nodeId} as cluster leader via Raft consensus quorum.`);
  };

  const handleSimulateFailover = () => {
    showNotification('Simulated Failover trigger: FailoverEngine rerouted 6 tasks from degraded node to local leader.');
  };

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-surface text-text p-4 space-y-4">
      {/* Top Header & Metrics */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-base font-bold tracking-tight text-text">Distributed Cluster Federation</h1>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
              PHASE 16
            </span>
          </div>
          <p className="text-xs text-muted">
            ClusterController • Heartbeat Discovery • 9-Factor Global Scheduler • Cross-Host Federated Knowledge Graph
          </p>
        </div>

        <div className="flex items-center gap-2">
          {actionNotice && (
            <span className="text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-3 py-1 rounded-lg">
              {actionNotice}
            </span>
          )}
          <button
            onClick={handleDiscover}
            disabled={isRefreshing}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent/20 hover:bg-accent/30 text-accent font-semibold text-xs border border-accent/40 transition cursor-pointer"
          >
            <RefreshCw size={13} className={isRefreshing ? 'animate-spin' : ''} />
            <span>Discover Nodes</span>
          </button>
          <button
            onClick={handleRebalance}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface/50 hover:bg-surface/80 text-text font-medium text-xs border border-border/40 transition cursor-pointer"
          >
            <ArrowRightLeft size={13} />
            <span>Rebalance Workload</span>
          </button>
        </div>
      </div>

      {/* Cluster Metrics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3 font-mono text-xs">
        <div className="bg-surface/40 p-3 rounded-xl border border-border/40">
          <div className="text-[10px] uppercase tracking-wider text-muted">CLUSTER NODES</div>
          <div className="text-lg font-bold text-text mt-0.5">4 Hosts</div>
        </div>
        <div className="bg-surface/40 p-3 rounded-xl border border-border/40">
          <div className="text-[10px] uppercase tracking-wider text-muted">LEADER</div>
          <div className="text-lg font-bold text-indigo-400 mt-0.5 flex items-center gap-1">
            <Crown size={14} />
            <span>Local</span>
          </div>
        </div>
        <div className="bg-surface/40 p-3 rounded-xl border border-border/40">
          <div className="text-[10px] uppercase tracking-wider text-muted">FEDERATED BRAINS</div>
          <div className="text-lg font-bold text-emerald-400 mt-0.5">34 Total</div>
        </div>
        <div className="bg-surface/40 p-3 rounded-xl border border-border/40">
          <div className="text-[10px] uppercase tracking-wider text-muted">CONSENSUS TYPE</div>
          <div className="text-lg font-bold text-text mt-0.5 uppercase">{consensusType}</div>
        </div>
        <div className="bg-surface/40 p-3 rounded-xl border border-border/40">
          <div className="text-[10px] uppercase tracking-wider text-muted">HEARTBEAT P95</div>
          <div className="text-lg font-bold text-emerald-400 mt-0.5">38 ms</div>
        </div>
        <div className="bg-surface/40 p-3 rounded-xl border border-border/40">
          <div className="text-[10px] uppercase tracking-wider text-muted">FAILOVER ENGINE</div>
          <div className="text-lg font-bold text-ok mt-0.5 flex items-center gap-1">
            <CheckCircle2 size={14} />
            <span>Standby</span>
          </div>
        </div>
      </div>

      {/* Subtab Navigation */}
      <div className="flex items-center gap-1.5 border-b border-border/30 pb-2 text-xs font-mono">
        <button
          onClick={() => setActiveTab('topology')}
          className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
            activeTab === 'topology'
              ? 'bg-accent/20 text-accent font-bold border border-accent/40'
              : 'text-muted hover:text-text'
          }`}
        >
          Cluster Topology Map
        </button>
        <button
          onClick={() => setActiveTab('nodes')}
          className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
            activeTab === 'nodes'
              ? 'bg-accent/20 text-accent font-bold border border-accent/40'
              : 'text-muted hover:text-text'
          }`}
        >
          Node Registry ({nodes.length})
        </button>
        <button
          onClick={() => setActiveTab('scheduler')}
          className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
            activeTab === 'scheduler'
              ? 'bg-accent/20 text-accent font-bold border border-accent/40'
              : 'text-muted hover:text-text'
          }`}
        >
          Global 9-Factor Scheduler
        </button>
        <button
          onClick={() => setActiveTab('consensus')}
          className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
            activeTab === 'consensus'
              ? 'bg-accent/20 text-accent font-bold border border-accent/40'
              : 'text-muted hover:text-text'
          }`}
        >
          Consensus & Quorum
        </button>
        <button
          onClick={() => setActiveTab('failover')}
          className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
            activeTab === 'failover'
              ? 'bg-accent/20 text-accent font-bold border border-accent/40'
              : 'text-muted hover:text-text'
          }`}
        >
          Failover Engine (5 Triggers)
        </button>
      </div>

      {/* VIEW: TOPOLOGY MAP */}
      {activeTab === 'topology' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 rounded-xl border border-border/40 bg-surface/30 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-text">Federated Mesh Topology</h2>
                <p className="text-xs text-muted">Interactive cross-host links with real-time ping and sync status</p>
              </div>
              <span className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-mono font-bold bg-ok/10 text-ok border border-ok/30">
                <span className="w-1.5 h-1.5 rounded-full bg-ok animate-pulse" />
                Mesh Healthy
              </span>
            </div>

            {/* Visual Topology Graph Representation */}
            <div className="relative min-h-[300px] rounded-xl border border-border/30 bg-surface/50 p-6 flex flex-col items-center justify-between overflow-hidden">
              {/* Leader Node on Top */}
              <div className="relative z-10 flex flex-col items-center p-3 rounded-xl border-2 border-indigo-500 bg-indigo-950/40 text-center shadow-lg shadow-indigo-500/10">
                <Crown size={20} className="text-indigo-400 mb-1" />
                <span className="text-xs font-bold text-white">agenticos-host-01 (LEADER)</span>
                <span className="text-[10px] text-indigo-300 font-mono">127.0.0.1:8000 • 16 Local Brains</span>
              </div>

              {/* Connecting Lines */}
              <div className="w-full flex justify-around my-4 relative">
                <div className="h-10 w-0.5 bg-gradient-to-b from-indigo-500 to-cyan-500" />
                <div className="h-10 w-0.5 bg-gradient-to-b from-indigo-500 to-emerald-500" />
                <div className="h-10 w-0.5 bg-gradient-to-b from-indigo-500 to-purple-500" />
              </div>

              {/* Worker Nodes Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full z-10">
                {nodes.filter((n) => n.role !== 'leader').map((node) => (
                  <div key={node.id} className="p-3 rounded-xl border border-border/40 bg-surface/70 text-center space-y-1">
                    <Server size={16} className="text-accent mx-auto mb-1" />
                    <div className="text-xs font-bold text-text truncate">{node.name}</div>
                    <div className="text-[10px] text-muted font-mono">{node.region}</div>
                    <div className="flex items-center justify-center gap-2 text-[10px] font-mono text-emerald-400 pt-1">
                      <span>{node.latencyToLeader}ms ping</span>
                      <span>•</span>
                      <span>{node.activeBrains} brains</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right: Federated Knowledge Graph */}
          <div className="rounded-xl border border-border/40 bg-surface/30 p-5 space-y-3">
            <h2 className="text-sm font-bold text-text">Federated Knowledge Graph</h2>
            <p className="text-xs text-muted">Cross-host graph edges & cluster-wide knowledge synchronization</p>

            <div className="space-y-2 text-xs font-mono">
              <div className="p-2.5 rounded-lg border border-border/30 bg-surface/40 flex justify-between items-center">
                <span className="text-muted">Global Nodes:</span>
                <span className="text-text font-bold">14,280 entities</span>
              </div>
              <div className="p-2.5 rounded-lg border border-border/30 bg-surface/40 flex justify-between items-center">
                <span className="text-muted">Cross-Host Edges:</span>
                <span className="text-accent font-bold">3,120 relations</span>
              </div>
              <div className="p-2.5 rounded-lg border border-border/30 bg-surface/40 flex justify-between items-center">
                <span className="text-muted">Impact Analysis BFS:</span>
                <span className="text-ok font-bold">0.42 ms traversal</span>
              </div>
              <div className="p-2.5 rounded-lg border border-border/30 bg-surface/40 flex justify-between items-center">
                <span className="text-muted">Replication Lag:</span>
                <span className="text-text font-bold">&lt; 15 ms</span>
              </div>
            </div>

            <div className="pt-3 border-t border-border/30 space-y-2">
              <button
                onClick={handleSimulateFailover}
                className="w-full py-2 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 font-bold text-xs border border-amber-500/40 transition cursor-pointer"
              >
                Test Failover Simulation
              </button>
            </div>
          </div>
        </div>
      )}

      {/* VIEW: NODES LIST */}
      {activeTab === 'nodes' && (
        <div className="rounded-xl border border-border/40 bg-surface/30 p-4">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead className="text-[11px] text-muted uppercase border-b border-border/30">
                <tr>
                  <th className="py-2.5 px-3">Node Name</th>
                  <th className="py-2.5 px-3">Role</th>
                  <th className="py-2.5 px-3">Region</th>
                  <th className="py-2.5 px-3">Heartbeat</th>
                  <th className="py-2.5 px-3">CPU / Mem</th>
                  <th className="py-2.5 px-3">Brains</th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/20">
                {nodes.map((node) => (
                  <tr key={node.id} className="hover:bg-surface/40 transition">
                    <td className="py-3 px-3">
                      <div className="font-bold text-text">{node.name}</div>
                      <div className="text-[10px] text-muted">{node.endpoint}</div>
                    </td>
                    <td className="py-3 px-3">
                      {node.role === 'leader' ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                          LEADER
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-[10px] bg-surface/60 text-muted">WORKER</span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-muted">{node.region}</td>
                    <td className="py-3 px-3 text-emerald-400">{node.heartbeatMs} ms</td>
                    <td className="py-3 px-3 text-text">
                      {node.cpuUsage}% / {node.memUsage}%
                    </td>
                    <td className="py-3 px-3 font-bold text-accent">{node.activeBrains}</td>
                    <td className="py-3 px-3 text-right">
                      {node.role !== 'leader' && (
                        <button
                          onClick={() => handleElectLeader(node.id)}
                          className="px-2.5 py-1 rounded bg-surface/50 hover:bg-accent/20 text-muted hover:text-accent border border-border/40 text-[11px] transition cursor-pointer"
                        >
                          Elect Leader
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* VIEW: 9-FACTOR SCHEDULER */}
      {activeTab === 'scheduler' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="rounded-xl border border-border/40 bg-surface/30 p-5 space-y-3">
            <h2 className="text-sm font-bold text-text">Global Mission Scheduler Scoring Factors</h2>
            <p className="text-xs text-muted">Deterministic 9-factor scoring calculates cluster node fitness for every mission:</p>

            <div className="space-y-2 text-xs font-mono">
              {[
                { factor: '1. Model / Brain Affinity', weight: '20%', desc: 'Presence of required LLM engine locally' },
                { factor: '2. Available CPU & VRAM Headroom', weight: '15%', desc: 'Memory capacity before throttle' },
                { factor: '3. Current Queue Depth', weight: '15%', desc: 'Active inflight tasks on node' },
                { factor: '4. Network Latency to Dispatcher', weight: '10%', desc: 'Round-trip milliseconds' },
                { factor: '5. Historical Success Rate', weight: '10%', desc: 'EMA reliability over 100 missions' },
                { factor: '6. Workspace Cache Locality', weight: '10%', desc: 'Local artifact and memory cache hits' },
                { factor: '7. Cost per Token / Execution', weight: '10%', desc: 'Cheapest compute target' },
                { factor: '8. Security & Sandboxing Level', weight: '5%', desc: 'Isolation enforcement match' },
                { factor: '9. Thermal & Power State', weight: '5%', desc: 'Device throttling prevention' },
              ].map((f) => (
                <div key={f.factor} className="p-2.5 rounded-lg border border-border/30 bg-surface/40 flex justify-between items-center">
                  <div>
                    <span className="font-bold text-text">{f.factor}</span>
                    <div className="text-[10px] text-muted">{f.desc}</div>
                  </div>
                  <span className="text-accent font-bold">{f.weight}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-border/40 bg-surface/30 p-5 space-y-4">
            <h2 className="text-sm font-bold text-text">Live Scheduling Decision Feed</h2>
            <div className="p-3 rounded-lg bg-surface/50 border border-border/30 font-mono text-[11px] space-y-1 text-slate-300">
              <div className="text-emerald-400 font-bold">[SCHEDULER] Dispatching task #8921:</div>
              <div>• Target: 'cluster-worker-us-east' (Score: 0.942)</div>
              <div>• Reason: High model affinity (claude-3-7-sonnet cached) + low load</div>
              <div className="text-muted">• Execution: Dispatched in 4.2ms</div>
            </div>
            <div className="p-3 rounded-lg bg-surface/50 border border-border/30 font-mono text-[11px] space-y-1 text-slate-300">
              <div className="text-emerald-400 font-bold">[SCHEDULER] Dispatching task #8922:</div>
              <div>• Target: 'agenticos-host-01' (Score: 0.988)</div>
              <div>• Reason: Zero network latency + local Ollama deepseek-r1 active</div>
              <div className="text-muted">• Execution: Inflight</div>
            </div>
          </div>
        </div>
      )}

      {/* VIEW: CONSENSUS */}
      {activeTab === 'consensus' && (
        <div className="rounded-xl border border-border/40 bg-surface/30 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-text">Cluster Consensus Engine</h2>
              <p className="text-xs text-muted">Supports 5 consensus strategies across federated cluster nodes</p>
            </div>
            <div className="flex items-center gap-2">
              {(['majority', 'weighted', 'confidence', 'leader', 'quorum'] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => {
                    setConsensusType(mode);
                    showNotification(`Switched cluster consensus protocol to: ${mode.toUpperCase()}`);
                  }}
                  className={`px-3 py-1 rounded-lg text-xs font-mono font-bold capitalize transition cursor-pointer ${
                    consensusType === mode
                      ? 'bg-indigo-500 text-white shadow'
                      : 'bg-surface/50 text-muted hover:text-text'
                  }`}
                >
                  {mode}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 font-mono text-xs">
            <div className="p-3.5 rounded-xl border border-border/30 bg-surface/40 space-y-1">
              <div className="font-bold text-text">Active Protocol</div>
              <div className="text-indigo-400 text-sm font-bold uppercase">{consensusType}</div>
              <div className="text-[10px] text-muted">Deterministic vote resolution with timestamp ordering</div>
            </div>
            <div className="p-3.5 rounded-xl border border-border/30 bg-surface/40 space-y-1">
              <div className="font-bold text-text">Quorum Threshold</div>
              <div className="text-ok text-sm font-bold">3 of 4 Nodes (75%)</div>
              <div className="text-[10px] text-muted">Fault tolerance: tolerates 1 dead node</div>
            </div>
            <div className="p-3.5 rounded-xl border border-border/30 bg-surface/40 space-y-1">
              <div className="font-bold text-text">Consensus Latency</div>
              <div className="text-accent text-sm font-bold">14.8 ms Avg</div>
              <div className="text-[10px] text-muted">Zero-roundtrip local bypass when leader consensus is active</div>
            </div>
          </div>
        </div>
      )}

      {/* VIEW: FAILOVER ENGINE */}
      {activeTab === 'failover' && (
        <div className="rounded-xl border border-border/40 bg-surface/30 p-5 space-y-4">
          <div>
            <h2 className="text-sm font-bold text-text">Failover Engine: 5 Triggers → 5 Actions</h2>
            <p className="text-xs text-muted">Zero-downtime automated recovery across the distributed agent mesh</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 font-mono text-xs">
            {[
              {
                trigger: 'Trigger 1: Node Heartbeat Timeout (>5000ms)',
                action: 'Action: Mark node offline, evict from scheduler pool, elect new leader if needed.',
              },
              {
                trigger: 'Trigger 2: Brain Crash / Process Demise',
                action: 'Action: Spin up fallback brain replica on healthy cluster node and replay events.',
              },
              {
                trigger: 'Trigger 3: Network Partition Detected',
                action: 'Action: Split-brain prevention via Raft quorum check; isolate minority partition.',
              },
              {
                trigger: 'Trigger 4: Memory Pressure Alert (>90% VRAM/RAM)',
                action: 'Action: Shed inflight inference requests and offload tasks to low-utilization nodes.',
              },
              {
                trigger: 'Trigger 5: SLA Latency Spike (>300ms p95)',
                action: 'Action: Dynamically adjust OmniRoute weights and route traffic around degraded link.',
              },
            ].map((rule, idx) => (
              <div key={idx} className="p-3.5 rounded-xl border border-border/30 bg-surface/40 space-y-1">
                <div className="text-amber-400 font-bold">{rule.trigger}</div>
                <div className="text-slate-300 text-[11px]">{rule.action}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
