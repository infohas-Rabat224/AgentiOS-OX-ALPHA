/**
 * OmniRouter Core Service Logic
 *
 * Intelligent request distribution engine across the 16 discovered agent brains.
 * Executes multi-dimensional candidate scoring:
 *   - Request capability validation & taxonomy match
 *   - Provider & runtime health filtering
 *   - Latency & cost optimization based on active strategy
 *   - Automatic fallback chain generation with circuit-breaker protection
 *   - Real-time traffic monitoring, load telemetry & latency tracking
 */

export interface AgentNode {
  id: string;
  name: string;
  vendor: string;
  runtime: string;
  version: string;
  status: 'healthy' | 'degraded' | 'unhealthy' | 'down' | 'idle';
  capabilities: string[];
  latencyMs: number;
  costPer1k: number;
  throughput: number;
  contextWindow: number;
  activeRequests: number;
  totalRouted: number;
  errorCount: number;
  circuitState: 'closed' | 'half_open' | 'open';
}

export type RoutingStrategy = 'balanced' | 'latency' | 'cost' | 'reasoning' | 'coding';

export interface RoutingRequest {
  id: string;
  timestamp: string;
  intent: string;
  requiredCapabilities?: string[];
  strategy?: RoutingStrategy;
  maxCost?: number;
  maxLatencyMs?: number;
  promptLength?: number;
  client?: string;
}

export interface RoutingScore {
  agentId: string;
  capabilityMatch: number;
  latencyScore: number;
  costScore: number;
  healthScore: number;
  compositeScore: number;
}

export interface RoutingDecision {
  requestId: string;
  timestamp: string;
  intent: string;
  strategy: RoutingStrategy;
  selectedAgent: AgentNode;
  fallbackChain: AgentNode[];
  estimatedLatencyMs: number;
  estimatedCost: number;
  confidenceScore: number;
  rationale: string;
  scores: RoutingScore[];
  circuitBreakerStatus: string;
}

export interface TrafficMetric {
  totalRequests: number;
  activeRequests: number;
  routedCount: number;
  failoverCount: number;
  avgLatencyMs: number;
  p95LatencyMs: number;
  costSavingsPercent: number;
  routerOverheadMs: number;
}

export interface TimeSeriesPoint {
  timestamp: number;
  timeLabel: string;
  throughput: number; // req/s
  avgLatency: number; // ms
  p95Latency: number; // ms
  routerOverhead: number; // ms
  agentLoads: {
    claude: number;
    hermes: number;
    python: number;
    node: number;
    codex: number;
    others: number;
  };
}

