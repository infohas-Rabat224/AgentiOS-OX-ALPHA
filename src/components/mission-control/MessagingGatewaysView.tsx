import React, { useState, useEffect } from 'react';
import {
  Radio,
  Server,
  Zap,
  CheckCircle2,
  RefreshCw,
  Copy,
  Check,
  Send,
  Filter,
  Layers,
  Activity,
  Network,
  Cpu
} from 'lucide-react';

interface EventEnvelope {
  id: string;
  type: string;
  source: string;
  timestamp: string;
  topic: string;
  payload: Record<string, any>;
}

const INITIAL_EVENTS: EventEnvelope[] = [
  {
    id: 'evt-80124',
    type: 'TASK_DISPATCHED',
    source: 'kernel.orchestrator',
    timestamp: '14:32:01.412',
    topic: 'task.dispatched',
    payload: { task_id: 'task-103', assigned_brain: 'node-sandbox', priority: 'high' },
  },
  {
    id: 'evt-80125',
    type: 'BRAIN_HEARTBEAT',
    source: 'brain.ollama_deepseek',
    timestamp: '14:32:02.100',
    topic: 'brain.heartbeat',
    payload: { brain_id: 'brain-04', latency_ms: 12.4, status: 'healthy' },
  },
  {
    id: 'evt-80126',
    type: 'SWARM_CONSENSUS_VOTE',
    source: 'swarm.consensus_mgr',
    timestamp: '14:32:03.050',
    topic: 'swarm.consensus',
    payload: { swarm_id: 'swarm-eval-01', vote: 'approved', ratio: '3/3' },
  },
  {
    id: 'evt-80127',
    type: 'CLUSTER_HEARTBEAT',
    source: 'cluster.federation',
    timestamp: '14:32:04.220',
    topic: 'cluster.heartbeat',
    payload: { host: 'cluster-worker-us-east', latency_ms: 18.4, active_brains: 8 },
  },
  {
    id: 'evt-80128',
    type: 'ECOSYSTEM_OPTIMIZATION',
    source: 'ecosystem.evolution',
    timestamp: '14:32:05.890',
    topic: 'ecosystem.optimized',
    payload: { recommendation: 'Cached DeepSeek-R1 AST grammar template', gain: '34% speedup' },
  },
];

