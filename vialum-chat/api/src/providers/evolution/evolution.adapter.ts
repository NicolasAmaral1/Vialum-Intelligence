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
} from '../whatsapp.interface.js';

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
}
