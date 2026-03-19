import type {
  IWhatsAppProvider,
  ProviderConfig,
  SendTextParams,
  SendMediaParams,
  SendTemplateParams,
  SendLocationParams,
  SendResult,
  MarkReadParams,
  NormalizedMessage,
} from '../whatsapp.interface.js';

/**
 * WhatsApp Cloud API (Meta) adapter
 *
 * Expected providerConfig shape:
 * {
 *   access_token: string;      // Permanent system user token
 *   phone_number_id: string;   // WhatsApp business phone number ID
 *   waba_id: string;           // WhatsApp Business Account ID
 *   app_secret?: string;       // For webhook signature verification
 *   verify_token?: string;     // For webhook verification challenge
 *   api_version?: string;      // e.g. "v21.0" (default)
 * }
 */

interface CloudConfig extends ProviderConfig {
  access_token: string;
  phone_number_id: string;
  waba_id: string;
  api_version?: string;
}

const DEFAULT_API_VERSION = 'v21.0';

async function cloudFetch(
  config: CloudConfig,
  body: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const version = config.api_version ?? DEFAULT_API_VERSION;
  const url = `https://graph.facebook.com/${version}/${config.phone_number_id}/messages`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.access_token}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => 'Unknown error');
    throw new Error(`Cloud API error (${response.status}): ${errorBody}`);
  }

  return response.json() as Promise<Record<string, unknown>>;
}

function extractMessageId(result: Record<string, unknown>): string {
  const messages = result.messages as Array<Record<string, string>> | undefined;
  return messages?.[0]?.id ?? '';
}

export class CloudApiAdapter implements IWhatsAppProvider {
  readonly providerName = 'cloud_api';

  async sendText(config: ProviderConfig, params: SendTextParams): Promise<SendResult> {
    const cloudConfig = config as CloudConfig;

    const result = await cloudFetch(cloudConfig, {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: params.to,
      type: 'text',
      text: { body: params.text },
    });

    return {
      externalMessageId: extractMessageId(result),
      status: 'sent',
      rawResponse: result,
    };
  }

  async sendMedia(config: ProviderConfig, params: SendMediaParams): Promise<SendResult> {
    const cloudConfig = config as CloudConfig;

    const mediaPayload: Record<string, unknown> = {};

    if (params.url) {
      mediaPayload.link = params.url;
    }

    if (params.caption) {
      mediaPayload.caption = params.caption;
    }

    if (params.filename && params.type === 'document') {
      mediaPayload.filename = params.filename;
    }

    const typeKey = params.type === 'sticker' ? 'sticker' : params.type;

    const result = await cloudFetch(cloudConfig, {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: params.to,
      type: typeKey,
      [typeKey]: mediaPayload,
    });

    return {
      externalMessageId: extractMessageId(result),
      status: 'sent',
      rawResponse: result,
    };
  }

  async sendTemplate(config: ProviderConfig, params: SendTemplateParams): Promise<SendResult> {
    const cloudConfig = config as CloudConfig;

    const result = await cloudFetch(cloudConfig, {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: params.to,
      type: 'template',
      template: {
        name: params.templateName,
        language: { code: params.language },
        components: params.components ?? [],
      },
    });

    return {
      externalMessageId: extractMessageId(result),
      status: 'sent',
      rawResponse: result,
    };
  }

  async sendLocation(config: ProviderConfig, params: SendLocationParams): Promise<SendResult> {
    const cloudConfig = config as CloudConfig;

    const result = await cloudFetch(cloudConfig, {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: params.to,
      type: 'location',
      location: {
        latitude: params.latitude,
        longitude: params.longitude,
        name: params.name ?? '',
        address: params.address ?? '',
      },
    });

    return {
      externalMessageId: extractMessageId(result),
      status: 'sent',
      rawResponse: result,
    };
  }

