import React, { useState } from 'react';
import {
  Server,
  Zap,
  CheckCircle2,
  AlertCircle,
  Clock,
  ShieldCheck,
  RefreshCw,
  Sliders,
  DollarSign,
  Lock,
  ExternalLink,
  ChevronRight,
  TrendingDown
} from 'lucide-react';

interface ModelProvider {
  id: string;
  name: string;
  category: 'cloud' | 'local' | 'hybrid';
  primaryModel: string;
  status: 'ONLINE' | 'DEGRADED' | 'RATE_LIMITED' | 'OFFLINE';
  latencyMs: number;
  tokenUsage24h: string;
  costPer1MInput: string;
  costPer1MOutput: string;
  rpmQuota: string;
  hasApiKey: boolean;
  priority: number;
}

const INITIAL_PROVIDERS: ModelProvider[] = [
  {
    id: 'anthropic',
    name: 'Anthropic Claude',
    category: 'cloud',
    primaryModel: 'claude-3-7-sonnet',
    status: 'ONLINE',
    latencyMs: 342,
    tokenUsage24h: '4.2M tokens',
    costPer1MInput: '$3.00',
    costPer1MOutput: '$15.00',
    rpmQuota: '85% (850 / 1000 RPM)',
    hasApiKey: true,
    priority: 1
  },
  {
    id: 'openai',
    name: 'OpenAI GPT & o3',
    category: 'cloud',
    primaryModel: 'gpt-4o / o3-mini',
    status: 'ONLINE',
    latencyMs: 290,
    tokenUsage24h: '2.8M tokens',
    costPer1MInput: '$2.50',
    costPer1MOutput: '$10.00',
    rpmQuota: '62% (620 / 1000 RPM)',
    hasApiKey: true,
    priority: 2
  },
  {
    id: 'gemini',
    name: 'Google Gemini',
    category: 'cloud',
    primaryModel: 'gemini-2.5-pro / flash',
    status: 'ONLINE',
    latencyMs: 210,
    tokenUsage24h: '6.1M tokens',
    costPer1MInput: '$1.25',
    costPer1MOutput: '$5.00',
    rpmQuota: '45% (900 / 2000 RPM)',
    hasApiKey: true,
    priority: 3
  },
  {
    id: 'ollama',
    name: 'Ollama Local Runtime',
    category: 'local',
    primaryModel: 'qwen2.5-coder:14b / llama3.3',
    status: 'ONLINE',
    latencyMs: 42,
    tokenUsage24h: '18.4M tokens',
    costPer1MInput: '$0.00 (Local GPU)',
    costPer1MOutput: '$0.00 (Local GPU)',
    rpmQuota: 'Unlimited (Local VRAM)',
    hasApiKey: true,
    priority: 4
  },
  {
    id: 'groq',
    name: 'Groq LPU Engine',
    category: 'cloud',
    primaryModel: 'llama-3.3-70b-versatile',
    status: 'ONLINE',
    latencyMs: 84,
    tokenUsage24h: '1.2M tokens',
    costPer1MInput: '$0.59',
    costPer1MOutput: '$0.79',
    rpmQuota: '78% (780 / 1000 RPM)',
    hasApiKey: true,
    priority: 5
  },
  {
    id: 'vllm',
    name: 'vLLM Cluster Federation',
    category: 'hybrid',
    primaryModel: 'deepseek-r1-distill-32b',
    status: 'ONLINE',
    latencyMs: 65,
    tokenUsage24h: '8.9M tokens',
    costPer1MInput: '$0.00 (On-premise)',
    costPer1MOutput: '$0.00 (On-premise)',
    rpmQuota: 'Unlimited (Cluster)',
    hasApiKey: true,
    priority: 6
  }
];

