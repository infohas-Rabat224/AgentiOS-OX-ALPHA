from __future__ import annotations

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
            # Backpressure guard: if tasks backlog exceeds 2048, yield momentarily to event loop
            if len(self._tasks) > 2048:
                await asyncio.sleep(0)
            task = asyncio.create_task(self._safe_dispatch(handler, event))
            self._tasks.add(task)
            task.add_done_callback(self._tasks.discard)

    async def _safe_dispatch(self, handler: Handler, event: Event) -> None:
        try:
            await handler(event)
        except Exception as exc:
            import logging
            logging.getLogger("event_bus").warning("Handler failed for topic %s: %s", event.topic, exc)

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
            await asyncio.gather(*self._tasks, return_exceptions=True)