  async markAsRead(config: ProviderConfig, params: MarkReadParams): Promise<void> {
    const cloudConfig = config as CloudConfig;

    await cloudFetch(cloudConfig, {
      messaging_product: 'whatsapp',
      status: 'read',
      message_id: params.externalMessageId,
    });
  }

  async checkHealth(config: ProviderConfig): Promise<boolean> {
    const cloudConfig = config as CloudConfig;
    const version = cloudConfig.api_version ?? DEFAULT_API_VERSION;
    const url = `https://graph.facebook.com/${version}/${cloudConfig.phone_number_id}`;

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: { Authorization: `Bearer ${cloudConfig.access_token}` },
      });

      return response.ok;
    } catch {
      return false;
    }
  }

  // ── Webhook Normalization ──

  async normalizeIncomingWebhook(
    eventType: string,
    payload: Record<string, unknown>,
    _config: ProviderConfig,
  ): Promise<NormalizedMessage | null> {
    const entry = (payload.entry as Array<Record<string, unknown>>)?.[0];
    const changes = (entry?.changes as Array<Record<string, unknown>>)?.[0];
    const value = changes?.value as Record<string, unknown> | undefined;
    if (!value?.messages) return null;

    const msg = (value.messages as Array<Record<string, unknown>>)[0];
    if (!msg) return null;

    const contact = (value.contacts as Array<Record<string, unknown>>)?.[0];
    const profile = contact?.profile as Record<string, unknown> | undefined;

    const { content, contentType, contentAttributes } = this.extractContent(msg);

    return {
      externalMessageId: msg.id as string,
      senderPhone: msg.from as string,
      senderName: (profile?.name as string) ?? null,
      content,
      contentType,
      contentAttributes,
      timestamp: new Date(parseInt(msg.timestamp as string, 10) * 1000),
      isFromMe: false, // Cloud API webhooks only deliver incoming messages
    };
  }

  async fetchProfilePicture(_config: ProviderConfig, _phone: string): Promise<string | null> {
    // Cloud API doesn't provide profile picture fetching via API
    return null;
  }

  private extractContent(msg: Record<string, unknown>): { content: string | null; contentType: string; contentAttributes: Record<string, unknown> } {
    const contentAttributes: Record<string, unknown> = {};
    const type = msg.type as string;

    switch (type) {
      case 'text':
        return { content: (msg.text as Record<string, unknown>)?.body as string ?? null, contentType: 'text', contentAttributes };
      case 'image': {
        const im = msg.image as Record<string, unknown>;
        contentAttributes.mediaId = im?.id;
        contentAttributes.mimetype = im?.mime_type;
        return { content: (im?.caption as string) ?? null, contentType: 'image', contentAttributes };
      }
      case 'audio': {
        const am = msg.audio as Record<string, unknown>;
        contentAttributes.mediaId = am?.id;
        contentAttributes.mimetype = am?.mime_type;
        return { content: null, contentType: 'audio', contentAttributes };
      }
      case 'video': {
        const vm = msg.video as Record<string, unknown>;
        contentAttributes.mediaId = vm?.id;
        return { content: (vm?.caption as string) ?? null, contentType: 'video', contentAttributes };
      }
      case 'document': {
        const dm = msg.document as Record<string, unknown>;
        contentAttributes.mediaId = dm?.id;
        contentAttributes.fileName = dm?.filename;
        return { content: (dm?.filename as string) ?? null, contentType: 'document', contentAttributes };
      }
      case 'sticker':
        contentAttributes.mediaId = (msg.sticker as Record<string, unknown>)?.id;
        return { content: null, contentType: 'sticker', contentAttributes };
      case 'location': {
        const lm = msg.location as Record<string, unknown>;
        contentAttributes.latitude = lm?.latitude;
        contentAttributes.longitude = lm?.longitude;
        return { content: null, contentType: 'location', contentAttributes };
      }
      default:
        return { content: `[${type}]`, contentType: 'text', contentAttributes };
    }
  }
}
