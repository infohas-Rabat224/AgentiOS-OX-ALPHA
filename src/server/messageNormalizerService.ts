import { agenticOSEventBus } from './agenticOSEventBus';
import type { MessageEnvelope, GatewayPlatform } from './messagingGatewayService';

export interface RawWhatsAppPayload {
  key: {
    remoteJid?: string;
    fromMe?: boolean;
    id?: string;
    participant?: string;
  };
  message?: {
    conversation?: string;
    extendedTextMessage?: { text?: string; matchedText?: string };
    imageMessage?: { caption?: string; mimetype?: string; fileLength?: number };
    videoMessage?: { caption?: string; mimetype?: string };
    audioMessage?: { mimetype?: string; seconds?: number; ptt?: boolean };
    documentMessage?: { fileName?: string; mimetype?: string; caption?: string };
    buttonsResponseMessage?: { selectedDisplayText?: string; selectedButtonId?: string };
    templateButtonReplyMessage?: { selectedDisplayText?: string; selectedId?: string };
    listResponseMessage?: { title?: string; description?: string };
  };
  messageTimestamp?: number | Long;
  pushName?: string;
  broadcast?: boolean;
  status?: number;
}

export interface RawTelegramPayload {
  update_id: number;
  message?: {
    message_id: number;
    from?: {
      id: number;
      is_bot: boolean;
      first_name?: string;
      last_name?: string;
      username?: string;
      language_code?: string;
    };
    chat: {
      id: number | string;
      first_name?: string;
      last_name?: string;
      username?: string;
      type: 'private' | 'group' | 'supergroup' | 'channel';
      title?: string;
    };
    date: number;
    text?: string;
    caption?: string;
    photo?: Array<{ file_id: string; file_size?: number }>;
    document?: { file_name?: string; mime_type?: string };
    voice?: { duration: number; mime_type?: string };
    entities?: Array<{ offset: number; length: number; type: string }>;
  };
  callback_query?: {
    id: string;
    from: any;
    message?: any;
    data?: string;
  };
}

/**
 * AgenticOS Message Normalizer Service
 * 
 * Transforms platform-specific raw messaging payloads (Baileys WhatsApp protocol & Telegram Bot API)
 * into the unified, canonical 'MessageEnvelope' model and dispatches them directly onto
 * the AgenticOS Central Event Bus.
 */
export class MessageNormalizerService {
  private static instance: MessageNormalizerService;

  public static getInstance(): MessageNormalizerService {
    if (!MessageNormalizerService.instance) {
      MessageNormalizerService.instance = new MessageNormalizerService();
    }
    return MessageNormalizerService.instance;
  }

  /**
   * Transforms raw Baileys WhatsApp message into canonical MessageEnvelope
   */
  public normalizeWhatsApp(
    rawMsg: RawWhatsAppPayload,
    gatewayAccountId?: string
  ): MessageEnvelope | null {
    if (!rawMsg || !rawMsg.key) return null;
    if (rawMsg.key.fromMe) return null; // Ignore self-echoes

    const remoteJid = rawMsg.key.remoteJid;
    if (!remoteJid || remoteJid === 'status@broadcast') return null;

    const isGroup = remoteJid.endsWith('@g.us');
    const senderId = isGroup && rawMsg.key.participant
      ? rawMsg.key.participant.replace('@s.whatsapp.net', '')
      : remoteJid.replace('@s.whatsapp.net', '').replace('@g.us', '');

    const senderName = rawMsg.pushName || (isGroup ? `Member ${senderId.slice(-4)}` : senderId);

    // Extract text content across all possible Baileys message variants
    let extractedText = '';
    let hasMedia = false;
    let mediaType: string | undefined;

    if (rawMsg.message?.conversation) {
      extractedText = rawMsg.message.conversation;
    } else if (rawMsg.message?.extendedTextMessage?.text) {
      extractedText = rawMsg.message.extendedTextMessage.text;
    } else if (rawMsg.message?.imageMessage) {
      hasMedia = true;
      mediaType = 'image';
      extractedText = rawMsg.message.imageMessage.caption || '[Image Attachment]';
    } else if (rawMsg.message?.videoMessage) {
      hasMedia = true;
      mediaType = 'video';
      extractedText = rawMsg.message.videoMessage.caption || '[Video Attachment]';
    } else if (rawMsg.message?.audioMessage) {
      hasMedia = true;
      mediaType = rawMsg.message.audioMessage.ptt ? 'voice_note' : 'audio';
      extractedText = '[Voice/Audio Message]';
    } else if (rawMsg.message?.documentMessage) {
      hasMedia = true;
      mediaType = 'document';
      extractedText = rawMsg.message.documentMessage.caption || `[Document: ${rawMsg.message.documentMessage.fileName || 'file'}]`;
    } else if (rawMsg.message?.buttonsResponseMessage?.selectedDisplayText) {
      extractedText = rawMsg.message.buttonsResponseMessage.selectedDisplayText;
    } else if (rawMsg.message?.templateButtonReplyMessage?.selectedDisplayText) {
      extractedText = rawMsg.message.templateButtonReplyMessage.selectedDisplayText;
    } else if (rawMsg.message?.listResponseMessage?.title) {
      extractedText = rawMsg.message.listResponseMessage.title;
    }

    if (!extractedText.trim()) {
      return null;
    }

    const trimmedText = extractedText.trim();
    const isCommand = trimmedText.startsWith('/') || trimmedText.startsWith('!');
    const epochMs = rawMsg.messageTimestamp
      ? (typeof rawMsg.messageTimestamp === 'number' ? rawMsg.messageTimestamp * 1000 : Number(rawMsg.messageTimestamp) * 1000)
      : Date.now();

    const envelope: MessageEnvelope = {
      id: `wa-${rawMsg.key.id || Date.now()}`,
      gatewayId: 'whatsapp-gateway-01',
      platform: 'whatsapp',
      accountId: gatewayAccountId,
      conversationId: remoteJid,
      senderId,
      senderName,
      messageType: isCommand ? 'command' : hasMedia ? 'media' : 'text',
      text: trimmedText,
      timestamp: new Date(epochMs).toISOString(),
      epochMs,
      direction: 'inbound',
      status: 'received',
      metadata: {
        isGroup,
        participantJid: rawMsg.key.participant,
        hasMedia,
        mediaType,
        pushName: rawMsg.pushName,
        normalizedBy: 'MessageNormalizerService-v2',
      },
    };

    // Dispatch to AgenticOS Event Bus
    agenticOSEventBus.publish('gateway.message.raw', rawMsg, 'whatsapp-normalizer');
    agenticOSEventBus.publish('gateway.message.normalized', envelope, 'whatsapp-normalizer');
    agenticOSEventBus.publish('gateway.message.inbound', envelope, 'whatsapp-normalizer');

    return envelope;
  }

