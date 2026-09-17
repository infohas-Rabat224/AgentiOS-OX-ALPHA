export interface RepoFile {
  path: string;
  name: string;
  subsystem: string;
  category: string;
  sizeBytes: number;
  highlightedLines: number[];
  content: string;
}

export const REPO_CORE_FILES: RepoFile[] = [
  {
    path: 'core/event_bus/bus.py',
    name: 'bus.py (Event Bus Contract & Impl)',
    subsystem: 'Event Bus',
    category: 'Core Messaging',
    sizeBytes: 1817,
    highlightedLines: [27, 28, 29, 30, 31, 32, 33, 34, 38, 39],
    content: `from __future__ import annotations

import asyncio
from collections.abc import Awaitable, Callable
from core.contracts.event import Event

Handler = Callable[[Event], Awaitable[None]]


class EventBus:
    def __init__(self) -> None:
        self._topics: dict[str, dict[str, Handler]] = {}
        self._tasks: set[asyncio.Task] = set()
        self._lock = asyncio.Lock()
        self._started = False

    async def start(self) -> None:
        self._started = True

    async def stop(self) -> None:
        if self._tasks:
            await asyncio.gather(*self._tasks, return_exceptions=True)
        self._tasks.clear()
        self._started = False

    async def publish(self, event: Event) -> None:
        if not self._started:
            raise RuntimeError("EventBus.publish called before start()")
        handlers = list(self._topics.get(event.topic, {}).values())
        for handler in handlers:
            # BOTTLENECK: Unbounded task creation per subscriber
            task = asyncio.create_task(self._safe_dispatch(handler, event))
            self._tasks.add(task)
            task.add_done_callback(self._tasks.discard)

    async def _safe_dispatch(self, handler: Handler, event: Event) -> None:
        try:
            await handler(event)
        except Exception:
            # BOTTLENECK: Swallowed exceptions hide critical failures
            pass

    async def subscribe(self, topic: str, handler: Handler) -> str:
        sub_id = f"{topic}:{id(handler)}"
        async with self._lock:
            self._topics.setdefault(topic, {})[sub_id] = handler
        return sub_id

    async def unsubscribe(self, subscription_id: str) -> None:
        topic = subscription_id.split(":", 1)[0]
        async with self._lock:
            self._topics.get(topic, {}).pop(subscription_id, None)

    async def drain(self) -> None:
        if self._tasks:
            await asyncio.gather(*self._tasks, return_exceptions=True)`
  },
  {
    path: 'src/agentic_os/core/pipeline/engine.py',
    name: 'pipeline/engine.py (DAG Executor)',
    subsystem: 'PipelineEngine',
    category: 'DAG Execution',
    sizeBytes: 33067,
    highlightedLines: [188, 192, 193, 194, 203, 204, 260, 261, 262, 263],
    content: `# Excerpt from src/agentic_os/core/pipeline/engine.py
async def _run_execution(self, execution: PipelineExecution, pipeline: Pipeline) -> None:
    """Main execution loop for a pipeline."""
    try:
        execution = execution.start()
        self._executions[execution.id] = execution
        await self._emit_event(Topic.PIPELINE_STARTED, execution.id, {"execution": execution.to_dict()})

        stage_map = {s.id: s for s in pipeline.stages}
        adj = defaultdict(list)
        reverse_adj = defaultdict(list)
        in_degree = defaultdict(int)
        for edge in pipeline.edges:
            adj[edge.from_stage].append(edge.to_stage)
            reverse_adj[edge.to_stage].append(edge.from_stage)
            in_degree[edge.to_stage] += 1

        ready_queue = deque([s.id for s in pipeline.stages if in_degree[s.id] == 0])

        while ready_queue and execution.status == PipelineExecutionStatus.RUNNING:
            stage_id = ready_queue.popleft()
            stage = stage_map[stage_id]

            # BOTTLENECK: Busy-wait spinning loop for dependencies
            deps = reverse_adj[stage_id]
            if deps and not all(d in execution.completed_stages for d in deps):
                ready_queue.append(stage_id)
                await asyncio.sleep(0.1)  # 100ms idle polling loop!
                continue

            # BOTTLENECK: Synchronous execution prevents parallel branch concurrency
            execution = execution.set_current_stage(stage_id)
            self._executions[execution.id] = execution
            await self._emit_event(Topic.PIPELINE_STAGE_STARTED, execution.id, {"stage_id": stage_id})

            try:
                output = await self._execute_stage(stage, execution, pipeline)
                execution = execution.complete_stage(stage_id, output)
                self._executions[execution.id] = execution
                await self._emit_event(Topic.PIPELINE_STAGE_COMPLETED, execution.id, {"output": output})
            except Exception as e:
                logger.exception(f"Stage {stage_id} failed in execution {execution.id}")
                execution = execution.fail_stage(stage_id, str(e))
                self._executions[execution.id] = execution
                break

            # BOTTLENECK / BUG: Adds downstream stages on EVERY parent completion without deduplication!
            for target in adj[stage_id]:
                if target not in execution.completed_stages:
                    ready_queue.append(target)  # Causes duplicate runs!`
  },
  {
    path: 'src/agentic_os/core/omniroute/executor.py',
    name: 'executor.py (OmniRoute Execution Engine)',
    subsystem: 'OmniRoute',
    category: 'Provider Invocation & Resilience',
    sizeBytes: 50592,
    highlightedLines: [686, 687, 694, 695, 696, 697, 698, 699, 700],
    content: `# Excerpt from src/agentic_os/core/omniroute/executor.py
async def _record_execution(self, result: ExecutionResult, strategy: str = "single") -> None:
    # BOTTLENECK & DEADLOCK: Acquiring non-reentrant asyncio.Lock
    async with self._lock:
        self._total_executions += 1
        self._total_latency_ms += result.latency_ms
        self._total_tokens_in += result.tokens_in
        self._total_tokens_out += result.tokens_out
        self._latency_histogram.record(result.latency_ms)
        self._ttfb_sum += result.ttfb_ms
        self._retry_count += result.retries
        pid = result.provider
        self._provider_execution_count[pid] = self._provider_execution_count.get(pid, 0) + 1

        if result.state == ExecutionState.COMPLETED:
            self._successful_executions += 1
            # DEADLOCK RISK: Awaiting external event bus publish INSIDE lock!
            # If any listener invokes self.health(), self.metrics(), or self.snapshot(),
            # it attempts to re-acquire self._lock, causing an unrecoverable deadlock!
            await self._publish(
                Topic.EXECUTION_PROVIDER_SUCCESS,
                {
                    "request_id": result.request_id,
                    "provider": result.provider,
                    "model": result.model,
                    "latency_ms": result.latency_ms,
                    "tokens": result.total_tokens,
                },
            )
        elif result.state == ExecutionState.FAILED:
            self._failed_executions += 1
            self._provider_error_count += 1
            pid = result.provider
            self._provider_error_map[pid] = self._provider_error_map.get(pid, 0) + 1
            await self._publish(
                Topic.EXECUTION_PROVIDER_ERROR,
                {
                    "request_id": result.request_id,
                    "provider": result.provider,
                },
            )`
  },
  {
    path: 'src/agentic_os/core/container.py',
    name: 'container.py (DI Container)',
    subsystem: 'DI Container',
    category: 'Kernel Foundation',
    sizeBytes: 17231,
    highlightedLines: [316, 318, 319, 320, 321, 330, 331, 332],
    content: `# Excerpt from src/agentic_os/core/container.py
# ── Resolve Dependencies ──
visited.add(key)
reg.resolving_in.add(resolve_id)
try:
    deps = reg.depends_on or []
    resolved_deps: dict[str, Any] = {}
    if deps:
        hints = {}
        try:
            # BOTTLENECK: get_type_hints parses annotations dynamically on EVERY resolve
            hints = get_type_hints(reg.factory)
        except (TypeError, NameError, AttributeError):
            pass
        for dep_type in deps:
            dep_key = dep_type.__name__
            resolved_deps[dep_key] = self._resolve(dep_key, resolve_id, visited)

    # ── Construct ──
    instance: Any
    if isinstance(reg.factory, type):
        # BOTTLENECK: inspect.signature parses bytecode and AST on EVERY call!
        sig = inspect.signature(reg.factory.__init__)
        params = {}
        for p_name, p_param in sig.parameters.items():
            if p_name == "self":
                continue
            if p_name in resolved_deps:
                params[p_name] = resolved_deps[p_name]
            elif p_param.default is not inspect.Parameter.empty:
                params[p_name] = p_param.default
            else:
                if p_name in hints:
                    hint_type = hints[p_name]
                    # recursive resolution continues...`
  },
  {
    path: 'src/agentic_os/core/omniroute/router.py',
    name: 'router.py (OmniRoute Router)',
    subsystem: 'OmniRoute',
    category: 'Routing Brain',
    sizeBytes: 55118,
    highlightedLines: [419, 420, 421, 646, 647, 648, 649, 650, 651],
    content: `# Excerpt from src/agentic_os/core/omniroute/router.py
async def route_many(self, requests: list[RoutingRequest]) -> list[RoutingDecision]:
    """Route multiple requests sequentially and return decisions in order."""
    # BOTTLENECK: Serial list comprehension throws away async parallelism!
    return [await self.route(r) for r in requests]

async def _filter_unhealthy_disabled(
    self,
    providers: list[OmniRouteProvider],
    models: list[OmniRouteModel],
) -> list[_Candidate]:
    """Remove unhealthy providers, disabled providers, and disabled models."""
    valid_providers = [p for p in providers if p.enabled and p.healthy]
    valid_models = [m for m in models if m.enabled]
    candidates: list[_Candidate] = []
    provider_map: dict[str, OmniRouteProvider] = {p.id: p for p in valid_providers}
    for m in valid_models:
        provider = provider_map.get(m.provider_id)
        if provider is None:
            # BOTTLENECK: Linear O(P) scan for EVERY model! O(N * P) total cost
            for p in valid_providers:
                if p.name == m.provider:
                    provider = p
                    break
        if provider is not None:
            candidates.append(_Candidate(provider=provider, model=m))
    return candidates`
  },
  {
    path: 'src/agentic_os/core/lifecycle.py',
    name: 'lifecycle.py (Lifecycle Manager)',
    subsystem: 'Lifecycle',
    category: 'Kernel Runtime',
    sizeBytes: 24926,
    highlightedLines: [235, 237, 246, 247, 252, 253],
    content: `# Excerpt from src/agentic_os/core/lifecycle.py
async def start_phase(self, phase: Phase) -> PhaseResult:
    """Start all services in a phase. Blocks until all healthy or timeout.
    Every service goes through: INITIALIZING -> LOADING -> READY -> HEALTHY
    """
    started_at = datetime.now(UTC)
    services = self.get_services_by_phase(phase)
    if not services:
        result = PhaseResult(phase=phase, success=True, duration_ms=0.0)
        self._phase_results[phase] = result
        return result

    self.current_phase = phase
    log.info("Starting phase %s (%d services)", phase.value, len(services))

    # BOTTLENECK: Services in the same phase are initialized strictly SERIALLY!
    for record in services:
        service_id = record.id
        try:
            # 1. INITIALIZING
            await self._transition(service_id, ServiceState.INITIALIZING)
            if record.hooks and record.hooks.before_start:
                record.hooks.before_start()

            # Sequential initialize await
            await asyncio.wait_for(_initialize(record.instance), timeout=self.phase_timeout)
            await self._transition(service_id, ServiceState.LOADING)

            # Sequential start await
            await asyncio.wait_for(_start(record.instance), timeout=self.phase_timeout)`
  }
];