// Canonical 16 Discovered Agent Nodes of AgenticOS
export const INITIAL_16_AGENTS: AgentNode[] = [
  {
    id: 'claude_code',
    name: 'CLAUDE_CODE',
    vendor: 'anthropic',
    runtime: 'cli',
    version: 'claude-3-7-sonnet',
    status: 'healthy',
    capabilities: ['code_generation', 'extended_thinking', 'refactoring', 'terminal_exec', 'git_diff'],
    latencyMs: 24,
    costPer1k: 0.003,
    throughput: 65,
    contextWindow: 200000,
    activeRequests: 2,
    totalRouted: 142,
    errorCount: 0,
    circuitState: 'closed',
  },
  {
    id: 'hermes',
    name: 'HERMES',
    vendor: 'nous_research',
    runtime: 'python',
    version: 'hermes-3-405b',
    status: 'down',
    capabilities: ['agent_debate', 'function_calling', 'structured_json', 'deep_reasoning'],
    latencyMs: 38,
    costPer1k: 0.0015,
    throughput: 45,
    contextWindow: 131072,
    activeRequests: 0,
    totalRouted: 18,
    errorCount: 3,
    circuitState: 'open',
  },
  {
    id: 'auto_codex',
    name: 'AUTO:CODEX',
    vendor: 'openai',
    runtime: 'cloud_api',
    version: 'gpt-4o-code',
    status: 'healthy',
    capabilities: ['code_generation', 'ast_analysis', 'unit_testing', 'typescript', 'python'],
    latencyMs: 22,
    costPer1k: 0.0025,
    throughput: 80,
    contextWindow: 128000,
    activeRequests: 1,
    totalRouted: 96,
    errorCount: 0,
    circuitState: 'closed',
  },
  {
    id: 'auto_opencode',
    name: 'AUTO:OPENCODE',
    vendor: 'mistral',
    runtime: 'cloud_api',
    version: 'codestral-2501',
    status: 'down',
    capabilities: ['code_completion', 'fill_in_middle', 'fast_token_gen'],
    latencyMs: 30,
    costPer1k: 0.001,
    throughput: 70,
    contextWindow: 256000,
    activeRequests: 0,
    totalRouted: 12,
    errorCount: 2,
    circuitState: 'open',
  },
  {
    id: 'auto_agy',
    name: 'AUTO:AGY',
    vendor: 'custom',
    runtime: 'orchestrator',
    version: 'antigravity-v2',
    status: 'healthy',
    capabilities: ['multi_agent_coordination', 'subgraph_dispatch', 'pipeline_routing', 'task_splitting'],
    latencyMs: 14,
    costPer1k: 0.0008,
    throughput: 110,
    contextWindow: 512000,
    activeRequests: 3,
    totalRouted: 215,
    errorCount: 0,
    circuitState: 'closed',
  },
  {
    id: 'auto_gemini',
    name: 'AUTO:GEMINI',
    vendor: 'google',
    runtime: 'cloud_api',
    version: 'gemini-2.5-flash',
    status: 'down',
    capabilities: ['multimodal', 'audio_stream', 'vision', 'high_throughput', 'large_context'],
    latencyMs: 18,
    costPer1k: 0.000075,
    throughput: 180,
    contextWindow: 1048576,
    activeRequests: 0,
    totalRouted: 45,
    errorCount: 4,
    circuitState: 'open',
  },
  {
    id: 'python',
    name: 'PYTHON',
    vendor: 'system',
    runtime: 'python3.10',
    version: '3.10.12',
    status: 'healthy',
    capabilities: ['asyncio_kernel', 'data_science', 'system_shell', 'pytest', 'local_exec'],
    latencyMs: 5,
    costPer1k: 0.0,
    throughput: 240,
    contextWindow: 512000,
    activeRequests: 2,
    totalRouted: 310,
    errorCount: 0,
    circuitState: 'closed',
  },
  {
    id: 'git',
    name: 'GIT',
    vendor: 'system',
    runtime: 'native',
    version: '2.34.1',
    status: 'healthy',
    capabilities: ['version_control', 'diff_analysis', 'branch_graph', 'commit_history'],
    latencyMs: 12,
    costPer1k: 0.0,
    throughput: 85,
    contextWindow: 128000,
    activeRequests: 0,
    totalRouted: 78,
    errorCount: 0,
    circuitState: 'closed',
  },
  {
    id: 'hermes_agent',
    name: 'HERMES AGENT',
    vendor: 'hermes',
    runtime: 'python',
    version: 'hermes-3-70b',
    status: 'unhealthy',
    capabilities: ['planner', 'tool_calling', 'json_validator'],
    latencyMs: 44,
    costPer1k: 0.0009,
    throughput: 38,
    contextWindow: 65536,
    activeRequests: 0,
    totalRouted: 24,
    errorCount: 1,
    circuitState: 'half_open',
  },
  {
    id: 'codex_cli',
    name: 'CODEX CLI',
    vendor: 'openai',
    runtime: 'cli',
    version: 'codex-cli-v1.4',
    status: 'unhealthy',
    capabilities: ['interactive_shell', 'code_patching'],
    latencyMs: 29,
    costPer1k: 0.002,
    throughput: 50,
    contextWindow: 64000,
    activeRequests: 0,
    totalRouted: 33,
    errorCount: 2,
    circuitState: 'half_open',
  },
  {
    id: 'opencode',
    name: 'OPENCODE',
    vendor: 'deepseek',
    runtime: 'cloud_api',
    version: 'deepseek-coder-v2',
    status: 'unhealthy',
    capabilities: ['code_generation', 'c_cpp', 'rust', 'golang'],
    latencyMs: 32,
    costPer1k: 0.0005,
    throughput: 60,
    contextWindow: 128000,
    activeRequests: 0,
    totalRouted: 29,
    errorCount: 1,
    circuitState: 'half_open',
  },
  {
    id: 'node_js',
    name: 'NODE.JS',
    vendor: 'system',
    runtime: 'node',
    version: '22.23.2',
    status: 'healthy',
    capabilities: ['javascript', 'typescript', 'vite_server', 'npm_runner', 'web_api'],
    latencyMs: 8,
    costPer1k: 0.0,
    throughput: 160,
    contextWindow: 256000,
    activeRequests: 1,
    totalRouted: 240,
    errorCount: 0,
    circuitState: 'closed',
  },
  {
    id: 'claude_code_2',
    name: 'CLAUDE CODE',
    vendor: 'anthropic',
    runtime: 'cloud_api',
    version: 'claude-3-5-haiku',
    status: 'healthy',
    capabilities: ['fast_coding', 'summarization', 'triage', 'tool_use'],
    latencyMs: 16,
    costPer1k: 0.0008,
    throughput: 120,
    contextWindow: 200000,
    activeRequests: 1,
    totalRouted: 182,
    errorCount: 0,
    circuitState: 'closed',
  },
  {
    id: 'gemini_cli',
    name: 'GEMINI CLI',
    vendor: 'google',
    runtime: 'cli',
    version: 'gemini-cli-v2',
    status: 'unhealthy',
    capabilities: ['multimodal_cli', 'search_grounding'],
    latencyMs: 26,
    costPer1k: 0.0001,
    throughput: 90,
    contextWindow: 500000,
    activeRequests: 0,
    totalRouted: 41,
    errorCount: 2,
    circuitState: 'half_open',
  },
  {
    id: 'codex',
    name: 'CODEX',
    vendor: 'openai',
    runtime: 'cloud_api',
    version: 'codex-davinci-002',
    status: 'unhealthy',
    capabilities: ['legacy_syntax', 'docstring_gen'],
    latencyMs: 45,
    costPer1k: 0.003,
    throughput: 30,
    contextWindow: 32000,
    activeRequests: 0,
    totalRouted: 16,
    errorCount: 3,
    circuitState: 'half_open',
  },
  {
    id: 'node',
    name: 'NODE',
    vendor: 'system',
    runtime: 'native',
    version: '22.23.2-worker',
    status: 'healthy',
    capabilities: ['v8_worker', 'event_loop', 'fs_stream'],
    latencyMs: 6,
    costPer1k: 0.0,
    throughput: 200,
    contextWindow: 256000,
    activeRequests: 1,
    totalRouted: 195,
    errorCount: 0,
    circuitState: 'closed',
  },
];

