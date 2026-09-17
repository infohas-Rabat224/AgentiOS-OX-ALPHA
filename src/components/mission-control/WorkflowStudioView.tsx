import React, { useState } from 'react';
import {
  Workflow,
  Play,
  Plus,
  ArrowRight,
  CheckCircle2,
  Clock,
  Settings,
  Layers,
  Sparkles,
  Zap,
  Code2,
  AlertCircle,
  Copy,
  RefreshCw,
  Sliders,
  ChevronRight,
  GitBranch,
  Bot
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface WorkflowNode {
  id: string;
  name: string;
  type: 'trigger' | 'agent' | 'condition' | 'action' | 'synthesizer';
  agent?: string;
  status: 'idle' | 'running' | 'completed' | 'failed';
  latency?: string;
  description: string;
}

interface WorkflowTemplate {
  id: string;
  title: string;
  description: string;
  nodesCount: number;
  trigger: string;
  tags: string[];
}

const TEMPLATES: WorkflowTemplate[] = [
  {
    id: 'pr-triage',
    title: 'Autonomous Pull Request Reviewer',
    description: 'Intercepts GitHub webhooks, dispatches AST analysis to CODEX CLI, verifies test coverage with Python, and posts review.',
    nodesCount: 5,
    trigger: 'Webhook: pull_request.opened',
    tags: ['Code Review', 'Git', 'Automated']
  },
  {
    id: 'sec-scan',
    title: 'Zero-Day Vulnerability Triage & Patch',
    description: 'Scans dependencies via MCP, synthesizes CVE risk with CLAUDE_CODE, and generates isolated sandboxed patches.',
    nodesCount: 6,
    trigger: 'Cron: Daily @ 02:00 UTC',
    tags: ['Security', 'Vulnerability', 'Sandboxed']
  },
  {
    id: 'swarm-research',
    title: 'Multi-Agent Collaborative Deep Research',
    description: 'HERMES agents scrape documentation in parallel, synthesize insights via OmniRoute, and output verified reports.',
    nodesCount: 4,
    trigger: 'Manual / API Dispatch',
    tags: ['Research', 'Hermes', 'Parallel']
  }
];

const INITIAL_NODES: WorkflowNode[] = [
  {
    id: 'n-1',
    name: 'Event Ingest Trigger',
    type: 'trigger',
    status: 'completed',
    latency: '12ms',
    description: 'Ingests webhook payload, parses repository context and AST metadata.'
  },
  {
    id: 'n-2',
    name: 'CLAUDE_CODE Reasoning Hub',
    type: 'agent',
    agent: 'CLAUDE_CODE',
    status: 'completed',
    latency: '342ms',
    description: 'Evaluates architectural changes, verifies contract breaking hazards.'
  },
  {
    id: 'n-3',
    name: 'AST Guardrail Validator',
    type: 'condition',
    status: 'completed',
    latency: '45ms',
    description: 'Ensures type-safety, zero circular dependencies, and lint adherence.'
  },
  {
    id: 'n-4',
    name: 'PYTHON Test Suite Runner',
    type: 'action',
    agent: 'PYTHON',
    status: 'running',
    latency: 'In flight...',
    description: 'Executes pytest suite inside sandboxed MicroVM environment.'
  },
  {
    id: 'n-5',
    name: 'Multi-Model Consensus Synthesizer',
    type: 'synthesizer',
    status: 'idle',
    description: 'Aggregates test outputs, formats markdown review comment, and signs commit.'
  }
];

export const WorkflowStudioView: React.FC = () => {
  const [nodes, setNodes] = useState<WorkflowNode[]>(INITIAL_NODES);
  const [selectedNode, setSelectedNode] = useState<WorkflowNode>(INITIAL_NODES[1]);
  const [isRunning, setIsRunning] = useState(false);
  const [executionLog, setExecutionLog] = useState<string[]>([
    '[05:51:02] Ingested event: repo.commit.push (branch: main)',
    '[05:51:02] Dispatched to CLAUDE_CODE via OmniRoute (low latency channel)',
    '[05:51:03] CLAUDE_CODE analysis passed with 0 breaking changes detected',
    '[05:51:03] Guardrail validation passed (14 rules verified)',
    '[05:51:04] Triggering PYTHON sandbox test runner...'
  ]);

  const handleRunWorkflow = () => {
    setIsRunning(true);
    setExecutionLog((prev) => [
      `[${new Date().toLocaleTimeString()}] Workflow triggered manually by user`,
      ...prev
    ]);

    // Simulate node execution
    setTimeout(() => {
      setNodes((prev) =>
        prev.map((n) => (n.id === 'n-4' ? { ...n, status: 'completed', latency: '412ms' } : n))
      );
      setExecutionLog((prev) => [
        `[${new Date().toLocaleTimeString()}] PYTHON Sandbox: 42 passed, 0 failed in 0.41s`,
        ...prev
      ]);
    }, 1200);

    setTimeout(() => {
      setNodes((prev) =>
        prev.map((n) => (n.id === 'n-5' ? { ...n, status: 'running', latency: 'In flight...' } : n))
      );
      setExecutionLog((prev) => [
        `[${new Date().toLocaleTimeString()}] Multi-Model Synthesizer generating final review...`,
        ...prev
      ]);
    }, 2000);

    setTimeout(() => {
      setNodes((prev) =>
        prev.map((n) => (n.id === 'n-5' ? { ...n, status: 'completed', latency: '180ms' } : n))
      );
      setIsRunning(false);
      setExecutionLog((prev) => [
        `[${new Date().toLocaleTimeString()}] Workflow run completed with status SUCCESS (Total: 979ms)`,
        ...prev
      ]);
    }, 3200);
  };

  const handleAddNode = () => {
    const newNode: WorkflowNode = {
      id: `n-${nodes.length + 1}`,
      name: `Step ${nodes.length + 1}: Custom Agent Task`,
      type: 'agent',
      agent: 'HERMES',
      status: 'idle',
      description: 'Dispatches custom sub-task to Hermes agent swarm.'
    };
    setNodes([...nodes, newNode]);
    setSelectedNode(newNode);
  };

  const handleLoadTemplate = (t: WorkflowTemplate) => {
    setExecutionLog((prev) => [
      `[${new Date().toLocaleTimeString()}] Loaded workflow template: ${t.title}`,
      ...prev
    ]);
  };

  return (
    <div className="space-y-4 p-4 font-mono text-xs">
      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-[#0d121f] p-3.5 rounded-2xl border border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
            <Workflow size={18} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-white tracking-wide uppercase">Workflow Studio</h2>
              <span className="px-2 py-0.5 rounded text-[10px] bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 font-semibold">
                ACTIVE PIPELINE
              </span>
            </div>
            <p className="text-[11px] text-slate-400 font-sans mt-0.5">
              Visual multi-agent orchestration, conditional branching, and deterministic synthesis graph.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleAddNode}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition cursor-pointer"
          >
            <Plus size={13} />
            <span>Add Node</span>
          </button>
          <button
            onClick={handleRunWorkflow}
            disabled={isRunning}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-xl font-bold transition cursor-pointer shadow-lg ${
              isRunning
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                : 'bg-cyan-500 hover:bg-cyan-400 text-slate-950 border border-cyan-400'
            }`}
          >
            <Play size={13} className={isRunning ? 'animate-spin' : 'fill-current'} />
            <span>{isRunning ? 'Executing...' : 'Run Workflow'}</span>
          </button>
        </div>
      </div>

      {/* Main Studio Canvas & Inspector Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left: Workflow Node Pipeline Graph (2 Cols) */}
        <div className="lg:col-span-2 space-y-4">
          <div className="rounded-2xl border border-slate-800 bg-[#080c16] p-4 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
              <div className="flex items-center gap-2 text-slate-300 font-semibold">
                <Layers size={14} className="text-cyan-400" />
                <span>EXECUTION STAGES & DEPENDENCY GRAPH</span>
              </div>
              <span className="text-[10px] text-slate-500">{nodes.length} Connected Steps</span>
            </div>

            {/* Interactive Node Flow */}
            <div className="space-y-3">
              {nodes.map((node, index) => {
                const isSelected = selectedNode?.id === node.id;
                return (
                  <div key={node.id} className="relative">
                    <div
                      onClick={() => setSelectedNode(node)}
                      className={`p-3.5 rounded-xl border transition-all cursor-pointer flex flex-col md:flex-row md:items-center justify-between gap-3 ${
                        isSelected
                          ? 'border-cyan-500/60 bg-cyan-950/20 shadow-lg shadow-cyan-950/40'
                          : 'border-slate-800 bg-[#0f1526] hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-[11px] ${
                            node.type === 'trigger'
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                              : node.type === 'agent'
                              ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                              : node.type === 'condition'
                              ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                              : node.type === 'synthesizer'
                              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                              : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                          }`}
                        >
                          {index + 1}
                        </div>

                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-white text-xs">{node.name}</span>
                            {node.agent && (
                              <span className="px-1.5 py-0.2 rounded text-[9px] bg-slate-800 text-cyan-400 border border-slate-700">
                                {node.agent}
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-400 font-sans line-clamp-1 mt-0.5">
                            {node.description}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        {node.latency && (
                          <span className="text-[10px] text-slate-400 bg-slate-800/80 px-2 py-0.5 rounded border border-slate-700">
                            {node.latency}
                          </span>
                        )}
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase flex items-center gap-1 ${
                            node.status === 'completed'
                              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                              : node.status === 'running'
                              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30 animate-pulse'
                              : 'bg-slate-800 text-slate-400 border border-slate-700'
                          }`}
                        >
                          {node.status === 'completed' && <CheckCircle2 size={10} />}
                          {node.status === 'running' && <Clock size={10} />}
                          {node.status}
                        </span>
                      </div>
                    </div>

                    {index < nodes.length - 1 && (
                      <div className="flex justify-center my-1 text-slate-600">
                        <ArrowRight size={14} className="rotate-90" />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Workflow Templates Drawer */}
          <div className="rounded-2xl border border-slate-800 bg-[#080c16] p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <span className="text-slate-300 font-semibold flex items-center gap-1.5">
                <Sparkles size={13} className="text-amber-400" />
                PRE-BUILT AGENTIC WORKFLOW PATTERNS
              </span>
              <span className="text-[10px] text-slate-500">1-Click Dispatch</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {TEMPLATES.map((tmpl) => (
                <div
                  key={tmpl.id}
                  onClick={() => handleLoadTemplate(tmpl)}
                  className="p-3 rounded-xl border border-slate-800 bg-[#0d1222] hover:border-cyan-500/50 hover:bg-[#0f172a] transition cursor-pointer flex flex-col justify-between space-y-2 group"
                >
                  <div>
                    <h4 className="font-bold text-white text-[11px] group-hover:text-cyan-300 transition">
                      {tmpl.title}
                    </h4>
                    <p className="text-[10px] text-slate-400 font-sans mt-1 line-clamp-2">
                      {tmpl.description}
                    </p>
                  </div>
                  <div className="flex items-center justify-between text-[9px] text-slate-500 border-t border-slate-800/80 pt-1.5">
                    <span>{tmpl.trigger}</span>
                    <span className="text-cyan-400 group-hover:translate-x-0.5 transition flex items-center">
                      Load <ChevronRight size={10} />
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right: Selected Node Properties & Real-time Execution Trace */}
        <div className="space-y-4">
          {/* Node Inspector */}
          <div className="rounded-2xl border border-slate-800 bg-[#080c16] p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <span className="text-slate-300 font-semibold flex items-center gap-1.5">
                <Settings size={13} className="text-cyan-400" />
                NODE CONFIGURATION
              </span>
              <span className="text-[10px] text-cyan-400 font-mono">{selectedNode.id}</span>
            </div>

            <div className="space-y-3 font-sans">
              <div>
                <label className="text-[10px] font-mono text-slate-400 uppercase">Node Label</label>
                <input
                  type="text"
                  value={selectedNode.name}
                  onChange={(e) => {
                    const updated = { ...selectedNode, name: e.target.value };
                    setSelectedNode(updated);
                    setNodes(nodes.map((n) => (n.id === updated.id ? updated : n)));
                  }}
                  className="w-full mt-1 bg-[#12182b] border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500 font-mono"
                />
              </div>

              <div>
                <label className="text-[10px] font-mono text-slate-400 uppercase">Step Type</label>
                <select
                  value={selectedNode.type}
                  onChange={(e) => {
                    const updated = { ...selectedNode, type: e.target.value as any };
                    setSelectedNode(updated);
                    setNodes(nodes.map((n) => (n.id === updated.id ? updated : n)));
                  }}
                  className="w-full mt-1 bg-[#12182b] border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500 font-mono"
                >
                  <option value="trigger">Trigger Event</option>
                  <option value="agent">Autonomous Agent Task</option>
                  <option value="condition">AST / Condition Gate</option>
                  <option value="action">Action / Sandbox Run</option>
                  <option value="synthesizer">Multi-Model Synthesizer</option>
                </select>
              </div>

              {selectedNode.agent !== undefined && (
                <div>
                  <label className="text-[10px] font-mono text-slate-400 uppercase">Assigned Agent</label>
                  <select
                    value={selectedNode.agent}
                    onChange={(e) => {
                      const updated = { ...selectedNode, agent: e.target.value };
                      setSelectedNode(updated);
                      setNodes(nodes.map((n) => (n.id === updated.id ? updated : n)));
                    }}
                    className="w-full mt-1 bg-[#12182b] border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-cyan-300 focus:outline-none focus:border-cyan-500 font-mono"
                  >
                    <option value="CLAUDE_CODE">CLAUDE_CODE (Deep Reasoning)</option>
                    <option value="HERMES">HERMES (Web & Research)</option>
                    <option value="PYTHON">PYTHON (Sandbox Execution)</option>
                    <option value="CODEX CLI">CODEX CLI (AST Refactoring)</option>
                    <option value="NODE.JS">NODE.JS (Microservice V8)</option>
                  </select>
                </div>
              )}

              <div>
                <label className="text-[10px] font-mono text-slate-400 uppercase">Description / Prompt</label>
                <textarea
                  rows={3}
                  value={selectedNode.description}
                  onChange={(e) => {
                    const updated = { ...selectedNode, description: e.target.value };
                    setSelectedNode(updated);
                    setNodes(nodes.map((n) => (n.id === updated.id ? updated : n)));
                  }}
                  className="w-full mt-1 bg-[#12182b] border border-slate-700 rounded-lg p-2 text-xs text-slate-200 focus:outline-none focus:border-cyan-500 font-mono resize-none"
                />
              </div>
            </div>
          </div>

          {/* Real-time Execution Log */}
          <div className="rounded-2xl border border-slate-800 bg-[#080c16] p-4 space-y-2">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <span className="text-slate-300 font-semibold flex items-center gap-1.5">
                <Code2 size={13} className="text-emerald-400" />
                EXECUTION TELEMETRY
              </span>
              <button
                onClick={() => setExecutionLog([])}
                className="text-[10px] text-slate-500 hover:text-slate-300 cursor-pointer"
              >
                Clear
              </button>
            </div>

            <div className="h-44 overflow-y-auto bg-[#050811] p-2.5 rounded-xl border border-slate-900 space-y-1.5 text-[10px] text-slate-300 font-mono">
              {executionLog.map((log, i) => (
                <div
                  key={i}
                  className={`leading-relaxed ${
                    log.includes('SUCCESS')
                      ? 'text-emerald-400 font-bold'
                      : log.includes('Triggering') || log.includes('in flight')
                      ? 'text-amber-300'
                      : 'text-slate-300'
                  }`}
                >
                  {log}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