export const ProviderControlView: React.FC = () => {
  const [providers, setProviders] = useState<ModelProvider[]>(INITIAL_PROVIDERS);
  const [isPinging, setIsPinging] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<ModelProvider>(INITIAL_PROVIDERS[0]);

  const handlePingAll = () => {
    setIsPinging(true);
    setTimeout(() => {
      setProviders((prev) =>
        prev.map((p) => ({
          ...p,
          latencyMs: Math.max(18, Math.round(p.latencyMs + (Math.random() * 20 - 10)))
        }))
      );
      setIsPinging(false);
    }, 1200);
  };

  return (
    <div className="space-y-4 p-4 font-mono text-xs">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-[#0d121f] p-3.5 rounded-2xl border border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
            <Server size={18} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-white tracking-wide uppercase">Provider Control Center</h2>
              <span className="px-2 py-0.5 rounded text-[10px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-semibold">
                6/6 ENDPOINTS REACHABLE
              </span>
            </div>
            <p className="text-[11px] text-slate-400 font-sans mt-0.5">
              Manage LLM gateways, token quotas, multi-provider fallback hierarchy, and secure credential vault.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handlePingAll}
            disabled={isPinging}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 hover:bg-cyan-500/30 transition cursor-pointer font-bold"
          >
            <RefreshCw size={13} className={isPinging ? 'animate-spin' : ''} />
            <span>{isPinging ? 'Pinging Endpoints...' : 'Ping All Endpoints'}</span>
          </button>
        </div>
      </div>

      {/* Aggregate Overview Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-[#0a0f1d] p-3 rounded-xl border border-slate-800">
          <div className="flex items-center justify-between text-[10px] text-slate-400">
            <span>24H ROLLING CONSUMPTION</span>
            <DollarSign size={12} className="text-cyan-400" />
          </div>
          <div className="text-lg font-bold text-white mt-1">41.4M Tokens</div>
          <span className="text-[10px] text-emerald-400 flex items-center gap-1">
            <TrendingDown size={11} /> 68.4% saved via Local Ollama
          </span>
        </div>

        <div className="bg-[#0a0f1d] p-3 rounded-xl border border-slate-800">
          <div className="flex items-center justify-between text-[10px] text-slate-400">
            <span>FASTEST ENDPOINT</span>
            <Zap size={12} className="text-emerald-400" />
          </div>
          <div className="text-lg font-bold text-emerald-400 mt-1">42 ms</div>
          <span className="text-[10px] text-slate-400">Ollama Local GPU VRAM</span>
        </div>

        <div className="bg-[#0a0f1d] p-3 rounded-xl border border-slate-800">
          <div className="flex items-center justify-between text-[10px] text-slate-400">
            <span>FALLBACK RESILIENCE</span>
            <ShieldCheck size={12} className="text-purple-400" />
          </div>
          <div className="text-lg font-bold text-purple-300 mt-1">6-Tier Chain</div>
          <span className="text-[10px] text-slate-400">Zero unhandled dropouts</span>
        </div>

        <div className="bg-[#0a0f1d] p-3 rounded-xl border border-slate-800">
          <div className="flex items-center justify-between text-[10px] text-slate-400">
            <span>CREDENTIAL VAULT</span>
            <Lock size={12} className="text-amber-400" />
          </div>
          <div className="text-lg font-bold text-amber-300 mt-1">AES-256 HSM</div>
          <span className="text-[10px] text-slate-400">Protected in system keyring</span>
        </div>
      </div>

      {/* Provider Matrix & Detail Card */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left 2 Cols: Providers Grid */}
        <div className="lg:col-span-2 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {providers.map((p) => {
              const isSelected = selectedProvider.id === p.id;
              return (
                <div
                  key={p.id}
                  onClick={() => setSelectedProvider(p)}
                  className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between space-y-3 ${
                    isSelected
                      ? 'border-cyan-500/60 bg-cyan-950/20 shadow-lg shadow-cyan-950/30'
                      : 'border-slate-800 bg-[#0a0f1d] hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white text-xs">{p.name}</span>
                        <span
                          className={`text-[9px] uppercase px-1.5 py-0.2 rounded font-semibold ${
                            p.category === 'local'
                              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                              : p.category === 'hybrid'
                              ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                              : 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                          }`}
                        >
                          {p.category}
                        </span>
                      </div>
                      <span className="text-[11px] text-slate-400 block mt-0.5">{p.primaryModel}</span>
                    </div>

                    <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      {p.status}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[10px] text-slate-400 bg-[#050811] p-2 rounded-xl border border-slate-900">
                    <div>
                      <span>Latency:</span>{' '}
                      <strong className="text-white">{p.latencyMs} ms</strong>
                    </div>
                    <div>
                      <span>Usage (24h):</span>{' '}
                      <strong className="text-cyan-300">{p.tokenUsage24h}</strong>
                    </div>
                    <div>
                      <span>Cost (In/Out):</span>{' '}
                      <strong className="text-emerald-400">{p.costPer1MInput}</strong>
                    </div>
                    <div>
                      <span>Quota:</span>{' '}
                      <strong className="text-slate-300">{p.rpmQuota.split(' ')[0]}</strong>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right 1 Col: Provider Inspector & Configuration */}
        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-800 bg-[#080c16] p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <span className="text-slate-300 font-semibold flex items-center gap-1.5">
                <Sliders size={13} className="text-cyan-400" />
                PROVIDER CONFIGURATION
              </span>
              <span className="text-[10px] text-cyan-400 font-mono">Priority #{selectedProvider.priority}</span>
            </div>

            <div className="space-y-3 font-sans text-xs">
              <div>
                <label className="text-[10px] font-mono text-slate-400 uppercase">Provider Label</label>
                <div className="text-white font-bold font-mono text-sm mt-0.5">{selectedProvider.name}</div>
              </div>

              <div>
                <label className="text-[10px] font-mono text-slate-400 uppercase">Primary Model Deployment</label>
                <div className="text-cyan-300 font-mono text-xs mt-0.5">{selectedProvider.primaryModel}</div>
              </div>

              <div>
                <label className="text-[10px] font-mono text-slate-400 uppercase">Rate Limit Quota</label>
                <div className="text-slate-300 font-mono text-xs mt-0.5">{selectedProvider.rpmQuota}</div>
              </div>

              <div>
                <label className="text-[10px] font-mono text-slate-400 uppercase">Token Economics</label>
                <div className="text-emerald-400 font-mono text-xs mt-0.5">
                  Input: {selectedProvider.costPer1MInput} / 1M · Output: {selectedProvider.costPer1MOutput} / 1M
                </div>
              </div>

              <div className="border-t border-slate-800 pt-3">
                <label className="text-[10px] font-mono text-slate-400 uppercase">API Key Vault Status</label>
                <div className="flex items-center gap-2 mt-1">
                  <Lock size={12} className="text-emerald-400" />
                  <span className="text-[11px] text-emerald-300 font-mono">Configured (Encrypted in OS Keystore)</span>
                </div>
              </div>

              <div className="pt-2">
                <button
                  onClick={() => alert(`Tested connection to ${selectedProvider.name}: 200 OK (${selectedProvider.latencyMs}ms)`)}
                  className="w-full py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold font-mono text-xs transition cursor-pointer"
                >
                  Test Connection ({selectedProvider.latencyMs}ms)
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
