import React, { useState } from 'react';
import {
  Plug,
  Terminal,
  CheckCircle2,
  AlertCircle,
  Plus,
  Play,
  RotateCcw,
  Zap,
  Code2,
  Server,
  Radio,
  FileCode,
  Layers,
  ChevronRight
} from 'lucide-react';

interface McpServer {
  id: string;
  name: string;
  transport: 'stdio' | 'sse';
  endpoint: string;
  status: 'CONNECTED' | 'DISCONNECTED';
  pingMs: number;
  toolsCount: number;
  resourcesCount: number;
  promptsCount: number;
  tools: { name: string; description: string }[];
}

const INITIAL_MCP_SERVERS: McpServer[] = [
  {
    id: 'mcp-fs',
    name: 'MCP Filesystem Server',
    transport: 'stdio',
    endpoint: 'npx -y @modelcontextprotocol/server-filesystem /workspace',
    status: 'CONNECTED',
    pingMs: 2,
    toolsCount: 6,
    resourcesCount: 14,
    promptsCount: 2,
    tools: [
      { name: 'read_file', description: 'Reads contents of specified file in workspace.' },
      { name: 'write_file', description: 'Safely write or overwrite file contents.' },
      { name: 'list_directory', description: 'List files and subfolders.' },
      { name: 'get_file_info', description: 'Retrieve file metadata and inode stats.' }
    ]
  },
  {
    id: 'mcp-github',
    name: 'MCP GitHub Server',
    transport: 'stdio',
    endpoint: 'npx -y @modelcontextprotocol/server-github',
    status: 'CONNECTED',
    pingMs: 45,
    toolsCount: 12,
    resourcesCount: 5,
    promptsCount: 3,
    tools: [
      { name: 'create_issue', description: 'Opens an issue with automated label taxonomy.' },
      { name: 'create_pull_request', description: 'Submits branch PR with verified diff.' },
      { name: 'search_repositories', description: 'Search across organization code.' }
    ]
  },
  {
    id: 'mcp-postgres',
    name: 'MCP Postgres SSE Server',
    transport: 'sse',
    endpoint: 'http://localhost:8080/sse',
    status: 'CONNECTED',
    pingMs: 8,
    toolsCount: 4,
    resourcesCount: 8,
    promptsCount: 1,
    tools: [
      { name: 'query', description: 'Executes read-only SQL queries on relational DB.' },
      { name: 'list_tables', description: 'Introspects public schema tables.' }
    ]
  },
  {
    id: 'mcp-fetch',
    name: 'MCP Web Fetch Server',
    transport: 'stdio',
    endpoint: 'uvx mcp-server-fetch',
    status: 'CONNECTED',
    pingMs: 14,
    toolsCount: 2,
    resourcesCount: 0,
    promptsCount: 1,
    tools: [
      { name: 'fetch_markdown', description: 'Converts target URL into token-efficient Markdown.' }
    ]
  }
];

