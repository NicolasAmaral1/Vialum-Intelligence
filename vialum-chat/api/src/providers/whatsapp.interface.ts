export interface SendTextParams {
  to: string; // Phone number or JID
  text: string;
}

export interface SendMediaParams {
  to: string;
  type: 'image' | 'video' | 'audio' | 'document' | 'sticker';
  url?: string;
  base64?: string;
  caption?: string;
  filename?: string;
  mimeType?: string;
}

export interface SendTemplateParams {
  to: string;
  templateName: string;
  language: string;
  components?: Array<{
    type: string;
    parameters: Array<Record<string, unknown>>;
  }>;
}

export interface SendLocationParams {
  to: string;
  latitude: number;
  longitude: number;
  name?: string;
  address?: string;
}

export interface SendResult {
  externalMessageId: string;
  status: 'sent' | 'failed';
  rawResponse?: unknown;
}

export interface MarkReadParams {
  externalMessageId: string;
}

export interface ProviderConfig {
  [key: string]: unknown;
}

// ════════════════════════════════════════════════════════════
// GROUP MANAGEMENT INTERFACES
// ════════════════════════════════════════════════════════════

export interface CreateGroupParams {
  name: string;
  participants: string[]; // phone numbers
  description?: string;
}

export interface CreateGroupResult {
  groupJid: string;
  name: string;
}

export interface UpdateParticipantParams {
  groupJid: string;
  participants: string[]; // phone numbers
  action: 'add' | 'remove' | 'promote' | 'demote';
}

export interface GroupParticipant {
  phone: string;
  role: 'admin' | 'member' | 'superadmin';
}

export interface GroupInfoResult {
  groupJid: string;
  name: string;
  description: string | null;
  profilePicUrl: string | null;
  participants: GroupParticipant[];
}

export interface IGroupProvider {
  createGroup(config: ProviderConfig, params: CreateGroupParams): Promise<CreateGroupResult>;
  getGroupInfo(config: ProviderConfig, groupJid: string): Promise<GroupInfoResult>;
  getParticipants(config: ProviderConfig, groupJid: string): Promise<GroupParticipant[]>;
  updateParticipants(config: ProviderConfig, params: UpdateParticipantParams): Promise<void>;
  updateGroupSubject(config: ProviderConfig, groupJid: string, name: string): Promise<void>;
  updateGroupDescription(config: ProviderConfig, groupJid: string, description: string): Promise<void>;
}

// ════════════════════════════════════════════════════════════
// WEBHOOK NORMALIZATION
// ════════════════════════════════════════════════════════════

/** Normalized incoming message — provider-agnostic format */
export interface NormalizedMessage {
  externalMessageId: string;
  senderPhone: string;
  senderName: string | null;
  content: string | null;
  contentType: string;
  contentAttributes: Record<string, unknown>;
  timestamp: Date;
  isFromMe: boolean;
  groupJid?: string;
  participantPhone?: string;
}

// ════════════════════════════════════════════════════════════
// MESSAGING INTERFACE
// ════════════════════════════════════════════════════════════

export interface IWhatsAppProvider {
  /**
   * Unique provider identifier
   */
  readonly providerName: string;

  /**
   * Send a plain text message
   */
  sendText(config: ProviderConfig, params: SendTextParams): Promise<SendResult>;

  /**
   * Send a media message (image, video, audio, document, sticker)
   */
  sendMedia(config: ProviderConfig, params: SendMediaParams): Promise<SendResult>;

  /**
   * Send a message template (HSM)
   */
  sendTemplate(config: ProviderConfig, params: SendTemplateParams): Promise<SendResult>;

  /**
   * Send a location pin
   */
  sendLocation(config: ProviderConfig, params: SendLocationParams): Promise<SendResult>;

  /**
   * Mark a message as read
   */
  markAsRead(config: ProviderConfig, params: MarkReadParams): Promise<void>;

  /**
   * Check if the provider instance is connected / healthy
   */
  checkHealth(config: ProviderConfig): Promise<boolean>;

  /**
   * Send typing presence indicator (composing/paused).
   * Not all providers support this — default implementation is no-op.
   */
  sendPresence?(config: ProviderConfig, to: string, presence: 'composing' | 'paused'): Promise<void>;

  /**
   * Normalize an incoming webhook payload into a provider-agnostic format.
   * Returns null if the payload is not a processable message (e.g. status update).
   */
  normalizeIncomingWebhook(
    eventType: string,
    payload: Record<string, unknown>,
    config: ProviderConfig,
  ): Promise<NormalizedMessage | null>;

  /**
   * Fetch a contact's profile picture URL.
   * Returns null if not available.
   */
  fetchProfilePicture(config: ProviderConfig, phone: string): Promise<string | null>;
}