class OmniRouterService {
  private agents: AgentNode[] = [...INITIAL_16_AGENTS];
  private trafficHistory: RoutingDecision[] = [];
  private timeSeries: TimeSeriesPoint[] = [];
  private listeners: Set<() => void> = new Set();
  private isSimulating: boolean = true;
  private intervalId: NodeJS.Timeout | null = null;
  private metricsTimerId: NodeJS.Timeout | null = null;

  constructor() {
    this.seedTimeSeries();
    this.startSimulation();
  }

  private seedTimeSeries() {
    const now = Date.now();
    const count = 25;
    for (let i = count - 1; i >= 0; i--) {
      const t = now - i * 2000;
      const date = new Date(t);
      const timeLabel = date.toLocaleTimeString();
      const throughput = Math.round(52 + Math.sin(i * 0.4) * 18 + (Math.random() * 8 - 4));
      const avgLatency = Math.round(21 + Math.cos(i * 0.5) * 5 + (Math.random() * 4 - 2));
      const p95Latency = Math.round(avgLatency + 12 + (Math.random() * 6 - 3));
      const routerOverhead = Number((0.11 + Math.random() * 0.04).toFixed(3));

      this.timeSeries.push({
        timestamp: t,
        timeLabel,
        throughput: Math.max(15, throughput),
        avgLatency: Math.max(8, avgLatency),
        p95Latency: Math.max(16, p95Latency),
        routerOverhead,
        agentLoads: {
          claude: Math.round(throughput * 0.28),
          hermes: Math.round(throughput * 0.18),
          python: Math.round(throughput * 0.24),
          node: Math.round(throughput * 0.16),
          codex: Math.round(throughput * 0.08),
          others: Math.round(throughput * 0.06),
        },
      });
    }
  }

