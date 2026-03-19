import type {
  IWhatsAppProvider,
  IGroupProvider,
  ProviderConfig,
  SendTextParams,
  SendMediaParams,
  SendTemplateParams,
  SendLocationParams,
  SendResult,
  MarkReadParams,
  CreateGroupParams,
  CreateGroupResult,
  UpdateParticipantParams,
  GroupParticipant,
  GroupInfoResult,
  NormalizedMessage,
} from '../whatsapp.interface.js';
import { getRedis } from '../../config/redis.js';

/**
 * Evolution API v2 adapter
 *
 * Expected providerConfig shape:
 * {
 *   base_url: string;      // e.g. "https://evo.example.com"
 *   api_key: string;       // Global API key
 *   instance_name: string; // Instance name in Evolution
 * }
 */

interface EvolutionConfig extends ProviderConfig {
  base_url: string;
  api_key: string;
  instance_name: string;
}

async function evoFetch(
  config: EvolutionConfig,
  path: string,
  body?: Record<string, unknown>,
): Promise<unknown> {
  const url = `${config.base_url.replace(/\/$/, '')}/message/${path}/${config.instance_name}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: config.api_key,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => 'Unknown error');
    throw new Error(`Evolution API error (${response.status}): ${errorBody}`);
  }

  return response.json();
}

async function evoRequest(
  config: EvolutionConfig,
  method: 'GET' | 'POST' | 'PUT',
  path: string,
  body?: Record<string, unknown>,
): Promise<unknown> {
  const url = `${config.base_url.replace(/\/$/, '')}/${path}/${config.instance_name}`;

  const response = await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      apikey: config.api_key,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => 'Unknown error');
    throw new Error(`Evolution API error (${response.status}): ${errorBody}`);
  }

  return response.json();
}

export class EvolutionAdapter implements IWhatsAppProvider, IGroupProvider {
  readonly providerName = 'evolution_api';

  async sendText(config: ProviderConfig, params: SendTextParams): Promise<SendResult> {
    const evoConfig = config as EvolutionConfig;

    const result = await evoFetch(evoConfig, 'sendText', {
      number: params.to,
      text: params.text,
    }) as Record<string, unknown>;

    const key = result.key as Record<string, string> | undefined;

    return {
      externalMessageId: key?.id ?? (result.messageId as string) ?? '',
      status: 'sent',
      rawResponse: result,
    };
  }

  async sendMedia(config: ProviderConfig, params: SendMediaParams): Promise<SendResult> {
    const evoConfig = config as EvolutionConfig;

    const mediaTypeMap: Record<string, string> = {
      image: 'sendMedia',
      video: 'sendMedia',
      audio: 'sendWhatsAppAudio',
      document: 'sendMedia',
      sticker: 'sendSticker',
    };

    const endpoint = mediaTypeMap[params.type] ?? 'sendMedia';

    const body: Record<string, unknown> = {
      number: params.to,
      mediatype: params.type,
      caption: params.caption ?? '',
      fileName: params.filename,
      mimetype: params.mimeType,
    };

    if (params.url) {
      body.media = params.url;
    } else if (params.base64) {
      body.media = params.base64;
    }

    const result = await evoFetch(evoConfig, endpoint, body) as Record<string, unknown>;
    const key = result.key as Record<string, string> | undefined;

    return {
      externalMessageId: key?.id ?? (result.messageId as string) ?? '',
      status: 'sent',
      rawResponse: result,
    };
  }

  async sendTemplate(config: ProviderConfig, params: SendTemplateParams): Promise<SendResult> {
    const evoConfig = config as EvolutionConfig;

    // Evolution API uses sendTemplate endpoint for template messages
    const result = await evoFetch(evoConfig, 'sendTemplate', {
      number: params.to,
      name: params.templateName,
      language: params.language,
      components: params.components ?? [],
    }) as Record<string, unknown>;

    const key = result.key as Record<string, string> | undefined;

    return {
      externalMessageId: key?.id ?? (result.messageId as string) ?? '',
      status: 'sent',
      rawResponse: result,
    };
  }

  async sendLocation(config: ProviderConfig, params: SendLocationParams): Promise<SendResult> {
    const evoConfig = config as EvolutionConfig;

    const result = await evoFetch(evoConfig, 'sendLocation', {
      number: params.to,
      name: params.name ?? '',
      address: params.address ?? '',
      latitude: params.latitude,
      longitude: params.longitude,
    }) as Record<string, unknown>;

    const key = result.key as Record<string, string> | undefined;

    return {
      externalMessageId: key?.id ?? (result.messageId as string) ?? '',
      status: 'sent',
      rawResponse: result,
    };
  }

  async markAsRead(config: ProviderConfig, params: MarkReadParams): Promise<void> {
    const evoConfig = config as EvolutionConfig;

    const url = `${evoConfig.base_url.replace(/\/$/, '')}/chat/markMessageAsRead/${evoConfig.instance_name}`;

    await fetch(url, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        apikey: evoConfig.api_key,
      },
      body: JSON.stringify({
        readMessages: [{ id: params.externalMessageId }],
      }),
    });
  }

  async checkHealth(config: ProviderConfig): Promise<boolean> {
    const evoConfig = config as EvolutionConfig;
    const url = `${evoConfig.base_url.replace(/\/$/, '')}/instance/connectionState/${evoConfig.instance_name}`;

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: { apikey: evoConfig.api_key },
      });

      if (!response.ok) return false;

      const data = await response.json() as Record<string, unknown>;
      const instance = data.instance as Record<string, string> | undefined;
      return instance?.state === 'open';
    } catch {
      return false;
    }
  }

  // ── Group Management ──

  async createGroup(config: ProviderConfig, params: CreateGroupParams): Promise<CreateGroupResult> {
    const evoConfig = config as EvolutionConfig;
    const result = await evoRequest(evoConfig, 'POST', 'group/create', {
      subject: params.name,
      participants: params.participants,
      description: params.description ?? '',
    }) as Record<string, unknown>;

    return {
      groupJid: (result.id ?? result.groupJid ?? '') as string,
      name: params.name,
    };
  }

  async getGroupInfo(config: ProviderConfig, groupJid: string): Promise<GroupInfoResult> {
    const evoConfig = config as EvolutionConfig;
    const url = `${evoConfig.base_url.replace(/\/$/, '')}/group/findGroupInfos/${evoConfig.instance_name}?groupJid=${encodeURIComponent(groupJid)}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: { apikey: evoConfig.api_key },
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => 'Unknown error');
      throw new Error(`Evolution API error (${response.status}): ${errorBody}`);
    }

    const data = await response.json() as Record<string, unknown>;

    const participants = Array.isArray(data.participants)
      ? (data.participants as Array<Record<string, unknown>>).map((p) => ({
          phone: String(p.id ?? '').replace('@s.whatsapp.net', ''),
          role: (p.admin === 'superadmin' ? 'superadmin' : p.admin === 'admin' ? 'admin' : 'member') as GroupParticipant['role'],
        }))
      : [];

    return {
      groupJid: (data.id ?? groupJid) as string,
      name: (data.subject ?? '') as string,
      description: (data.desc ?? null) as string | null,
      profilePicUrl: (data.profilePictureUrl ?? null) as string | null,
      participants,
    };
  }

  async getParticipants(config: ProviderConfig, groupJid: string): Promise<GroupParticipant[]> {
    const info = await this.getGroupInfo(config, groupJid);
    return info.participants;
  }

  async updateParticipants(config: ProviderConfig, params: UpdateParticipantParams): Promise<void> {
    const evoConfig = config as EvolutionConfig;
    await evoRequest(evoConfig, 'POST', 'group/updateParticipant', {
      groupJid: params.groupJid,
      action: params.action,
      participants: params.participants,
    });
  }

  async updateGroupSubject(config: ProviderConfig, groupJid: string, name: string): Promise<void> {
    const evoConfig = config as EvolutionConfig;
    await evoRequest(evoConfig, 'POST', 'group/updateGroupSubject', {
      groupJid,
      subject: name,
    });
  }

  async updateGroupDescription(config: ProviderConfig, groupJid: string, description: string): Promise<void> {
    const evoConfig = config as EvolutionConfig;
    await evoRequest(evoConfig, 'POST', 'group/updateGroupDescription', {
      groupJid,
      description,
    });
  }

  // ── Webhook Normalization ──

  async normalizeIncomingWebhook(
    eventType: string,
    payload: Record<string, unknown>,
    config: ProviderConfig,
  ): Promise<NormalizedMessage | null> {
    if (eventType !== 'messages.upsert' && eventType !== 'MESSAGES_UPSERT') {
      return null;
    }

    const data = (payload.data ?? payload) as Record<string, unknown>;
    const key = data.key as Record<string, unknown> | undefined;
    const msg = data.message as Record<string, unknown> | undefined;
    const isFromMe = !!key?.fromMe;

    let senderPhone: string;
    const remoteJid = String(key?.remoteJid ?? '');
    let groupJid: string | undefined;
    let participantPhone: string | undefined;

    if (remoteJid.includes('@g.us')) {
      groupJid = remoteJid;
      const participantJid = String(key?.participant ?? '');
      if (participantJid.includes('@lid')) {
        const lid = participantJid.replace('@lid', '');
        const resolved = await this.resolveLidToPhone(config as EvolutionConfig, lid);
        participantPhone = resolved ?? lid;
      } else {
        participantPhone = participantJid.replace('@s.whatsapp.net', '');
      }
      senderPhone = participantPhone;
    } else if (remoteJid.includes('@lid')) {
      const lid = remoteJid.replace('@lid', '');
      const resolved = await this.resolveLidToPhone(config as EvolutionConfig, lid);
      senderPhone = resolved ?? lid;
    } else {
      senderPhone = remoteJid.replace('@s.whatsapp.net', '');
    }

    if (!senderPhone) return null;

    // Extract content
    const { content, contentType, contentAttributes } = this.extractContent(msg ?? {});

    return {
      externalMessageId: String(key?.id ?? `evo_${Date.now()}`),
      senderPhone,
      senderName: (data.pushName as string) ?? null,
      content,
      contentType,
      contentAttributes,
      timestamp: new Date(data.messageTimestamp ? Number(data.messageTimestamp) * 1000 : Date.now()),
      isFromMe,
      groupJid,
      participantPhone,
    };
  }

  async fetchProfilePicture(config: ProviderConfig, phone: string): Promise<string | null> {
    const evoConfig = config as EvolutionConfig;
    try {
      const response = await fetch(
        `${evoConfig.base_url.replace(/\/$/, '')}/chat/fetchProfilePictureUrl/${evoConfig.instance_name}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', apikey: evoConfig.api_key },
          body: JSON.stringify({ number: phone }),
        },
      );
      if (!response.ok) return null;
      const data = await response.json() as Record<string, unknown>;
      return (data.profilePictureUrl as string) ?? null;
    } catch {
      return null;
    }
  }

  // ── Private helpers ──

  private extractContent(msg: Record<string, unknown>): { content: string | null; contentType: string; contentAttributes: Record<string, unknown> } {
    const contentAttributes: Record<string, unknown> = {};

    if (msg.conversation) {
      return { content: msg.conversation as string, contentType: 'text', contentAttributes };
    }
    if ((msg.extendedTextMessage as Record<string, unknown>)?.text) {
      return { content: (msg.extendedTextMessage as Record<string, unknown>).text as string, contentType: 'text', contentAttributes };
    }
    if (msg.imageMessage) {
      const im = msg.imageMessage as Record<string, unknown>;
      contentAttributes.mimetype = im.mimetype;
      contentAttributes.url = im.url;
      return { content: (im.caption as string) ?? null, contentType: 'image', contentAttributes };
    }
    if (msg.audioMessage) {
      const am = msg.audioMessage as Record<string, unknown>;
      contentAttributes.mimetype = am.mimetype;
      contentAttributes.seconds = am.seconds;
      contentAttributes.ptt = am.ptt;
      return { content: null, contentType: 'audio', contentAttributes };
    }
    if (msg.videoMessage) {
      const vm = msg.videoMessage as Record<string, unknown>;
      contentAttributes.mimetype = vm.mimetype;
      return { content: (vm.caption as string) ?? null, contentType: 'video', contentAttributes };
    }
    if (msg.documentMessage) {
      const dm = msg.documentMessage as Record<string, unknown>;
      contentAttributes.mimetype = dm.mimetype;
      contentAttributes.fileName = dm.fileName;
      return { content: (dm.fileName as string) ?? null, contentType: 'document', contentAttributes };
    }
    if (msg.stickerMessage) {
      return { content: null, contentType: 'sticker', contentAttributes };
    }
    if (msg.locationMessage) {
      const lm = msg.locationMessage as Record<string, unknown>;
      contentAttributes.latitude = lm.degreesLatitude;
      contentAttributes.longitude = lm.degreesLongitude;
      return { content: null, contentType: 'location', contentAttributes };
    }

    return { content: null, contentType: 'text', contentAttributes };
  }

  private async resolveLidToPhone(config: EvolutionConfig, lid: string): Promise<string | null> {
    const redis = getRedis();
    const cacheKey = `lid:${config.instance_name}:${lid}`;
    const cached = await redis.get(cacheKey);
    if (cached) return cached;

    try {
      const response = await fetch(
        `${config.base_url.replace(/\/$/, '')}/chat/findContacts/${config.instance_name}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', apikey: config.api_key },
          body: JSON.stringify({ where: {} }),
        },
      );
      if (!response.ok) return null;

      const contacts = await response.json() as Array<{ remoteJid: string; profilePicUrl: string | null }>;
      const lidJid = `${lid}@lid`;
      const lidContact = contacts.find((c) => c.remoteJid === lidJid);
      if (!lidContact?.profilePicUrl) return null;

      const lidPicFile = this.extractPicFilename(lidContact.profilePicUrl);
      if (!lidPicFile) return null;

      for (const contact of contacts) {
        if (!contact.remoteJid.includes('@s.whatsapp.net') || !contact.profilePicUrl) continue;
        if (this.extractPicFilename(contact.profilePicUrl) === lidPicFile) {
          const phone = contact.remoteJid.replace('@s.whatsapp.net', '');
          await redis.set(cacheKey, phone, 'EX', 86400 * 30);
          return phone;
        }
      }
      return null;
    } catch {
      return null;
    }
  }

  private extractPicFilename(url: string): string | null {
    try {
      const parts = new URL(url).pathname.split('/');
      return parts[parts.length - 1] ?? null;
    } catch {
      return null;
    }
  }
}