export const MessagingGatewaysView: React.FC = () => {
  const [activeBus, setActiveBus] = useState<'LocalBus' | 'RedisStreamsBus' | 'NatsJetStreamBus'>('LocalBus');
  const [events, setEvents] = useState<EventEnvelope[]>(INITIAL_EVENTS);
  const [selectedTopic, setSelectedTopic] = useState<string>('all');
  const [selectedEvent, setSelectedEvent] = useState<EventEnvelope>(INITIAL_EVENTS[0]);
  const [copied, setCopied] = useState(false);
  const [wsConnected, setWsConnected] = useState(true);

  // Simulate live WebSocket event stream incoming
  useEffect(() => {
    const interval = setInterval(() => {
      const topics = ['task.completed', 'brain.telemetry', 'executive.decision', 'cluster.sync'];
      const chosenTopic = topics[Math.floor(Math.random() * topics.length)];
      const newEvt: EventEnvelope = {
        id: `evt-${Math.floor(80000 + Math.random() * 10000)}`,
        type: chosenTopic.toUpperCase().replace('.', '_'),
        source: 'eventbus.stream',
        timestamp: new Date().toISOString().split('T')[1].slice(0, 12),
        topic: chosenTopic,
        payload: { simulated_stream: true, bus_adapter: activeBus, throughput_req: +(180 + Math.random() * 40).toFixed(1) },
      };
      setEvents((prev) => [newEvt, ...prev.slice(0, 24)]);
    }, 4000);
    return () => clearInterval(interval);
  }, [activeBus]);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const filteredEvents = events.filter((e) => {
    if (selectedTopic === 'all') return true;
    return e.topic.startsWith(selectedTopic);
  });

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-surface text-text p-4 space-y-4 font-sans">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-base font-bold tracking-tight text-text">Messaging Gateways & EventBus</h1>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
              HEXAGONAL ADAPTERS
            </span>
          </div>
          <p className="text-xs text-muted">
            1 Abstract EventBus Port • 3 Interchangeable Adapters • Real-Time WebSocket Streaming (ws://localhost:8000/ws)
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 px-3 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-mono font-bold">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>WS: ws://localhost:8000/ws</span>
          </div>
        </div>
      </div>

      {/* 3 Interchangeable Bus Adapters Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 font-mono text-xs">
        {/* Adapter 1: LocalBus */}
        <div
          onClick={() => setActiveBus('LocalBus')}
          className={`p-4 rounded-xl border transition cursor-pointer ${
            activeBus === 'LocalBus'
              ? 'border-accent bg-accent/15 shadow-md shadow-accent/10'
              : 'border-border/40 bg-surface/30 hover:bg-surface/50'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="font-bold text-sm text-text">LocalBus (AsyncIO)</span>
            {activeBus === 'LocalBus' && (
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-accent text-slate-950">ACTIVE</span>
            )}
          </div>
          <p className="text-muted text-[11px] font-sans mb-3">
            In-process asyncio event loop. Zero external infrastructure, ultra-low sub-millisecond local dispatch.
          </p>
          <div className="text-[10px] text-emerald-400">Status: Running (0ms overhead)</div>
        </div>

        {/* Adapter 2: RedisStreamsBus */}
        <div
          onClick={() => setActiveBus('RedisStreamsBus')}
          className={`p-4 rounded-xl border transition cursor-pointer ${
            activeBus === 'RedisStreamsBus'
              ? 'border-accent bg-accent/15 shadow-md shadow-accent/10'
              : 'border-border/40 bg-surface/30 hover:bg-surface/50'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="font-bold text-sm text-text">RedisStreamsBus</span>
            {activeBus === 'RedisStreamsBus' && (
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-accent text-slate-950">ACTIVE</span>
            )}
          </div>
          <p className="text-muted text-[11px] font-sans mb-3">
            Redis Streams backend. Persistent, multi-subscriber consumer groups, event replay capability for cluster production.
          </p>
          <div className="text-[10px] text-text">Status: Ready (Standby)</div>
        </div>

        {/* Adapter 3: NatsJetStreamBus */}
        <div
          onClick={() => setActiveBus('NatsJetStreamBus')}
          className={`p-4 rounded-xl border transition cursor-pointer ${
            activeBus === 'NatsJetStreamBus'
              ? 'border-accent bg-accent/15 shadow-md shadow-accent/10'
              : 'border-border/40 bg-surface/30 hover:bg-surface/50'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="font-bold text-sm text-text">NatsJetStreamBus</span>
            {activeBus === 'NatsJetStreamBus' && (
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-accent text-slate-950">ACTIVE</span>
            )}
          </div>
          <p className="text-muted text-[11px] font-sans mb-3">
            NATS JetStream. High-throughput distributed clustering, subject-based routing wildcards across cross-region nodes.
          </p>
          <div className="text-[10px] text-text">Status: Ready (Standby)</div>
        </div>
      </div>

      {/* Main Split: Live EventEnvelope Stream & Inspector */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left 2 Cols: Live Event Stream */}
        <div className="lg:col-span-2 rounded-xl border border-border/40 bg-surface/30 p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-text">Live EventEnvelope Stream</h2>
              <span className="text-[10px] font-mono text-emerald-400 animate-pulse">• Ingesting</span>
            </div>

            {/* Topic Filter */}
            <div className="flex flex-wrap items-center gap-1 text-xs font-mono">
              {['all', 'task', 'brain', 'swarm', 'cluster', 'ecosystem'].map((t) => (
                <button
                  key={t}
                  onClick={() => setSelectedTopic(t)}
                  className={`px-2 py-0.5 rounded capitalize transition cursor-pointer ${
                    selectedTopic === t
                      ? 'bg-accent text-slate-950 font-bold'
                      : 'bg-surface/60 text-muted hover:text-text'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5 max-h-[420px] overflow-y-auto pr-1">
            {filteredEvents.map((evt) => (
              <div
                key={evt.id}
                onClick={() => setSelectedEvent(evt)}
                className={`p-2.5 rounded-xl border transition cursor-pointer font-mono text-xs flex items-center justify-between ${
                  selectedEvent.id === evt.id
                    ? 'border-accent bg-accent/10'
                    : 'border-border/30 bg-surface/40 hover:bg-surface/70'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="text-[10px] text-muted shrink-0">{evt.timestamp}</span>
                  <span className="px-1.5 py-0.5 rounded text-[10px] bg-surface/80 text-accent font-bold shrink-0">
                    {evt.topic}
                  </span>
                  <span className="font-bold text-text truncate">{evt.type}</span>
                </div>
                <span className="text-muted text-[10px] shrink-0">{evt.source}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Right 1 Col: Event Envelope Inspector */}
        <div className="rounded-xl border border-border/40 bg-surface/30 p-4 space-y-3 font-mono text-xs">
          <div className="flex items-center justify-between border-b border-border/30 pb-2">
            <h3 className="font-bold text-text">EventEnvelope Inspector</h3>
            <button
              onClick={() => handleCopy(JSON.stringify(selectedEvent, null, 2))}
              className="text-accent hover:text-white flex items-center gap-1 cursor-pointer"
            >
              {copied ? <Check size={13} /> : <Copy size={13} />}
              <span>{copied ? 'Copied' : 'Copy'}</span>
            </button>
          </div>

          <div className="space-y-2">
            <div>
              <div className="text-[10px] text-muted">ID</div>
              <div className="text-text font-bold">{selectedEvent.id}</div>
            </div>
            <div>
              <div className="text-[10px] text-muted">Topic</div>
              <div className="text-accent font-bold">{selectedEvent.topic}</div>
            </div>
            <div>
              <div className="text-[10px] text-muted">Source Component</div>
              <div className="text-text">{selectedEvent.source}</div>
            </div>
            <div>
              <div className="text-[10px] text-muted">Timestamp</div>
              <div className="text-muted">{selectedEvent.timestamp}</div>
            </div>
            <div>
              <div className="text-[10px] text-muted mb-1">Payload JSON</div>
              <pre className="p-2.5 rounded-lg bg-black/50 border border-border/30 text-emerald-300 text-[11px] overflow-x-auto max-h-48">
                {JSON.stringify(selectedEvent.payload, null, 2)}
              </pre>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
