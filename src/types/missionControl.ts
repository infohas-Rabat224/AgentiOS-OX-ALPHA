// AgenticOS Mission Control & Brain Registry Domain Types

export type BrainStatus =
  | 'discovered'
  | 'registered'
  | 'connected'
  | 'disconnected'
  | 'busy'
  | 'idle'
  | 'executing'
  | 'healthy'
  | 'unhealthy'
  | 'degraded'
  | 'failed'
  | 'removed'
  | 'paused'
  | 'resumed'
  | 'restarting'
  | 'shutdown'
  | 'recovering';

export type BrainType = 'local_cli' | 'cloud_api' | 'orchestrator' | 'mcp_server' | 'custom';

export type BrainVendor =
  | 'openai'
  | 'anthropic'
  | 'google'
  | 'mistral'
  | 'groq'
  | 'azure'
  | 'aws'
  | 'vertex'
  | 'openrouter'
  | 'cohere'
  | 'deepseek'
  | 'qwen'
  | 'moonshot'
  | 'together'
  | 'fireworks'
  | 'replicate'
  | 'ollama'
  | 'lm_studio'
  | 'vllm'
  | 'hermes'
  | 'claude_code'
  | 'gemini_cli'
  | 'codex'
  | 'opencode'
  | 'aider'
  | 'continue'
  | 'github_copilot'
  | 'cursor'
  | 'custom';

export type BrainRuntime =
  | 'python'
  | 'node'
  | 'go'
  | 'rust'
  | 'container'
  | 'native'
  | 'cloud'
  | 'unknown'
  | 'bun'
  | 'deno';

export type RelationshipType =
  | 'parent'
  | 'child'
  | 'peer'
  | 'executor'
  | 'planner'
  | 'reviewer'
  | 'observer'
  | 'fallback'
  | 'consensus'
  | 'delegation'
  | 'tool_usage'
  | 'shared_context';

export interface BrainRecord {
  id: string;
  display_name: string;
  brain_type: BrainType;
  vendor: BrainVendor;
  runtime: BrainRuntime;
  version: string;
  status: BrainStatus;
  health: 'healthy' | 'degraded' | 'unhealthy' | 'unknown' | number;
  capabilities: string[];
  supported_models: string[];
  supported_tools: string[];
  memory_usage: number; // MB
  cpu_usage: number; // %
  latency: number; // ms
  throughput: number; // req/s
  workspace: string;
  current_tasks: number;
  queue_depth: number;
  active_models: number;
  available_context: number;
  connection_state: 'connected' | 'disconnected' | 'reconnecting';
  uptime: number;
  heartbeat: string | number;
  tags: string[];
  priority: number;
  metadata: Record<string, any>;
  discovered_at: string;
  last_seen: string;
  session_count: number;
  error_count: number;
  last_error: string | null;
}

export interface BrainRelationship {
  id: string;
  source_id: string;
  target_id: string;
  relationship_type: RelationshipType;
  weight: number;
  active: boolean;
  metadata?: Record<string, any>;
}

export interface MissionType {
  id: string;
  title: string;
  status: 'planning' | 'running' | 'paused' | 'completed' | 'failed';
  assigned_agents: string[];
  progress: number;
  total_steps: number;
  completed_steps: number;
  started_at: string;
  runtime_seconds: number;
}

export interface SystemEvent {
  id: string;
  timestamp: string;
  subsystem: string;
  level: 'info' | 'warn' | 'error' | 'success';
  message: string;
  details?: Record<string, any>;
}
