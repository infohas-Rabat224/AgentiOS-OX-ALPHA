import {
  GatewayConnectionState,
  GatewayPlatform,
  MessageEnvelope,
  GatewayEvent,
  AllowlistEntry,
  GatewayDiagnostics,
} from '../server/messagingGatewayService';

export interface FullGatewayStatus {
  whatsapp: {
    state: GatewayConnectionState;
    account: string | null;
    qrDataUrl: string | null;
    qrRaw?: string | null;
    qrGeneratedAt?: number | null;
    ttlRemainingSeconds?: number;
    diagnostics: GatewayDiagnostics;
  };
  telegram: {
    state: GatewayConnectionState;
    botUsername?: string;
    botId?: number;
    botName?: string;
    diagnostics: GatewayDiagnostics;
  };
  vault?: {
    status: string;
    storageEngine: string;
    keysCount: number;
    vaultPath: string;
    hardwareEntropyAvailable: boolean;
  };
  policy: 'allowlist_only' | 'trusted_open' | 'admin_only';
  defaultAgent: string;
  allowlist: AllowlistEntry[];
  auditLogs?: Array<{
    id: string;
    timestamp: string;
    platform: GatewayPlatform;
    identifier: string;
    senderName: string;
    role: string;
    allowed: boolean;
    reason: string;
    actionTaken: string;
  }>;
  recentMessages: MessageEnvelope[];
  recentEvents: GatewayEvent[];
}

export interface SystemTelemetry {
  status: string;
  platform: string;
  arch: string;
  release: string;
  cpuCount: number;
  cpuModel: string;
  loadAvg: number[];
  cpuPercent: number;
  memory: {
    totalBytes: number;
    freeBytes: number;
    usedBytes: number;
    usedPercent: number;
    processRssBytes: number;
    processHeapUsedBytes: number;
  };
  uptimeSeconds: number;
  kernelDaemon: {
    online: boolean;
    port: number;
    host: string;
  };
}

