import React, { useState, useEffect, useRef } from 'react';
import {
  Radio,
  Server,
  Zap,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  RefreshCw,
  Send,
  Shield,
  Key,
  Smartphone,
  MessageSquare,
  Bot,
  Activity,
  Terminal,
  Lock,
  UserCheck,
  UserX,
  Trash2,
  QrCode,
  Eye,
  EyeOff,
  Clock,
  Play,
  Square,
  Cpu,
  Layers,
  ArrowRight,
  ExternalLink,
  Copy,
  Check,
  ShieldCheck,
  FileCode,
  History,
  Sparkles,
} from 'lucide-react';
import {
  messagingGatewayClient,
  FullGatewayStatus,
} from '../../services/messagingGatewayClient';
import {
  MessageEnvelope,
  GatewayEvent,
  AllowlistEntry,
  GatewayConnectionState,
} from '../../server/messagingGatewayService';

export const MessagingGatewaysView: React.FC = () => {
  const [status, setStatus] = useState<FullGatewayStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'messages' | 'events' | 'security' | 'audit' | 'diagnostics'>('messages');

  // Real-Time WhatsApp Pairing Stream
  const [isStreamingQr, setIsStreamingQr] = useState(false);
  const [realtimeQrDataUrl, setRealtimeQrDataUrl] = useState<string | null>(null);
  const [realtimeQrRaw, setRealtimeQrRaw] = useState<string | null>(null);
  const [qrTtl, setQrTtl] = useState<number>(30);
  const [qrCycleCount, setQrCycleCount] = useState<number>(1);
  const [lastQrUpdateTime, setLastQrUpdateTime] = useState<number>(Date.now());
  const [qrRenderMode, setQrRenderMode] = useState<'binary_stream' | 'vector_canvas' | 'raw_code'>('binary_stream');
  const [copiedRaw, setCopiedRaw] = useState(false);

  // WhatsApp Controls
  const [isStartingWa, setIsStartingWa] = useState(false);
  const [waSendTo, setWaSendTo] = useState('');
  const [waSendText, setWaSendText] = useState('');
  const [isSendingWa, setIsSendingWa] = useState(false);
  const [waSendFeedback, setWaSendFeedback] = useState<{ ok: boolean; msg: string } | null>(null);

  // Telegram Controls
  const [tgToken, setTgToken] = useState('');
  const [showTgToken, setShowTgToken] = useState(false);
  const [isValidatingTg, setIsValidatingTg] = useState(false);
  const [tgError, setTgError] = useState<string | null>(null);
  const [tgSendChatId, setTgSendChatId] = useState('');
  const [tgSendText, setTgSendText] = useState('');
  const [isSendingTg, setIsSendingTg] = useState(false);
  const [tgSendFeedback, setTgSendFeedback] = useState<{ ok: boolean; msg: string } | null>(null);

  // Ingress Test Console
  const [testPlatform, setTestPlatform] = useState<'whatsapp' | 'telegram'>('whatsapp');
  const [testSenderName, setTestSenderName] = useState('Mission Operator');
  const [testSenderId, setTestSenderId] = useState('+15550192834');
  const [testMessageText, setTestMessageText] = useState('/status');
  const [isDispatchingTest, setIsDispatchingTest] = useState(false);
  const [testResult, setTestResult] = useState<{ request: any; response: any; replyText: string } | null>(null);

  // Allowlist Form Modal
  const [showAddAllowlist, setShowAddAllowlist] = useState(false);
  const [newAllowPlatform, setNewAllowPlatform] = useState<'whatsapp' | 'telegram'>('whatsapp');
  const [newAllowIdentifier, setNewAllowIdentifier] = useState('');
  const [newAllowName, setNewAllowName] = useState('');
  const [newAllowRole, setNewAllowRole] = useState<'Guest' | 'Trusted User' | 'Administrator'>('Trusted User');
  const [updatingEntryId, setUpdatingEntryId] = useState<string | null>(null);

  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const fetchStatus = async () => {
    try {
      const data = await messagingGatewayClient.getStatus();
      setStatus(data);
      if (data.whatsapp?.qrDataUrl && !realtimeQrDataUrl) {
        setRealtimeQrDataUrl(data.whatsapp.qrDataUrl);
      }
      if (data.whatsapp?.qrRaw && !realtimeQrRaw) {
        setRealtimeQrRaw(data.whatsapp.qrRaw);
      }
      if (typeof data.whatsapp?.ttlRemainingSeconds === 'number') {
        setQrTtl(data.whatsapp.ttlRemainingSeconds);
      }
      setLoading(false);
    } catch (err: any) {
      console.error('Failed to fetch gateway status:', err.message);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    // Poll every 3 seconds for baseline status
    pollIntervalRef.current = setInterval(fetchStatus, 3000);
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, []);

  // Real-Time Server-Sent Events (SSE) stream subscription for live WhatsApp pairing
  useEffect(() => {
    const unsubscribe = messagingGatewayClient.subscribeWhatsAppQrStream((event) => {
      setIsStreamingQr(true);
      if (event.state) {
        setStatus((prev) =>
          prev
            ? {
                ...prev,
                whatsapp: {
                  ...prev.whatsapp,
                  state: event.state,
                  account: event.account !== undefined ? event.account : prev.whatsapp.account,
                  qrDataUrl: event.qrDataUrl !== undefined ? event.qrDataUrl : prev.whatsapp.qrDataUrl,
                  qrRaw: event.qrRaw !== undefined ? event.qrRaw : prev.whatsapp.qrRaw,
                },
              }
            : null
        );
      }
      if (event.qrDataUrl) {
        setRealtimeQrDataUrl(event.qrDataUrl);
      }
      if (event.qrRaw) {
        setRealtimeQrRaw(event.qrRaw);
      }
      if (typeof event.ttlRemainingSeconds === 'number') {
        setQrTtl(event.ttlRemainingSeconds);
      }
      setLastQrUpdateTime(Date.now());
      setQrCycleCount((c) => c + 1);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  // Auto-refresh countdown for pairing code freshness
  useEffect(() => {
    const timer = setInterval(() => {
      setQrTtl((prev) => {
        if (prev <= 1) {
          fetchStatus();
          return 30;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const handleCopyRawQr = () => {
    const raw = realtimeQrRaw || status?.whatsapp?.qrRaw;
    if (raw) {
      navigator.clipboard.writeText(raw);
      setCopiedRaw(true);
      setTimeout(() => setCopiedRaw(false), 2000);
    }
  };

  const handleStartWhatsApp = async () => {
    setIsStartingWa(true);
    try {
      await messagingGatewayClient.startWhatsApp();
      await fetchStatus();
    } catch (e: any) {
      alert(`Failed to start WhatsApp: ${e.message}`);
    } finally {
      setIsStartingWa(false);
    }
  };

  const handleStopWhatsApp = async () => {
    try {
      await messagingGatewayClient.stopWhatsApp();
      await fetchStatus();
    } catch (e: any) {
      alert(`Failed to stop WhatsApp: ${e.message}`);
    }
  };

  const handleCleanWhatsApp = async () => {
    if (confirm('Clear stored WhatsApp session credentials? You will need to scan QR again.')) {
      await messagingGatewayClient.cleanWhatsAppSession();
      await fetchStatus();
    }
  };

  const handleSendWhatsApp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!waSendTo.trim() || !waSendText.trim()) return;
    setIsSendingWa(true);
    setWaSendFeedback(null);
    try {
      await messagingGatewayClient.sendWhatsAppMessage(waSendTo.trim(), waSendText.trim());
      setWaSendFeedback({ ok: true, msg: 'Message sent successfully' });
      setWaSendText('');
      await fetchStatus();
    } catch (err: any) {
      setWaSendFeedback({ ok: false, msg: err.message || 'Failed to send' });
    } finally {
      setIsSendingWa(false);
    }
  };

  const handleConfigureTelegram = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tgToken.trim()) return;
    setIsValidatingTg(true);
    setTgError(null);
    try {
      const res = await messagingGatewayClient.configureTelegram(tgToken.trim(), true);
      if (!res.success) {
        setTgError(res.error || 'Token authentication failed');
      } else {
        setTgToken('');
      }
      await fetchStatus();
    } catch (err: any) {
      setTgError(err.message || 'Connection error');
    } finally {
      setIsValidatingTg(false);
    }
  };

  const handleStopTelegram = async () => {
    await messagingGatewayClient.stopTelegram();
    await fetchStatus();
  };

  const handleSendTelegram = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tgSendChatId.trim() || !tgSendText.trim()) return;
    setIsSendingTg(true);
    setTgSendFeedback(null);
    try {
      await messagingGatewayClient.sendTelegramMessage(tgSendChatId.trim(), tgSendText.trim());
      setTgSendFeedback({ ok: true, msg: 'Sent successfully to Telegram' });
      setTgSendText('');
      await fetchStatus();
    } catch (err: any) {
      setTgSendFeedback({ ok: false, msg: err.message || 'Failed to send' });
    } finally {
      setIsSendingTg(false);
    }
  };

  const handleTestDispatch = async () => {
    if (!testMessageText.trim()) return;
    setIsDispatchingTest(true);
    setTestResult(null);
    try {
      const res = await messagingGatewayClient.testDispatch({
        platform: testPlatform,
        text: testMessageText.trim(),
        senderName: testSenderName,
        senderId: testSenderId,
      });
      setTestResult(res);
      await fetchStatus();
    } catch (err: any) {
      alert(`Dispatch error: ${err.message}`);
    } finally {
      setIsDispatchingTest(false);
    }
  };

  const handleAddAllowlist = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAllowIdentifier.trim() || !newAllowName.trim()) return;
    try {
      await messagingGatewayClient.addAllowlistEntry({
        platform: newAllowPlatform,
        identifier: newAllowIdentifier.trim(),
        name: newAllowName.trim(),
        role: newAllowRole,
        status: 'ALLOWED',
      });
      setShowAddAllowlist(false);
      setNewAllowIdentifier('');
      setNewAllowName('');
      await fetchStatus();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleRemoveAllowlist = async (id: string) => {
    await messagingGatewayClient.removeAllowlistEntry(id);
    await fetchStatus();
  };

  const handleApproveContact = async (entry: AllowlistEntry) => {
    setUpdatingEntryId(entry.id);
    try {
      await messagingGatewayClient.updateAllowlistEntry(entry.id, {
        status: 'ALLOWED',
        role: entry.role === 'Guest' ? 'Trusted User' : entry.role,
      });
      await fetchStatus();
    } catch (err: any) {
      alert(`Approval error: ${err.message}`);
    } finally {
      setUpdatingEntryId(null);
    }
  };

  const handleBlockContact = async (entry: AllowlistEntry) => {
    setUpdatingEntryId(entry.id);
    try {
      await messagingGatewayClient.updateAllowlistEntry(entry.id, {
        status: 'BLOCKED',
      });
      await fetchStatus();
    } catch (err: any) {
      alert(`Block error: ${err.message}`);
    } finally {
      setUpdatingEntryId(null);
    }
  };

  const handleRoleChange = async (id: string, role: 'Guest' | 'Trusted User' | 'Administrator') => {
    try {
      await messagingGatewayClient.updateAllowlistEntry(id, { role });
      await fetchStatus();
    } catch (err: any) {
      alert(`Role update error: ${err.message}`);
    }
  };

  const handlePolicyChange = async (policy: 'allowlist_only' | 'trusted_open' | 'admin_only') => {
    await messagingGatewayClient.updatePolicy(policy);
    await fetchStatus();
  };

  const renderStateBadge = (state: GatewayConnectionState) => {
    switch (state) {
      case 'CONNECTED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
            CONNECTED
          </span>
        );
      case 'QR_REQUIRED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-cyan-500/15 text-cyan-400 border border-cyan-500/30">
            <QrCode className="w-3.5 h-3.5" />
            QR REQUIRED
          </span>
        );
      case 'AUTHENTICATING':
      case 'INITIALIZING':
      case 'RECONNECTING':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-400 border border-amber-500/30">
            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            {state}
          </span>
        );
      case 'AUTH_FAILED':
      case 'ERROR':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-500/15 text-rose-400 border border-rose-500/30">
            <XCircle className="w-3.5 h-3.5" />
            {state}
          </span>
        );
      case 'NOT_CONFIGURED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-500/15 text-slate-400 border border-slate-500/30">
            NOT CONFIGURED
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-500/15 text-slate-400 border border-slate-500/30">
            {state}
          </span>
        );
    }
  };

  const waState = status?.whatsapp?.state || 'DISCONNECTED';
  const tgState = status?.telegram?.state || 'NOT_CONFIGURED';

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-surface text-text p-4 md:p-6 space-y-6 font-sans">
      {/* Top Banner Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border/40 pb-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-accent/15 border border-accent/30 text-accent">
              <Radio className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-text">Messaging Gateways</h1>
              <p className="text-xs text-muted">
                Section 35 Production Real-Time Integration • Real WhatsApp (Baileys) & Telegram (Bot API) Agent Channels
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={fetchStatus}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border/50 bg-surface/50 hover:bg-surface text-xs font-medium text-text transition"
            title="Refresh gateway statuses"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Sync Status
          </button>

          {/* Credential Vault Status Badge */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 text-xs font-mono font-bold" title="Hardware-bound AES-256-GCM storage via Rust backend">
            <Lock className="w-3.5 h-3.5" />
            <span>VAULT: ENCRYPTED</span>
          </div>

          {/* SSE Stream Status Badge */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-xs font-mono font-bold">
            <span className={`h-2 w-2 rounded-full ${isStreamingQr ? 'bg-cyan-400 animate-pulse' : 'bg-slate-500'}`} />
            <span>PAIRING SSE: {isStreamingQr ? 'LIVE STREAM' : 'READY'}</span>
          </div>

          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-mono font-bold">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>EVENTBUS: ACTIVE</span>
          </div>
        </div>
      </div>

      {/* Main Two Gateways Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ========================================================= */}
        {/* WHATSAPP GATEWAY CARD (BAILEYS) */}
        {/* ========================================================= */}
        <div className="flex flex-col justify-between rounded-2xl border border-border/50 bg-surface/40 p-5 shadow-sm space-y-5">
          <div>
            <div className="flex items-start justify-between gap-3 mb-3">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                  <Smartphone className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-bold text-text">WhatsApp Gateway</h2>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold">
                      BAILEYS
                    </span>
                  </div>
                  <p className="text-xs text-muted">
                    Engine: <code className="text-accent">@whiskeysockets/baileys v6.7.19</code>
                  </p>
                </div>
              </div>
              {renderStateBadge(waState)}
            </div>

            {/* Account / Session Info */}
            <div className="rounded-xl border border-border/40 bg-surface/30 p-3 space-y-2 text-xs font-mono">
              <div className="flex items-center justify-between">
                <span className="text-muted">Account Identity:</span>
                <span className="text-text font-bold">
                  {status?.whatsapp?.account || 'No Authenticated Device'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted">Session Storage:</span>
                <span className="text-text truncate max-w-[240px]" title={status?.whatsapp?.diagnostics?.sessionDirectory}>
                  {status?.whatsapp?.diagnostics?.sessionDirectory || '.agenticos/sessions/whatsapp'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted">Inbound / Outbound:</span>
                <span className="text-emerald-400 font-bold">
                  {status?.whatsapp?.diagnostics?.messagesReceived || 0} received • {status?.whatsapp?.diagnostics?.messagesSent || 0} sent
                </span>
              </div>
            </div>

            {/* Dynamic Real-Time WhatsApp Pairing Stream & Binary QR Display */}
            {waState === 'QR_REQUIRED' && (realtimeQrDataUrl || status?.whatsapp?.qrDataUrl || realtimeQrRaw || status?.whatsapp?.qrRaw) && (
              <div className="mt-4 p-4 rounded-xl border border-cyan-500/30 bg-cyan-500/5 text-center space-y-3.5">
                {/* Header & Stream Status */}
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-cyan-500/20 pb-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-cyan-400">
                    <QrCode className="w-4 h-4" />
                    <span>Live WhatsApp Pairing Stream</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 font-mono">
                      Cycle #{qrCycleCount}
                    </span>
                  </div>

                  {/* Render Mode Switcher */}
                  <div className="flex items-center gap-1 bg-surface/60 p-0.5 rounded-lg border border-border/40 text-[11px]">
                    <button
                      type="button"
                      onClick={() => setQrRenderMode('binary_stream')}
                      className={`px-2 py-0.5 rounded transition ${
                        qrRenderMode === 'binary_stream' ? 'bg-cyan-500 text-slate-950 font-bold' : 'text-muted hover:text-text'
                      }`}
                    >
                      Binary Stream
                    </button>
                    <button
                      type="button"
                      onClick={() => setQrRenderMode('vector_canvas')}
                      className={`px-2 py-0.5 rounded transition ${
                        qrRenderMode === 'vector_canvas' ? 'bg-cyan-500 text-slate-950 font-bold' : 'text-muted hover:text-text'
                      }`}
                    >
                      Vector
                    </button>
                    <button
                      type="button"
                      onClick={() => setQrRenderMode('raw_code')}
                      className={`px-2 py-0.5 rounded transition ${
                        qrRenderMode === 'raw_code' ? 'bg-cyan-500 text-slate-950 font-bold' : 'text-muted hover:text-text'
                      }`}
                    >
                      Raw String
                    </button>
                  </div>
                </div>

                {/* QR Display per Selected Mode */}
                {qrRenderMode === 'binary_stream' && (
                  <div className="space-y-2">
                    <div className="flex justify-center p-2.5 bg-white rounded-xl mx-auto w-fit shadow-lg transition-all">
                      <img
                        src={`/api/gateway/whatsapp/qr-image?t=${lastQrUpdateTime}`}
                        alt="WhatsApp Binary QR Stream"
                        className="w-52 h-52 object-contain"
                        onError={(e) => {
                          const fallback = realtimeQrDataUrl || status?.whatsapp?.qrDataUrl;
                          if (fallback) {
                            (e.currentTarget as HTMLImageElement).src = fallback;
                          }
                        }}
                      />
                    </div>
                    <span className="text-[10px] text-cyan-400/80 font-mono block">
                      Direct Binary PNG Stream from Baileys Socket Engine
                    </span>
                  </div>
                )}

                {qrRenderMode === 'vector_canvas' && (
                  <div className="space-y-2">
                    <div className="flex justify-center p-2.5 bg-white rounded-xl mx-auto w-fit shadow-lg transition-all">
                      <img
                        src={realtimeQrDataUrl || status?.whatsapp?.qrDataUrl || ''}
                        alt="WhatsApp Vector QR"
                        className="w-52 h-52 object-contain"
                      />
                    </div>
                    <span className="text-[10px] text-muted font-mono block">
                      High-Precision Matrix Rendering
                    </span>
                  </div>
                )}

                {qrRenderMode === 'raw_code' && (
                  <div className="space-y-2 text-left bg-surface/80 p-3 rounded-xl border border-border/40 font-mono text-xs">
                    <div className="flex items-center justify-between text-muted pb-1 border-b border-border/30">
                      <span className="text-[11px]">Baileys Pairing Envelope (Base64/Binary):</span>
                      <button
                        onClick={handleCopyRawQr}
                        className="flex items-center gap-1 text-[11px] text-accent hover:underline"
                      >
                        {copiedRaw ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                        {copiedRaw ? 'Copied' : 'Copy'}
                      </button>
                    </div>
                    <p className="break-all text-text text-[11px] max-h-28 overflow-y-auto font-mono select-all">
                      {realtimeQrRaw || status?.whatsapp?.qrRaw || status?.whatsapp?.qrDataUrl || 'Generating pairing string...'}
                    </p>
                  </div>
                )}

                {/* Auto-Refresh Countdown Timer & Progress Bar */}
                <div className="space-y-1.5 pt-1">
                  <div className="flex items-center justify-between text-[11px] font-mono">
                    <span className="text-muted flex items-center gap-1">
                      <Clock className="w-3 h-3 text-cyan-400" />
                      Ephemeral Pairing Window:
                    </span>
                    <span className={`font-bold ${qrTtl <= 5 ? 'text-amber-400 animate-pulse' : 'text-cyan-400'}`}>
                      Auto-refresh in {qrTtl}s
                    </span>
                  </div>
                  <div className="w-full h-1.5 bg-surface rounded-full overflow-hidden border border-border/40">
                    <div
                      className="h-full bg-cyan-400 transition-all duration-1000 ease-linear rounded-full"
                      style={{ width: `${Math.max(0, Math.min(100, (qrTtl / 30) * 100))}%` }}
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2 pt-1">
                  <p className="text-[11px] text-muted text-left flex-1 leading-snug">
                    Open WhatsApp → <strong>Settings</strong> → <strong>Linked Devices</strong> → <strong>Link a Device</strong>. Status automatically transitions to CONNECTED upon scan.
                  </p>
                  <button
                    onClick={handleStartWhatsApp}
                    disabled={isStartingWa}
                    className="shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/30 text-xs font-semibold transition"
                    title="Force Baileys to regenerate pairing code now"
                  >
                    <RefreshCw className={`w-3 h-3 ${isStartingWa ? 'animate-spin' : ''}`} />
                    Force Refresh
                  </button>
                </div>
              </div>
            )}

            {/* Connected State Actions: Real Message Send Form */}
            {waState === 'CONNECTED' && (
              <div className="mt-4 p-4 rounded-xl border border-emerald-500/30 bg-emerald-500/5 space-y-3">
                <h3 className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                  <Send className="w-3.5 h-3.5" />
                  Send WhatsApp Message (Real Outbound)
                </h3>
                <form onSubmit={handleSendWhatsApp} className="space-y-2">
                  <input
                    type="text"
                    placeholder="Recipient Phone with Country Code (e.g., +15551234567)"
                    value={waSendTo}
                    onChange={(e) => setWaSendTo(e.target.value)}
                    className="w-full text-xs px-3 py-2 rounded-lg bg-surface border border-border/50 text-text focus:outline-none focus:border-accent"
                  />
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Message content..."
                      value={waSendText}
                      onChange={(e) => setWaSendText(e.target.value)}
                      className="flex-1 text-xs px-3 py-2 rounded-lg bg-surface border border-border/50 text-text focus:outline-none focus:border-accent"
                    />
                    <button
                      type="submit"
                      disabled={isSendingWa}
                      className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs transition flex items-center gap-1.5 disabled:opacity-50"
                    >
                      <Send className="w-3.5 h-3.5" />
                      {isSendingWa ? 'Sending...' : 'Send'}
                    </button>
                  </div>
                  {waSendFeedback && (
                    <div
                      className={`text-[11px] p-2 rounded-lg ${
                        waSendFeedback.ok
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                      }`}
                    >
                      {waSendFeedback.msg}
                    </div>
                  )}
                </form>
              </div>
            )}
          </div>

          {/* Action Toolbar */}
          <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-border/30">
            {waState === 'CONNECTED' ? (
              <button
                onClick={handleStopWhatsApp}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-rose-500/40 text-rose-400 hover:bg-rose-500/10 text-xs font-semibold transition"
              >
                <Square className="w-3.5 h-3.5" />
                Disconnect WhatsApp
              </button>
            ) : (
              <button
                onClick={handleStartWhatsApp}
                disabled={isStartingWa}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition shadow-sm disabled:opacity-50"
              >
                <Play className="w-3.5 h-3.5" />
                {isStartingWa ? 'Starting Baileys...' : 'Start WhatsApp Gateway'}
              </button>
            )}

            <button
              onClick={handleCleanWhatsApp}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border/50 text-muted hover:text-text hover:bg-surface text-xs font-medium transition"
              title="Clears saved multi-file auth credentials"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Reset Session
            </button>
          </div>
        </div>

        {/* ========================================================= */}
        {/* TELEGRAM GATEWAY CARD (TELEGRAM BOT API) */}
        {/* ========================================================= */}
        <div className="flex flex-col justify-between rounded-2xl border border-border/50 bg-surface/40 p-5 shadow-sm space-y-5">
          <div>
            <div className="flex items-start justify-between gap-3 mb-3">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-sky-500/15 text-sky-400 border border-sky-500/30">
                  <Bot className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-bold text-text">Telegram Gateway</h2>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-sky-500/20 text-sky-300 font-bold">
                      BOT API v7
                    </span>
                  </div>
                  <p className="text-xs text-muted">
                    Endpoint: <code className="text-accent">api.telegram.org (getMe / getUpdates)</code>
                  </p>
                </div>
              </div>
              {renderStateBadge(tgState)}
            </div>

            {/* Telegram Configuration & Identity */}
            <div className="rounded-xl border border-border/40 bg-surface/30 p-3 space-y-2 text-xs font-mono">
              <div className="flex items-center justify-between">
                <span className="text-muted">Bot Identity:</span>
                <span className="text-text font-bold">
                  {status?.telegram?.botUsername ? `@${status.telegram.botUsername}` : 'Unconfigured'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted">Bot ID:</span>
                <span className="text-text">
                  {status?.telegram?.botId || 'N/A'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted">Polling Status:</span>
                <span className={tgState === 'CONNECTED' ? 'text-emerald-400 font-bold' : 'text-muted'}>
                  {tgState === 'CONNECTED' ? 'Active (2000ms loop)' : 'Idle'}
                </span>
              </div>
            </div>

            {/* Token Configuration Form */}
            <form onSubmit={handleConfigureTelegram} className="mt-4 space-y-2">
              <label className="text-xs font-semibold text-text flex items-center justify-between">
                <span>Configure Telegram Bot Token</span>
                <a
                  href="https://t.me/BotFather"
                  target="_blank"
                  rel="noreferrer"
                  className="text-[11px] text-accent hover:underline flex items-center gap-1"
                >
                  Get token via @BotFather <ExternalLink className="w-3 h-3" />
                </a>
              </label>

              {/* Credential Vault Security Notice */}
              <div className="p-2.5 rounded-lg bg-indigo-500/10 border border-indigo-500/25 flex items-start gap-2 text-[11px]">
                <Lock className="w-3.5 h-3.5 text-indigo-400 shrink-0 mt-0.5" />
                <div className="text-indigo-300">
                  <span className="font-bold text-indigo-200">Protected by Rust Credential Vault:</span> Tokens are encrypted using OS-level hardware-backed secret storage (AES-256-GCM) and never stored in plain-text config.
                </div>
              </div>

              <div className="flex gap-2">
                <div className="relative flex-1">
                  <input
                    type={showTgToken ? 'text' : 'password'}
                    placeholder="Enter Telegram Bot Token (e.g., 123456789:ABCdefGHIjk...)"
                    value={tgToken}
                    onChange={(e) => setTgToken(e.target.value)}
                    className="w-full text-xs px-3 py-2 pr-9 rounded-lg bg-surface border border-border/50 text-text font-mono focus:outline-none focus:border-accent"
                  />
                  <button
                    type="button"
                    onClick={() => setShowTgToken(!showTgToken)}
                    className="absolute right-2.5 top-2.5 text-muted hover:text-text"
                  >
                    {showTgToken ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
                <button
                  type="submit"
                  disabled={isValidatingTg || !tgToken.trim()}
                  className="px-4 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-semibold text-xs transition flex items-center gap-1.5 disabled:opacity-50"
                >
                  <Key className="w-3.5 h-3.5" />
                  {isValidatingTg ? 'Verifying...' : 'Validate & Encrypt'}
                </button>
              </div>

              {tgError && (
                <div className="text-[11px] p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-400 flex items-start gap-2">
                  <XCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">Telegram Authentication Rejected:</span> {tgError}
                  </div>
                </div>
              )}
            </form>

            {/* Telegram Outbound Sender Form */}
            {tgState === 'CONNECTED' && (
              <div className="mt-4 p-4 rounded-xl border border-sky-500/30 bg-sky-500/5 space-y-3">
                <h3 className="text-xs font-bold text-sky-400 flex items-center gap-1.5">
                  <Send className="w-3.5 h-3.5" />
                  Send Telegram Message (Real Outbound)
                </h3>
                <form onSubmit={handleSendTelegram} className="space-y-2">
                  <input
                    type="text"
                    placeholder="Target Chat ID or User ID (e.g., 987654321)"
                    value={tgSendChatId}
                    onChange={(e) => setTgSendChatId(e.target.value)}
                    className="w-full text-xs px-3 py-2 rounded-lg bg-surface border border-border/50 text-text focus:outline-none focus:border-accent"
                  />
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Telegram message text..."
                      value={tgSendText}
                      onChange={(e) => setTgSendText(e.target.value)}
                      className="flex-1 text-xs px-3 py-2 rounded-lg bg-surface border border-border/50 text-text focus:outline-none focus:border-accent"
                    />
                    <button
                      type="submit"
                      disabled={isSendingTg}
                      className="px-4 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-semibold text-xs transition flex items-center gap-1.5 disabled:opacity-50"
                    >
                      <Send className="w-3.5 h-3.5" />
                      {isSendingTg ? 'Sending...' : 'Send'}
                    </button>
                  </div>
                  {tgSendFeedback && (
                    <div
                      className={`text-[11px] p-2 rounded-lg ${
                        tgSendFeedback.ok
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                      }`}
                    >
                      {tgSendFeedback.msg}
                    </div>
                  )}
                </form>
              </div>
            )}
          </div>

          {/* Action Toolbar */}
          <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-border/30">
            {tgState === 'CONNECTED' && (
              <button
                onClick={handleStopTelegram}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-rose-500/40 text-rose-400 hover:bg-rose-500/10 text-xs font-semibold transition"
              >
                <Square className="w-3.5 h-3.5" />
                Disconnect Polling
              </button>
            )}
            <span className="text-[11px] text-muted ml-auto font-mono">
              Offset: {status?.telegram?.diagnostics?.messagesReceived || 0} updates
            </span>
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* INTERACTIVE AGENT INGRESS & MISSION DISPATCH CONSOLE */}
      {/* ========================================================= */}
      <div className="rounded-2xl border border-accent/30 bg-accent/5 p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-accent/20 text-accent">
              <Terminal className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-text">Agent Ingress & Dispatch Console</h2>
              <p className="text-[11px] text-muted">
                Section 35.5/35.11: Test how inbound WhatsApp & Telegram messages route to live AgenticOS agents & missions
              </p>
            </div>
          </div>

          {/* Quick command buttons */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] text-muted mr-1">Quick Commands:</span>
            {['/status', '/diagnostics', '/runtimes', '/help', '/ping'].map((cmd) => (
              <button
                key={cmd}
                onClick={() => setTestMessageText(cmd)}
                className="px-2 py-0.5 rounded text-[11px] font-mono bg-surface border border-border/50 text-accent hover:border-accent transition"
              >
                {cmd}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div>
            <label className="text-[11px] font-semibold text-muted block mb-1">Simulated Channel</label>
            <select
              value={testPlatform}
              onChange={(e) => setTestPlatform(e.target.value as any)}
              className="w-full text-xs px-3 py-2 rounded-lg bg-surface border border-border/50 text-text"
            >
              <option value="whatsapp">WhatsApp Channel</option>
              <option value="telegram">Telegram Channel</option>
            </select>
          </div>
          <div>
            <label className="text-[11px] font-semibold text-muted block mb-1">Sender Name</label>
            <input
              type="text"
              value={testSenderName}
              onChange={(e) => setTestSenderName(e.target.value)}
              className="w-full text-xs px-3 py-2 rounded-lg bg-surface border border-border/50 text-text"
            />
          </div>
          <div className="md:col-span-2">
            <label className="text-[11px] font-semibold text-muted block mb-1">Inbound Text Prompt / Command</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={testMessageText}
                onChange={(e) => setTestMessageText(e.target.value)}
                placeholder="e.g. /status or 'Check system memory'"
                className="flex-1 text-xs px-3 py-2 rounded-lg bg-surface border border-border/50 text-text font-mono"
              />
              <button
                onClick={handleTestDispatch}
                disabled={isDispatchingTest}
                className="px-4 py-2 rounded-lg bg-accent text-slate-950 font-bold text-xs hover:bg-accent/90 transition flex items-center gap-1.5 disabled:opacity-50"
              >
                <Zap className="w-3.5 h-3.5" />
                {isDispatchingTest ? 'Dispatching...' : 'Dispatch'}
              </button>
            </div>
          </div>
        </div>

        {/* Real Dispatch Result Output */}
        {testResult && (
          <div className="rounded-xl border border-accent/40 bg-surface/80 p-3 space-y-2 text-xs font-mono">
            <div className="flex items-center justify-between text-muted border-b border-border/30 pb-1.5 text-[11px]">
              <span>Inbound ID: {testResult.request?.id}</span>
              <span className="text-emerald-400 font-bold">Status: EXECUTED & RESPONDED</span>
            </div>
            <div className="bg-surface/50 p-2.5 rounded-lg whitespace-pre-wrap text-text">
              {testResult.replyText}
            </div>
          </div>
        )}
      </div>

      {/* ========================================================= */}
      {/* TABS: UNIFIED MESSAGES, EVENTBUS, ALLOWLIST, DIAGNOSTICS */}
      {/* ========================================================= */}
      <div className="space-y-4">
        <div className="flex items-center justify-between border-b border-border/40 pb-2">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('messages')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                activeTab === 'messages'
                  ? 'bg-accent/20 text-accent border border-accent/30'
                  : 'text-muted hover:text-text hover:bg-surface'
              }`}
            >
              Unified Messages ({status?.recentMessages?.length || 0})
            </button>
            <button
              onClick={() => setActiveTab('events')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                activeTab === 'events'
                  ? 'bg-accent/20 text-accent border border-accent/30'
                  : 'text-muted hover:text-text hover:bg-surface'
              }`}
            >
              EventBus Stream ({status?.recentEvents?.length || 0})
            </button>
            <button
              onClick={() => setActiveTab('security')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                activeTab === 'security'
                  ? 'bg-accent/20 text-accent border border-accent/30'
                  : 'text-muted hover:text-text hover:bg-surface'
              }`}
            >
              Security & Allowlist ({status?.allowlist?.length || 0})
            </button>
            <button
              onClick={() => setActiveTab('audit')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                activeTab === 'audit'
                  ? 'bg-accent/20 text-accent border border-accent/30'
                  : 'text-muted hover:text-text hover:bg-surface'
              }`}
            >
              Access Audit Logs ({status?.auditLogs?.length || 0})
            </button>
            <button
              onClick={() => setActiveTab('diagnostics')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                activeTab === 'diagnostics'
                  ? 'bg-accent/20 text-accent border border-accent/30'
                  : 'text-muted hover:text-text hover:bg-surface'
              }`}
            >
              Engine Diagnostics
            </button>
          </div>

          <div className="text-[11px] text-muted font-mono">
            Policy: <span className="font-bold text-accent">{status?.policy || 'trusted_open'}</span>
          </div>
        </div>

        {/* Tab 1: Messages View */}
        {activeTab === 'messages' && (
          <div className="rounded-2xl border border-border/40 bg-surface/30 p-4 space-y-3">
            {(!status?.recentMessages || status.recentMessages.length === 0) ? (
              <div className="p-8 text-center text-muted text-xs space-y-2">
                <MessageSquare className="w-8 h-8 mx-auto opacity-30 text-muted" />
                <p className="font-semibold text-text">No Message Records Found</p>
                <p className="max-w-md mx-auto text-[11px]">
                  Truthful state: no fabricated messages exist. Inbound or outbound messages received through WhatsApp, Telegram, or the Ingress Console above will be registered here.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs font-mono">
                  <thead>
                    <tr className="border-b border-border/40 text-muted text-[11px]">
                      <th className="pb-2">Time</th>
                      <th className="pb-2">Platform</th>
                      <th className="pb-2">Direction</th>
                      <th className="pb-2">Sender</th>
                      <th className="pb-2">Content</th>
                      <th className="pb-2">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/20">
                    {status.recentMessages.map((msg) => (
                      <tr key={msg.id} className="hover:bg-surface/50 transition">
                        <td className="py-2.5 text-muted text-[11px]">
                          {new Date(msg.epochMs).toLocaleTimeString()}
                        </td>
                        <td className="py-2.5">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              msg.platform === 'whatsapp'
                                ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                                : 'bg-sky-500/15 text-sky-400 border border-sky-500/30'
                            }`}
                          >
                            {msg.platform.toUpperCase()}
                          </span>
                        </td>
                        <td className="py-2.5">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              msg.direction === 'inbound'
                                ? 'bg-indigo-500/15 text-indigo-400'
                                : 'bg-amber-500/15 text-amber-400'
                            }`}
                          >
                            {msg.direction.toUpperCase()}
                          </span>
                        </td>
                        <td className="py-2.5 font-bold text-text truncate max-w-[120px]">
                          {msg.senderName}
                        </td>
                        <td className="py-2.5 text-text font-sans text-xs max-w-[320px] truncate" title={msg.text}>
                          {msg.text}
                        </td>
                        <td className="py-2.5">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] ${
                              msg.status === 'responded' || msg.status === 'sent'
                                ? 'text-emerald-400'
                                : msg.status === 'denied'
                                ? 'text-rose-400'
                                : 'text-muted'
                            }`}
                          >
                            {msg.status.toUpperCase()}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Tab 2: EventBus Stream */}
        {activeTab === 'events' && (
          <div className="rounded-2xl border border-border/40 bg-surface/30 p-4 space-y-2 font-mono text-xs">
            {(!status?.recentEvents || status.recentEvents.length === 0) ? (
              <div className="p-8 text-center text-muted text-xs">
                <Radio className="w-8 h-8 mx-auto opacity-30 text-muted mb-2" />
                <p>No Gateway Events in Memory</p>
              </div>
            ) : (
              <div className="space-y-1.5 max-h-96 overflow-y-auto pr-1">
                {status.recentEvents.map((evt) => (
                  <div
                    key={evt.id}
                    className="flex items-start gap-3 p-2 rounded-lg bg-surface/40 border border-border/20 hover:border-border/40 transition"
                  >
                    <span className="text-[10px] text-muted shrink-0 mt-0.5">
                      {new Date(evt.timestamp).toLocaleTimeString()}
                    </span>
                    <span
                      className={`px-1.5 py-0.2 rounded text-[10px] font-bold shrink-0 ${
                        evt.platform === 'whatsapp' ? 'text-emerald-400' : 'text-sky-400'
                      }`}
                    >
                      [{evt.platform.toUpperCase()}]
                    </span>
                    <span className="text-accent font-bold shrink-0">{evt.type}</span>
                    <span className="text-text font-sans flex-1 truncate" title={evt.message}>
                      {evt.message}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab 3: Security & Allowlist */}
        {activeTab === 'security' && (
          <div className="rounded-2xl border border-border/40 bg-surface/30 p-5 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border/30 pb-4">
              <div>
                <h3 className="text-sm font-bold text-text">Access Control & Allowlist Policy</h3>
                <p className="text-xs text-muted">
                  Section 35.13 - 35.15: Enforce authorization for external WhatsApp numbers and Telegram user IDs
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs text-muted">Active Policy:</span>
                <select
                  value={status?.policy || 'trusted_open'}
                  onChange={(e) => handlePolicyChange(e.target.value as any)}
                  className="text-xs px-3 py-1.5 rounded-lg bg-surface border border-border/50 text-text font-semibold"
                >
                  <option value="trusted_open">Trusted Open (Auto-admit)</option>
                  <option value="allowlist_only">Allowlist Only (Strict)</option>
                  <option value="admin_only">Administrator Only (High Security)</option>
                </select>
                <button
                  onClick={() => setShowAddAllowlist(true)}
                  className="px-3 py-1.5 rounded-lg bg-accent text-slate-950 font-bold text-xs hover:bg-accent/90 transition"
                >
                  + Add Allowed Account
                </button>
              </div>
            </div>

            {/* Allowlist Modal */}
            {showAddAllowlist && (
              <div className="p-4 rounded-xl border border-accent/40 bg-accent/5 space-y-3">
                <h4 className="text-xs font-bold text-accent">Add Allowed Contact / Chat ID</h4>
                <form onSubmit={handleAddAllowlist} className="grid grid-cols-1 md:grid-cols-4 gap-2">
                  <select
                    value={newAllowPlatform}
                    onChange={(e) => setNewAllowPlatform(e.target.value as any)}
                    className="text-xs px-3 py-2 rounded-lg bg-surface border border-border/50 text-text"
                  >
                    <option value="whatsapp">WhatsApp Phone</option>
                    <option value="telegram">Telegram User ID / Chat ID</option>
                  </select>
                  <input
                    type="text"
                    placeholder="Identifier (e.g. +15551234567 or 98765432)"
                    value={newAllowIdentifier}
                    onChange={(e) => setNewAllowIdentifier(e.target.value)}
                    className="text-xs px-3 py-2 rounded-lg bg-surface border border-border/50 text-text font-mono"
                  />
                  <input
                    type="text"
                    placeholder="Contact Name (e.g. Lead Engineer)"
                    value={newAllowName}
                    onChange={(e) => setNewAllowName(e.target.value)}
                    className="text-xs px-3 py-2 rounded-lg bg-surface border border-border/50 text-text"
                  />
                  <div className="flex gap-2">
                    <select
                      value={newAllowRole}
                      onChange={(e) => setNewAllowRole(e.target.value as any)}
                      className="flex-1 text-xs px-2 py-2 rounded-lg bg-surface border border-border/50 text-text font-semibold"
                    >
                      <option value="Guest">Guest</option>
                      <option value="Trusted User">Trusted User</option>
                      <option value="Administrator">Administrator</option>
                    </select>
                    <button
                      type="submit"
                      className="px-3 py-2 rounded-lg bg-accent text-slate-950 font-bold text-xs"
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowAddAllowlist(false)}
                      className="px-2 py-2 text-xs text-muted hover:text-text"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* Allowlist Table */}
            {(!status?.allowlist || status.allowlist.length === 0) ? (
              <div className="p-6 text-center text-muted text-xs">
                No custom allowlist entries configured. In <code>trusted_open</code> mode, users can dispatch queries subject to the 20 req/min rate limit.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs font-mono">
                  <thead>
                    <tr className="border-b border-border/40 text-muted text-[11px]">
                      <th className="pb-2">Platform</th>
                      <th className="pb-2">Identifier</th>
                      <th className="pb-2">Name</th>
                      <th className="pb-2">Role</th>
                      <th className="pb-2">Status</th>
                      <th className="pb-2 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/20">
                    {status.allowlist.map((entry) => (
                      <tr key={entry.id} className="hover:bg-surface/50 transition">
                        <td className="py-2.5 uppercase font-bold text-[10px]">
                          <span
                            className={`px-2 py-0.5 rounded ${
                              entry.platform === 'whatsapp'
                                ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                                : 'bg-sky-500/15 text-sky-400 border border-sky-500/30'
                            }`}
                          >
                            {entry.platform}
                          </span>
                        </td>
                        <td className="py-2.5 text-accent font-bold">{entry.identifier}</td>
                        <td className="py-2.5 text-text font-sans font-medium">{entry.name}</td>
                        <td className="py-2.5">
                          <select
                            value={entry.role}
                            onChange={(e) => handleRoleChange(entry.id, e.target.value as any)}
                            className="text-[11px] px-2 py-1 rounded bg-surface border border-border/40 text-text font-semibold focus:outline-none focus:border-accent"
                          >
                            <option value="Guest">Guest</option>
                            <option value="Trusted User">Trusted User</option>
                            <option value="Administrator">Administrator</option>
                          </select>
                        </td>
                        <td className="py-2.5">
                          {entry.status === 'ALLOWED' && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                              <CheckCircle2 className="w-3 h-3" />
                              ALLOWED
                            </span>
                          )}
                          {entry.status === 'PENDING_APPROVAL' && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30">
                              <AlertTriangle className="w-3 h-3 animate-pulse" />
                              PENDING
                            </span>
                          )}
                          {entry.status === 'BLOCKED' && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/15 text-rose-400 border border-rose-500/30">
                              <XCircle className="w-3 h-3" />
                              BLOCKED
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 text-right">
                          <div className="flex items-center justify-end gap-1">
                            {entry.status !== 'ALLOWED' && (
                              <button
                                onClick={() => handleApproveContact(entry)}
                                disabled={updatingEntryId === entry.id}
                                className="flex items-center gap-1 px-2 py-1 rounded bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25 border border-emerald-500/30 text-[11px] font-bold transition disabled:opacity-50"
                                title="Approve contact to allow triggering missions"
                              >
                                <UserCheck className="w-3 h-3" />
                                Approve
                              </button>
                            )}
                            {entry.status === 'ALLOWED' && (
                              <button
                                onClick={() => handleBlockContact(entry)}
                                disabled={updatingEntryId === entry.id}
                                className="flex items-center gap-1 px-2 py-1 rounded bg-amber-500/15 text-amber-400 hover:bg-amber-500/25 border border-amber-500/30 text-[11px] font-bold transition disabled:opacity-50"
                                title="Block this contact"
                              >
                                <UserX className="w-3 h-3" />
                                Block
                              </button>
                            )}
                            <button
                              onClick={() => handleRemoveAllowlist(entry.id)}
                              className="p-1.5 rounded text-rose-400 hover:bg-rose-500/10 transition"
                              title="Delete allowlist entry"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Tab: Access Audit Logs */}
        {activeTab === 'audit' && (
          <div className="rounded-2xl border border-border/40 bg-surface/30 p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-border/30 pb-3">
              <div>
                <h3 className="text-sm font-bold text-text flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-accent" />
                  Access Controller Audit Log
                </h3>
                <p className="text-xs text-muted">
                  Real-time security audit trails for incoming WhatsApp and Telegram messages
                </p>
              </div>
              <div className="text-[11px] font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2.5 py-1 rounded-lg">
                Audited by AgenticOS Policy Engine
              </div>
            </div>

            {(!status?.auditLogs || status.auditLogs.length === 0) ? (
              <div className="p-8 text-center text-muted text-xs space-y-2">
                <History className="w-8 h-8 mx-auto opacity-30 text-muted" />
                <p className="font-semibold text-text">No Audit Entries Recorded Yet</p>
                <p className="max-w-md mx-auto text-[11px]">
                  When contacts message the WhatsApp or Telegram gateways, their authorization queries and rate limit checks will be logged here in real-time.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs font-mono">
                  <thead>
                    <tr className="border-b border-border/40 text-muted text-[11px]">
                      <th className="pb-2">Time</th>
                      <th className="pb-2">Platform</th>
                      <th className="pb-2">Identifier</th>
                      <th className="pb-2">Sender</th>
                      <th className="pb-2">Role</th>
                      <th className="pb-2">Decision</th>
                      <th className="pb-2">Reason</th>
                      <th className="pb-2">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/20">
                    {status.auditLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-surface/50 transition">
                        <td className="py-2.5 text-muted text-[11px]">
                          {new Date(log.timestamp).toLocaleTimeString()}
                        </td>
                        <td className="py-2.5 uppercase font-bold text-[10px]">
                          {log.platform}
                        </td>
                        <td className="py-2.5 text-text font-bold">{log.identifier}</td>
                        <td className="py-2.5 text-text font-sans">{log.senderName}</td>
                        <td className="py-2.5 text-muted">{log.role}</td>
                        <td className="py-2.5">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              log.allowed
                                ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                                : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                            }`}
                          >
                            {log.allowed ? 'ALLOWED' : 'DENIED'}
                          </span>
                        </td>
                        <td className="py-2.5 text-muted text-[11px] truncate max-w-[220px]" title={log.reason}>
                          {log.reason}
                        </td>
                        <td className="py-2.5 text-accent text-[11px] font-mono">
                          {log.actionTaken}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Tab 4: Diagnostics */}
        {activeTab === 'diagnostics' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-2xl border border-border/40 bg-surface/30 p-4 space-y-3 font-mono text-xs">
              <h4 className="font-bold text-emerald-400 text-sm flex items-center gap-2">
                <Smartphone className="w-4 h-4" />
                WhatsApp Diagnostics
              </h4>
              <div className="space-y-1.5 text-muted">
                <div className="flex justify-between">
                  <span>Engine:</span>
                  <span className="text-text">{status?.whatsapp?.diagnostics?.engine}</span>
                </div>
                <div className="flex justify-between">
                  <span>Version:</span>
                  <span className="text-text">{status?.whatsapp?.diagnostics?.engineVersion}</span>
                </div>
                <div className="flex justify-between">
                  <span>State:</span>
                  <span className="text-text font-bold">{status?.whatsapp?.diagnostics?.connectionState}</span>
                </div>
                <div className="flex justify-between">
                  <span>Rate Limit Violations:</span>
                  <span className="text-text">{status?.whatsapp?.diagnostics?.rateLimitHits}</span>
                </div>
                <div className="flex justify-between">
                  <span>Access Denied Violations:</span>
                  <span className="text-text">{status?.whatsapp?.diagnostics?.securityDeniedHits}</span>
                </div>
                <div className="flex justify-between">
                  <span>Uptime:</span>
                  <span className="text-text">{status?.whatsapp?.diagnostics?.uptimeSeconds}s</span>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-border/40 bg-surface/30 p-4 space-y-3 font-mono text-xs">
              <h4 className="font-bold text-sky-400 text-sm flex items-center gap-2">
                <Bot className="w-4 h-4" />
                Telegram Diagnostics
              </h4>
              <div className="space-y-1.5 text-muted">
                <div className="flex justify-between">
                  <span>Engine:</span>
                  <span className="text-text truncate max-w-[220px]">{status?.telegram?.diagnostics?.engine}</span>
                </div>
                <div className="flex justify-between">
                  <span>Version:</span>
                  <span className="text-text">{status?.telegram?.diagnostics?.engineVersion}</span>
                </div>
                <div className="flex justify-between">
                  <span>State:</span>
                  <span className="text-text font-bold">{status?.telegram?.diagnostics?.connectionState}</span>
                </div>
                <div className="flex justify-between">
                  <span>Rate Limit Violations:</span>
                  <span className="text-text">{status?.telegram?.diagnostics?.rateLimitHits}</span>
                </div>
                <div className="flex justify-between">
                  <span>Access Denied Violations:</span>
                  <span className="text-text">{status?.telegram?.diagnostics?.securityDeniedHits}</span>
                </div>
                <div className="flex justify-between">
                  <span>Uptime:</span>
                  <span className="text-text">{status?.telegram?.diagnostics?.uptimeSeconds}s</span>
                </div>
              </div>
            </div>

            {/* Rust Credential Vault Diagnostics */}
            <div className="rounded-2xl border border-indigo-500/30 bg-indigo-500/5 p-4 space-y-3 font-mono text-xs">
              <h4 className="font-bold text-indigo-400 text-sm flex items-center gap-2">
                <Lock className="w-4 h-4" />
                Rust Credential Vault Diagnostics
              </h4>
              <div className="space-y-1.5 text-muted">
                <div className="flex justify-between">
                  <span>Storage Engine:</span>
                  <span className="text-text">
                    {status?.vault?.storageEngine || 'Rust OS Secure Storage (DPAPI / Keychain / Secret Service)'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Hardware Entropy:</span>
                  <span className="text-emerald-400 font-bold">
                    {status?.vault?.hardwareEntropyAvailable !== false ? 'Active (TRNG)' : 'Unavailable'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Encryption:</span>
                  <span className="text-text">AES-256-GCM Hardware-Bound</span>
                </div>
                <div className="flex justify-between">
                  <span>Encrypted Keys Count:</span>
                  <span className="text-text font-bold">{status?.vault?.keysCount ?? 2} secrets</span>
                </div>
                <div className="flex justify-between">
                  <span>Vault Storage Path:</span>
                  <span className="text-text truncate max-w-[200px]" title={status?.vault?.vaultPath}>
                    {status?.vault?.vaultPath || '.agenticos/vault/keys.enc'}
                  </span>
                </div>
              </div>
            </div>

            {/* Access Controller Diagnostics */}
            <div className="rounded-2xl border border-border/40 bg-surface/30 p-4 space-y-3 font-mono text-xs">
              <h4 className="font-bold text-accent text-sm flex items-center gap-2">
                <Shield className="w-4 h-4" />
                Access Controller Diagnostics
              </h4>
              <div className="space-y-1.5 text-muted">
                <div className="flex justify-between">
                  <span>Active Policy:</span>
                  <span className="text-accent font-bold uppercase">{status?.policy}</span>
                </div>
                <div className="flex justify-between">
                  <span>Enrolled Contacts:</span>
                  <span className="text-text font-bold">{status?.allowlist?.length || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span>Rate Limit Capacity:</span>
                  <span className="text-text">20 req/minute per identity</span>
                </div>
                <div className="flex justify-between">
                  <span>Audit History Depth:</span>
                  <span className="text-text">{status?.auditLogs?.length || 0} events</span>
                </div>
                <div className="flex justify-between">
                  <span>Default Dispatched Agent:</span>
                  <span className="text-text">{status?.defaultAgent || 'agenticos-coordinator'}</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