  /**
   * Transforms raw Telegram update into canonical MessageEnvelope
   */
  public normalizeTelegram(
    rawUpdate: RawTelegramPayload,
    botId?: string
  ): MessageEnvelope | null {
    if (!rawUpdate) return null;

    const msg = rawUpdate.message || rawUpdate.callback_query?.message;
    if (!msg) return null;

    const chatId = msg.chat?.id?.toString();
    if (!chatId) return null;

    const from = rawUpdate.callback_query ? rawUpdate.callback_query.from : msg.from;
    const senderId = from?.id?.toString() || chatId;
    const senderUsername = from?.username ? `@${from.username}` : undefined;
    const fullName = `${from?.first_name || ''} ${from?.last_name || ''}`.trim();
    const senderName = senderUsername || fullName || 'Telegram User';

    let text = msg.text || msg.caption || '';
    if (rawUpdate.callback_query?.data) {
      text = rawUpdate.callback_query.data;
    }

    let hasMedia = false;
    let mediaType: string | undefined;

    if (msg.photo && msg.photo.length > 0) {
      hasMedia = true;
      mediaType = 'photo';
      if (!text) text = '[Telegram Photo]';
    } else if (msg.document) {
      hasMedia = true;
      mediaType = 'document';
      if (!text) text = `[Document: ${msg.document.file_name || 'file'}]`;
    } else if (msg.voice) {
      hasMedia = true;
      mediaType = 'voice';
      if (!text) text = '[Voice Note]';
    }

    if (!text.trim()) return null;

    const trimmedText = text.trim();
    const isCommand = trimmedText.startsWith('/') || (msg.entities && msg.entities.some((e: any) => e.type === 'bot_command'));
    const epochMs = msg.date ? msg.date * 1000 : Date.now();

    const envelope: MessageEnvelope = {
      id: `tg-${msg.message_id || Date.now()}`,
      gatewayId: 'telegram-gateway-01',
      platform: 'telegram',
      accountId: botId,
      conversationId: chatId,
      senderId,
      senderName,
      senderUsername,
      messageType: isCommand ? 'command' : hasMedia ? 'media' : 'text',
      text: trimmedText,
      timestamp: new Date(epochMs).toISOString(),
      epochMs,
      direction: 'inbound',
      status: 'received',
      metadata: {
        chatType: msg.chat?.type,
        chatTitle: msg.chat?.title,
        hasMedia,
        mediaType,
        normalizedBy: 'MessageNormalizerService-v2',
      },
    };

    // Dispatch to AgenticOS Event Bus
    agenticOSEventBus.publish('gateway.message.raw', rawUpdate, 'telegram-normalizer');
    agenticOSEventBus.publish('gateway.message.normalized', envelope, 'telegram-normalizer');
    agenticOSEventBus.publish('gateway.message.inbound', envelope, 'telegram-normalizer');

    return envelope;
  }

  /**
   * Normalizes an outbound message sent by the system or an agent
   */
  public normalizeOutbound(
    platform: GatewayPlatform,
    recipientId: string,
    text: string,
    botIdentity?: string,
    replyToEnvelopeId?: string
  ): MessageEnvelope {
    const envelope: MessageEnvelope = {
      id: `${platform}-out-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      gatewayId: `${platform}-gateway-01`,
      platform,
      conversationId: recipientId,
      senderId: botIdentity || 'AgenticOS-Core',
      senderName: 'AgenticOS Mission Agent',
      messageType: 'text',
      text,
      timestamp: new Date().toISOString(),
      epochMs: Date.now(),
      direction: 'outbound',
      status: 'sent',
      replyToId: replyToEnvelopeId,
      metadata: {
        normalizedBy: 'MessageNormalizerService-v2',
      },
    };

    agenticOSEventBus.publish('gateway.message.outbound', envelope, `${platform}-outbound`);
    return envelope;
  }
}

export const messageNormalizerService = MessageNormalizerService.getInstance();