export const McpManagerView: React.FC = () => {
  const [servers, setServers] = useState<McpServer[]>(INITIAL_MCP_SERVERS);
  const [selectedServer, setSelectedServer] = useState<McpServer>(INITIAL_MCP_SERVERS[0]);
  const [selectedTool, setSelectedTool] = useState(INITIAL_MCP_SERVERS[0].tools[0]);
  const [toolInput, setToolInput] = useState('{\n  "path": "src/services/omniRouter.ts"\n}');
  const [toolOutput, setToolOutput] = useState<string | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);

  const handleExecuteTool = () => {
    setIsExecuting(true);
    setToolOutput(null);
    setTimeout(() => {
      setIsExecuting(false);
      setToolOutput(
        JSON.stringify(
          {
            jsonrpc: '2.0',
            id: 1,
            result: {
              content: [
                {
                  type: 'text',
                  text: '// Success: Retreived 18.4 KB from src/services/omniRouter.ts\nexport class OmniRouterService { ... }'
                }
              ],
              isError: false
            }
          },
          null,
          2
        )
      );
    }, 600);
  };

  return (
    <div className="space-y-4 p-4 font-mono text-xs">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-[#0d121f] p-3.5 rounded-2xl border border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
            <Plug size={18} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-white tracking-wide uppercase">MCP Manager</h2>
              <span className="px-2 py-0.5 rounded text-[10px] bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 font-semibold">
                MODEL CONTEXT PROTOCOL (JSON-RPC 2.0)
              </span>
            </div>
            <p className="text-[11px] text-slate-400 font-sans mt-0.5">
              Standardized Model Context Protocol transport bridge for stdio and Server-Sent Events (SSE) servers.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => alert('MCP Server Registration modal: Specify transport, executable command, and env vars.')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold transition cursor-pointer"
          >
            <Plus size={13} />
            <span>Add MCP Server</span>
          </button>
        </div>
      </div>

      {/* Main Grid: Server List & Interactive Tool Test Workbench */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left 1 Col: Server List */}
        <div className="space-y-3">
          <div className="rounded-2xl border border-slate-800 bg-[#080c16] p-3.5 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <span className="text-slate-300 font-semibold flex items-center gap-1.5">
                <Server size={13} className="text-cyan-400" />
                REGISTERED MCP SERVERS
              </span>
              <span className="text-[10px] text-slate-500">{servers.length} Connected</span>
            </div>

            <div className="space-y-2">
              {servers.map((srv) => {
                const isSelected = selectedServer.id === srv.id;
                return (
                  <div
                    key={srv.id}
                    onClick={() => {
                      setSelectedServer(srv);
                      setSelectedTool(srv.tools[0]);
                    }}
                    className={`p-3 rounded-xl border transition-all cursor-pointer space-y-1.5 ${
                      isSelected
                        ? 'border-cyan-500/60 bg-cyan-950/25 shadow-md shadow-cyan-950/30'
                        : 'border-slate-800 bg-[#0d1222] hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className={`font-bold text-xs ${isSelected ? 'text-cyan-300' : 'text-white'}`}>
                        {srv.name}
                      </span>
                      <span className="px-1.5 py-0.2 rounded text-[9px] uppercase font-bold bg-slate-800 text-cyan-400 border border-slate-700">
                        {srv.transport}
                      </span>
                    </div>

                    <div className="text-[10px] text-slate-500 font-mono truncate">{srv.endpoint}</div>

                    <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1 border-t border-slate-800/80">
                      <span>{srv.toolsCount} Tools · {srv.resourcesCount} Resources</span>
                      <span className="text-emerald-400 flex items-center gap-1 font-bold">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        {srv.pingMs}ms
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right 2 Cols: Selected Server Tools & Playground */}
        <div className="lg:col-span-2 space-y-4">
          <div className="rounded-2xl border border-slate-800 bg-[#080c16] p-4 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2.5">
              <div>
                <span className="font-bold text-white text-xs">{selectedServer.name}</span>
                <span className="text-[10px] text-slate-400 block mt-0.5 font-mono">
                  Transport: {selectedServer.transport.toUpperCase()} · Status: CONNECTED
                </span>
              </div>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                JSON-RPC 2.0 READY
              </span>
            </div>

            {/* Server Discovered Tools */}
            <div>
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-2">
                Available Tools ({selectedServer.tools.length})
              </span>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {selectedServer.tools.map((t) => (
                  <div
                    key={t.name}
                    onClick={() => setSelectedTool(t)}
                    className={`p-2.5 rounded-xl border transition cursor-pointer ${
                      selectedTool.name === t.name
                        ? 'border-cyan-500 bg-cyan-950/30 text-white'
                        : 'border-slate-800 bg-[#0d1222] text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs text-cyan-300">{t.name}</span>
                      <ChevronRight size={12} className="text-slate-500" />
                    </div>
                    <p className="text-[10px] text-slate-400 font-sans mt-0.5 line-clamp-1">
                      {t.description}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Interactive Tool Invocation Workbench */}
            <div className="border-t border-slate-800 pt-3 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-slate-300 font-bold uppercase flex items-center gap-1.5">
                  <Play size={11} className="text-cyan-400" />
                  Tool Invocation: <strong className="text-cyan-400">{selectedTool.name}</strong>
                </span>
                <button
                  onClick={handleExecuteTool}
                  disabled={isExecuting}
                  className="px-3 py-1 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-[10px] transition cursor-pointer flex items-center gap-1"
                >
                  <Play size={11} className={isExecuting ? 'animate-spin' : ''} />
                  <span>{isExecuting ? 'Executing...' : 'Invoke Tool'}</span>
                </button>
              </div>

              <div>
                <label className="text-[10px] text-slate-400 block mb-1">JSON-RPC Arguments</label>
                <textarea
                  rows={4}
                  value={toolInput}
                  onChange={(e) => setToolInput(e.target.value)}
                  className="w-full bg-[#050811] text-cyan-200 border border-slate-800 rounded-xl p-2.5 font-mono text-[11px] focus:outline-none focus:border-cyan-500 resize-none"
                />
              </div>

              {toolOutput && (
                <div>
                  <label className="text-[10px] text-slate-400 block mb-1">Tool Output (Response)</label>
                  <pre className="bg-[#050811] text-emerald-300 border border-slate-800 rounded-xl p-3 font-mono text-[10px] overflow-x-auto">
                    {toolOutput}
                  </pre>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