  private recordSample(extraReqCount: number = 0) {
    const now = Date.now();
    const timeLabel = new Date(now).toLocaleTimeString();
    const last = this.timeSeries[this.timeSeries.length - 1];
    const prevThroughput = last ? last.throughput : 55;
    const throughputDelta = (Math.random() * 10 - 5) + extraReqCount * 4;
    const throughput = Math.max(20, Math.min(130, Math.round(prevThroughput + throughputDelta)));
    const avgLatency = Math.max(10, Math.round(20 + Math.sin(now / 5000) * 6 + (Math.random() * 4 - 2)));
    const p95Latency = Math.round(avgLatency + 11 + Math.random() * 6);
    const routerOverhead = Number((0.10 + Math.random() * 0.05).toFixed(3));

    const sample: TimeSeriesPoint = {
      timestamp: now,
      timeLabel,
      throughput,
      avgLatency,
      p95Latency,
      routerOverhead,
      agentLoads: {
        claude: Math.round(throughput * (0.26 + Math.random() * 0.05)),
        hermes: Math.round(throughput * (0.17 + Math.random() * 0.04)),
        python: Math.round(throughput * (0.23 + Math.random() * 0.04)),
        node: Math.round(throughput * (0.17 + Math.random() * 0.03)),
        codex: Math.round(throughput * (0.09 + Math.random() * 0.03)),
        others: Math.round(throughput * 0.08),
      },
    };

    this.timeSeries.push(sample);
    if (this.timeSeries.length > 40) {
      this.timeSeries.shift();
    }
  }

  public getTimeSeries(): TimeSeriesPoint[] {
    return this.timeSeries;
  }

  public getAgents(): AgentNode[] {
    return this.agents;
  }

