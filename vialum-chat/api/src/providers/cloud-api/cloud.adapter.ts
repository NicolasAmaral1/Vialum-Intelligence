import type {
  IWhatsAppProvider,
  ProviderConfig,
  SendTextParams,
  SendMediaParams,
  SendTemplateParams,
  SendLocationParams,
  SendResult,
  MarkReadParams,
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
}
