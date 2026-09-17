import http from 'node:http';

export interface EventBusEnvelope<T = any> {
  id: string;
  topic: string;
  timestamp: string;
  epochMs: number;
  source: string;
  payload: T;
  metadata?: Record<string, any>;
}

export type EventBusSubscriber<T = any> = (event: EventBusEnvelope<T>) => void | Promise<void>;

/**
 * AgenticOS Central Event Bus
 * 
 * Implements a high-performance in-process event streaming bus adhering to the
 * AgenticOS Hexagonal Architecture. Connects Ingress Gateways, Normalizers,
 * Access Controllers, and Agent Brains.
 */
export class AgenticOSEventBus {
  private static instance: AgenticOSEventBus;
  private subscribers: Map<string, Set<EventBusSubscriber>> = new Map();
  private wildcardSubscribers: Set<EventBusSubscriber> = new Set();
  private eventHistory: EventBusEnvelope[] = [];
  private maxHistory = 250;
  private kernelForwarding = true;

  public static getInstance(): AgenticOSEventBus {
    if (!AgenticOSEventBus.instance) {
      AgenticOSEventBus.instance = new AgenticOSEventBus();
    }
    return AgenticOSEventBus.instance;
  }

  /**
   * Subscribes to a specific event topic or wildcard pattern (e.g. "gateway.*")
   */
  public subscribe<T = any>(topic: string, handler: EventBusSubscriber<T>): () => void {
    if (topic === '*' || topic === '#') {
      this.wildcardSubscribers.add(handler);
      return () => this.wildcardSubscribers.delete(handler);
    }

    if (!this.subscribers.has(topic)) {
      this.subscribers.set(topic, new Set());
    }
    this.subscribers.get(topic)!.add(handler as EventBusSubscriber);

    return () => {
      this.subscribers.get(topic)?.delete(handler as EventBusSubscriber);
    };
  }

  /**
   * Publishes an event to the bus and dispatches to all matching subscribers.
   */
  public publish<T = any>(
    topic: string,
    payload: T,
    source = 'gateway-subsystem',
    metadata?: Record<string, any>
  ): EventBusEnvelope<T> {
    const envelope: EventBusEnvelope<T> = {
      id: `evb-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
      topic,
      timestamp: new Date().toISOString(),
      epochMs: Date.now(),
      source,
      payload,
      metadata,
    };

    // Store in ring buffer
    this.eventHistory.unshift(envelope);
    if (this.eventHistory.length > this.maxHistory) {
      this.eventHistory.pop();
    }

    // Direct topic subscribers
    const directSubs = this.subscribers.get(topic);
    if (directSubs) {
      for (const handler of directSubs) {
        try {
          handler(envelope);
        } catch (err: any) {
          console.error(`[EventBus] Handler error for topic ${topic}:`, err.message);
        }
      }
    }

    // Pattern prefix matching (e.g. "gateway.*")
    for (const [subTopic, handlers] of this.subscribers.entries()) {
      if (subTopic.endsWith('.*')) {
        const prefix = subTopic.slice(0, -2);
        if (topic.startsWith(prefix)) {
          for (const handler of handlers) {
            try {
              handler(envelope);
            } catch (err: any) {
              console.error(`[EventBus] Pattern handler error for ${subTopic}:`, err.message);
            }
          }
        }
      }
    }

    // Wildcard subscribers
    for (const handler of this.wildcardSubscribers) {
      try {
        handler(envelope);
      } catch (err: any) {
        console.error('[EventBus] Wildcard handler error:', err.message);
      }
    }

    // Forward to native kernel daemon if online (async non-blocking)
    if (this.kernelForwarding && !topic.startsWith('telemetry.')) {
      this.forwardToKernelDaemon(envelope).catch(() => {});
    }

    return envelope;
  }

  private async forwardToKernelDaemon(envelope: EventBusEnvelope) {
    try {
      const payloadStr = JSON.stringify({
        event: envelope.topic,
        id: envelope.id,
        source: envelope.source,
        timestamp: envelope.timestamp,
        payload: envelope.payload,
      });

      const req = http.request({
        hostname: '127.0.0.1',
        port: 8001,
        path: '/api/eventbus/publish',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payloadStr),
        },
        timeout: 200,
      });

      req.on('error', () => {
        // Kernel daemon not running on port 8001 - silent fallback
      });
      req.write(payloadStr);
      req.end();
    } catch {}
  }

  public getHistory(topicFilter?: string, limit = 50): EventBusEnvelope[] {
    if (!topicFilter) {
      return this.eventHistory.slice(0, limit);
    }
    return this.eventHistory
      .filter((e) => e.topic === topicFilter || e.topic.startsWith(topicFilter.replace('*', '')))
      .slice(0, limit);
  }

  public clearHistory() {
    this.eventHistory = [];
  }
}

export const agenticOSEventBus = AgenticOSEventBus.getInstance();