export const messagingGatewayClient = {
  async getStatus(): Promise<FullGatewayStatus> {
    const res = await fetch('/api/gateway/status');
    if (!res.ok) throw new Error(`Failed to load gateway status: HTTP ${res.status}`);
    return res.json();
  },

  async startWhatsApp(): Promise<{ status: GatewayConnectionState; qrCode?: string }> {
    const res = await fetch('/api/gateway/whatsapp/start', { method: 'POST' });
    if (!res.ok) throw new Error(`Failed to start WhatsApp: HTTP ${res.status}`);
    return res.json();
  },

  async stopWhatsApp(): Promise<boolean> {
    const res = await fetch('/api/gateway/whatsapp/stop', { method: 'POST' });
    return res.ok;
  },

  async cleanWhatsAppSession(): Promise<boolean> {
    const res = await fetch('/api/gateway/whatsapp/clean', { method: 'POST' });
    return res.ok;
  },

  async getWhatsAppQr(): Promise<{ qrDataUrl: string | null; state: GatewayConnectionState; account: string | null }> {
    const res = await fetch('/api/gateway/whatsapp/qr');
    if (!res.ok) throw new Error(`Failed to query QR: HTTP ${res.status}`);
    return res.json();
  },

  async sendWhatsAppMessage(to: string, text: string): Promise<boolean> {
    const res = await fetch('/api/gateway/whatsapp/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to, text }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Send failed' }));
      throw new Error(err.error || `HTTP ${res.status}`);
    }
    return true;
  },

  async configureTelegram(botToken: string, autoStart = true): Promise<{
    success: boolean;
    status: GatewayConnectionState;
    bot?: any;
    error?: string;
  }> {
    const res = await fetch('/api/gateway/telegram/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ botToken, autoStart }),
    });
    const data = await res.json();
    return data;
  },

  async startTelegram(): Promise<{ status: GatewayConnectionState; botUsername?: string }> {
    const res = await fetch('/api/gateway/telegram/start', { method: 'POST' });
    return res.json();
  },

  async stopTelegram(): Promise<boolean> {
    const res = await fetch('/api/gateway/telegram/stop', { method: 'POST' });
    return res.ok;
  },

  async sendTelegramMessage(chatId: string, text: string): Promise<boolean> {
    const res = await fetch('/api/gateway/telegram/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chatId, text }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Send failed' }));
      throw new Error(err.error || `HTTP ${res.status}`);
    }
    return true;
  },

  async updatePolicy(policy: 'allowlist_only' | 'trusted_open' | 'admin_only', defaultAgent?: string): Promise<boolean> {
    const res = await fetch('/api/gateway/policy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ policy, defaultAgent }),
    });
    return res.ok;
  },

  async addAllowlistEntry(entry: {
    platform: GatewayPlatform;
    identifier: string;
    name: string;
    role: 'Guest' | 'Trusted User' | 'Administrator';
    status: 'ALLOWED' | 'DENIED' | 'PENDING_APPROVAL' | 'BLOCKED';
  }): Promise<AllowlistEntry> {
    const res = await fetch('/api/gateway/allowlist/add', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(entry),
    });
    const data = await res.json();
    return data.entry;
  },

  async updateAllowlistEntry(id: string, updates: Partial<AllowlistEntry>): Promise<AllowlistEntry> {
    const res = await fetch('/api/gateway/allowlist/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, updates }),
    });
    const data = await res.json();
    return data.entry;
  },

  async removeAllowlistEntry(id: string): Promise<boolean> {
    const res = await fetch('/api/gateway/allowlist/remove', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    return res.ok;
  },

  subscribeWhatsAppQrStream(
    onEvent: (data: {
      type: 'sync' | 'qr' | 'connected' | 'disconnected' | 'error';
      state: GatewayConnectionState;
      account?: string | null;
      qrDataUrl?: string | null;
      qrRaw?: string | null;
      ttlRemainingSeconds?: number;
      timestamp?: number;
      error?: string;
    }) => void
  ): () => void {
    if (typeof window === 'undefined' || !window.EventSource) {
      // Fallback to rapid polling if SSE not supported
      const pollTimer = setInterval(async () => {
        try {
          const qr = await messagingGatewayClient.getWhatsAppQr();
          onEvent({
            type: qr.state === 'CONNECTED' ? 'connected' : qr.qrDataUrl ? 'qr' : 'sync',
            state: qr.state,
            account: qr.account,
            qrDataUrl: qr.qrDataUrl,
          });
        } catch {}
      }, 3000);
      return () => clearInterval(pollTimer);
    }

    const eventSource = new EventSource('/api/gateway/whatsapp/qr-stream');

    eventSource.onmessage = (e) => {
      try {
        const payload = JSON.parse(e.data);
        onEvent(payload);
      } catch (err) {
        console.warn('[QR Stream] Failed to parse SSE data:', err);
      }
    };

    eventSource.onerror = () => {
      // On connection drop, EventSource automatically reconnects
    };

    return () => {
      eventSource.close();
    };
  },

  async getEventBusHistory(topic?: string, limit = 50): Promise<any[]> {
    const query = new URLSearchParams();
    if (topic) query.set('topic', topic);
    query.set('limit', limit.toString());
    const res = await fetch(`/api/gateway/eventbus/history?${query.toString()}`);
    if (!res.ok) return [];
    const data = await res.json();
    return data.history || [];
  },

  async getVaultStatus(): Promise<{
    status: string;
    storageEngine: string;
    keysCount: number;
    vaultPath: string;
    hardwareEntropyAvailable: boolean;
  }> {
    const res = await fetch('/api/gateway/vault/status');
    if (!res.ok) throw new Error('Failed to query Credential Vault');
    return res.json();
  },

  async storeVaultSecret(key: string, secret: string): Promise<boolean> {
    const res = await fetch('/api/gateway/vault/store', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key, secret }),
    });
    return res.ok;
  },

  async testDispatch(params: {
    platform: GatewayPlatform;
    text: string;
    senderId?: string;
    senderName?: string;
    conversationId?: string;
  }): Promise<{ success: boolean; request: MessageEnvelope; response: MessageEnvelope; replyText: string }> {
    const res = await fetch('/api/gateway/test-dispatch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    return res.json();
  },

  async getTelemetry(): Promise<SystemTelemetry> {
    const res = await fetch('/api/system/telemetry');
    if (!res.ok) throw new Error('Failed to load system telemetry');
    return res.json();
  },
};