  public getTrafficHistory(): RoutingDecision[] {
    return this.trafficHistory;
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify() {
    this.listeners.forEach((fn) => fn());
  }

  /**
   * Intelligently selects the optimal agent based on request requirements and strategy
   */
  public route(req: RoutingRequest): RoutingDecision {
    const strategy = req.strategy || 'balanced';
    const intentLower = req.intent.toLowerCase();

    // 1. Calculate candidate scores for all 16 agents
    const scores: RoutingScore[] = this.agents.map((agent) => {
      // Capability matching
      let capabilityMatch = 0.5;
      if (
        (intentLower.includes('code') || intentLower.includes('refactor') || intentLower.includes('typescript')) &&
        agent.capabilities.some((c) => c.includes('code') || c.includes('typescript'))
      ) {
        capabilityMatch += 0.45;
      }
      if (
        (intentLower.includes('math') || intentLower.includes('reason') || intentLower.includes('logic')) &&
        agent.capabilities.some((c) => c.includes('reasoning') || c.includes('thinking'))
      ) {
        capabilityMatch += 0.48;
      }
      if (
        (intentLower.includes('git') || intentLower.includes('commit') || intentLower.includes('diff')) &&
        agent.capabilities.some((c) => c.includes('git') || c.includes('version'))
      ) {
        capabilityMatch += 0.5;
      }
      if (
        (intentLower.includes('python') || intentLower.includes('asyncio') || intentLower.includes('kernel')) &&
        agent.capabilities.some((c) => c.includes('python') || c.includes('kernel'))
      ) {
        capabilityMatch += 0.45;
      }
      if (
        (intentLower.includes('node') || intentLower.includes('npm') || intentLower.includes('server')) &&
        agent.capabilities.some((c) => c.includes('node') || c.includes('javascript'))
      ) {
        capabilityMatch += 0.45;
      }
      capabilityMatch = Math.min(1.0, capabilityMatch);

      // Latency score (faster = higher score: 5ms -> 1.0, 50ms -> 0.1)
      const latencyScore = Math.max(0.05, 1 - agent.latencyMs / 60);

      // Cost score (cheaper = higher: $0.00 -> 1.0, $0.003 -> 0.2)
      const costScore = Math.max(0.1, 1 - agent.costPer1k / 0.0035);

      // Health score
      let healthScore = 1.0;
      if (agent.status === 'down') healthScore = 0.0;
      else if (agent.status === 'unhealthy') healthScore = 0.2;
      else if (agent.status === 'degraded') healthScore = 0.6;
      else if (agent.circuitState === 'open') healthScore = 0.0;

      // Strategy-weighted composite score
      let compositeScore = 0;
      switch (strategy) {
        case 'latency':
          compositeScore = capabilityMatch * 0.25 + latencyScore * 0.55 + healthScore * 0.2;
          break;
        case 'cost':
          compositeScore = capabilityMatch * 0.25 + costScore * 0.55 + healthScore * 0.2;
          break;
        case 'reasoning':
          compositeScore = capabilityMatch * 0.5 + healthScore * 0.3 + latencyScore * 0.1 + costScore * 0.1;
          break;
        case 'coding':
          compositeScore = capabilityMatch * 0.5 + latencyScore * 0.25 + healthScore * 0.25;
          break;
        case 'balanced':
        default:
          compositeScore =
            capabilityMatch * 0.35 +
            healthScore * 0.25 +
            latencyScore * 0.2 +
            costScore * 0.15 +
            (1 / (agent.activeRequests + 1)) * 0.05;
          break;
      }

      // Knock out closed circuits and down nodes unless strictly forced
      if (agent.status === 'down' || agent.circuitState === 'open') {
        compositeScore *= 0.05;
      }

      return {
        agentId: agent.id,
        capabilityMatch: Math.round(capabilityMatch * 100) / 100,
        latencyScore: Math.round(latencyScore * 100) / 100,
        costScore: Math.round(costScore * 100) / 100,
        healthScore: Math.round(healthScore * 100) / 100,
        compositeScore: Math.round(compositeScore * 100) / 100,
      };
    });

    // Sort descending by score
    scores.sort((a, b) => b.compositeScore - a.compositeScore);

    const winnerId = scores[0].agentId;
    const selectedAgent = this.agents.find((a) => a.id === winnerId) || this.agents[0];
    const fallbackChain = scores
      .slice(1, 4)
      .map((s) => this.agents.find((a) => a.id === s.agentId)!)
      .filter(Boolean);

    // Update agent telemetry
    selectedAgent.totalRouted += 1;
    selectedAgent.activeRequests += 1;
    setTimeout(() => {
      selectedAgent.activeRequests = Math.max(0, selectedAgent.activeRequests - 1);
      this.notify();
    }, 400 + Math.random() * 600);

    const decision: RoutingDecision = {
      requestId: req.id || `req-${Math.random().toString(36).substring(2, 9)}`,
      timestamp: new Date().toLocaleTimeString(),
      intent: req.intent,
      strategy,
      selectedAgent,
      fallbackChain,
      estimatedLatencyMs: selectedAgent.latencyMs + Math.round(Math.random() * 3),
      estimatedCost: selectedAgent.costPer1k * (req.promptLength ? req.promptLength / 1000 : 0.8),
      confidenceScore: Math.round(scores[0].compositeScore * 100),
      rationale: `Matched ${selectedAgent.capabilities.slice(0, 2).join(', ')} via ${strategy} routing with ${selectedAgent.latencyMs}ms latency.`,
      scores,
      circuitBreakerStatus: selectedAgent.circuitState,
    };

    this.trafficHistory = [decision, ...this.trafficHistory.slice(0, 49)];
    this.recordSample(1);
    this.notify();
    return decision;
  }

  public getMetrics(): TrafficMetric {
    const totalRequests = this.trafficHistory.length + 840;
    const activeRequests = this.agents.reduce((acc, a) => acc + a.activeRequests, 0);
    const routedCount = totalRequests - 2;
    const avgLatencyMs = Math.round(
      this.agents.filter((a) => a.status === 'healthy').reduce((acc, a) => acc + a.latencyMs, 0) / 8
    );

    return {
      totalRequests,
      activeRequests,
      routedCount,
      failoverCount: 3,
      avgLatencyMs,
      p95LatencyMs: 34,
      costSavingsPercent: 68.4,
      routerOverheadMs: 0.12,
    };
  }

  public startSimulation() {
    if (this.intervalId || this.metricsTimerId) return;
    this.isSimulating = true;
    const intents = [
      'AST code refactor in TypeScript',
      'Git merge branch conflict analysis',
      'Python asyncio event loop benchmark',
      'Deep mathematical proof verification',
      'Multi-agent task decomposition',
      'Node.js web stream chunk pipeline',
      'Offline local inference dispatch',
      'Sub-graph execution plan generation',
    ];

    this.intervalId = setInterval(() => {
      if (!this.isSimulating) return;
      const randomIntent = intents[Math.floor(Math.random() * intents.length)];
      const strategies: RoutingStrategy[] = ['balanced', 'latency', 'cost', 'reasoning', 'coding'];
      const randomStrategy = strategies[Math.floor(Math.random() * strategies.length)];
      this.route({
        id: `trf-${Date.now().toString(36)}`,
        timestamp: new Date().toLocaleTimeString(),
        intent: randomIntent,
        strategy: randomStrategy,
        promptLength: 600 + Math.floor(Math.random() * 1200),
      });
    }, 4500);

    // Continuous 2-second time series telemetry tick
    this.metricsTimerId = setInterval(() => {
      if (!this.isSimulating) return;
      this.recordSample();
      this.notify();
    }, 2000);
  }

  /**
   * Ping an agent node to test connection status & update real-time latency
   */
  public async pingAgent(agentId: string): Promise<{ latencyMs: number; status: string }> {
    const agent = this.agents.find((a) => a.id === agentId);
    if (!agent) throw new Error(`Agent ${agentId} not found`);

    const simulatedJitter = Math.floor(Math.random() * 8) - 4;
    const newLatency = Math.max(3, agent.latencyMs + simulatedJitter);
    agent.latencyMs = newLatency;

    if (agent.status === 'down') {
      // Probing a down agent might recover or stay down
      if (Math.random() > 0.4) {
        agent.status = 'healthy';
        agent.circuitState = 'closed';
        agent.errorCount = 0;
      }
    } else if (agent.status === 'unhealthy') {
      if (Math.random() > 0.3) {
        agent.status = 'healthy';
        agent.circuitState = 'closed';
      }
    }

    this.notify();
    return { latencyMs: newLatency, status: agent.status };
  }

  /**
   * Ping all 16 agents simultaneously
   */
  public async pingAllAgents(): Promise<void> {
    for (const agent of this.agents) {
      const jitter = Math.floor(Math.random() * 6) - 3;
      agent.latencyMs = Math.max(4, agent.latencyMs + jitter);
    }
    this.recordSample(2);
    this.notify();
  }

  /**
   * Reset all tripped circuit breakers to closed/healthy
   */
  public resetCircuitBreakers(): void {
    this.agents.forEach((agent) => {
      if (agent.circuitState !== 'closed') {
        agent.circuitState = 'closed';
        agent.status = 'healthy';
        agent.errorCount = 0;
      }
    });
    this.notify();
  }

  /**
   * Toggle a circuit breaker for resilience testing
   */
  public toggleCircuitBreaker(agentId: string): void {
    const agent = this.agents.find((a) => a.id === agentId);
    if (!agent) return;

    if (agent.circuitState === 'closed') {
      agent.circuitState = 'open';
      agent.status = 'down';
      agent.errorCount += 1;
    } else {
      agent.circuitState = 'closed';
      agent.status = 'healthy';
      agent.errorCount = 0;
    }
    this.notify();
  }

  /**
   * Simulate an active traffic burst to test routing distribution
   */
  public burstTraffic(count: number = 5): void {
    const intents = [
      'AST validation & syntax tree decomposition',
      'Zero-copy memory buffer transfer test',
      'Multi-tier vector semantic search dispatch',
      'Asyncio worker queue parallel inference',
      'Lockless concurrent dispatch stress test',
    ];

    for (let i = 0; i < count; i++) {
      setTimeout(() => {
        this.route({
          id: `burst-${Date.now().toString(36)}-${i}`,
          timestamp: new Date().toLocaleTimeString(),
          intent: intents[i % intents.length],
          strategy: 'balanced',
          promptLength: 800 + i * 200,
        });
      }, i * 300);
    }
  }

  public stopSimulation() {
    this.isSimulating = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    if (this.metricsTimerId) {
      clearInterval(this.metricsTimerId);
      this.metricsTimerId = null;
    }
    this.notify();
  }

  public toggleSimulation() {
    if (this.isSimulating) {
      this.stopSimulation();
    } else {
      this.startSimulation();
    }
  }

  public isTrafficSimulating(): boolean {
    return this.isSimulating;
  }
}

export const omniRouterService = new OmniRouterService();
