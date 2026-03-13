// ════════════════════════════════════════════════════════════
// Vialum Chat — API Types (mirrors Prisma schema)
// ════════════════════════════════════════════════════════════

export interface Account {
  id: string;
  name: string;
  slug: string;
  plan: string;
  settings: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  createdAt: string;
  updatedAt: string;
  accountUsers?: AccountUser[];
}

export interface AccountUser {
  id: string;
  accountId: string;
  userId: string;
  role: string;
  availability: string;
  account?: Account;
  user?: User;
  createdAt: string;
  updatedAt: string;
}

export interface Inbox {
  id: string;
  accountId: string;
  name: string;
  channelType: string;
  provider: string;
  providerConfig: Record<string, unknown>;
  workingHours: Record<string, unknown>;
  greetingMessage: string | null;
  outOfOfficeMessage: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Contact {
  id: string;
  accountId: string;
  name: string;
  phone: string | null;
  email: string | null;
  avatarUrl: string | null;
  customAttributes: Record<string, unknown>;
  funnelStage: string | null;
  notes: string | null;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ContactInbox {
  id: string;
  contactId: string;
  inboxId: string;
  sourceId: string;
  createdAt: string;
}

export interface Group {
  id: string;
  jid: string;
  name: string;
  groupType: 'client' | 'agency';
  profilePicUrl: string | null;
  description?: string | null;
}

export interface SenderContact {
  id: string;
  name: string;
  phone: string | null;
  avatarUrl?: string | null;
}

export interface Conversation {
  id: string;
  accountId: string;
  inboxId: string;
  contactId: string;
  contactInboxId: string | null;
  assigneeId: string | null;
  activeTalkId: string | null;
  groupId: string | null;
  status: ConversationStatus;
  unreadCount: number;
  lastActivityAt: string;
  snoozedUntil: string | null;
  customAttributes: Record<string, unknown>;
  additionalAttributes: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  // Relations (populated by API)
  contact?: Contact;
  inbox?: Inbox;
  assignee?: User;
  group?: Group;
  conversationLabels?: ConversationLabel[];
  messages?: Message[];
  lastMessage?: Message | null;
}

export type ConversationStatus = 'open' | 'pending' | 'resolved' | 'snoozed';

export interface Message {
  id: string;
  accountId: string;
  conversationId: string;
  inboxId: string;
  senderType: 'user' | 'contact' | 'bot';
  senderId: string | null;
  senderContactId: string | null;
  content: string | null;
  messageType: 'incoming' | 'outgoing' | 'activity' | 'template';
  contentType: 'text' | 'image' | 'video' | 'audio' | 'document' | 'location' | 'sticker' | 'template';
  contentAttributes: Record<string, unknown>;
  status: 'sending' | 'sent' | 'delivered' | 'read' | 'failed';
  private: boolean;
  externalMessageId: string | null;
  createdAt: string;
  updatedAt: string;
  // Relations
  senderContact?: SenderContact;
  // Optimistic UI
  _tempId?: string;
  _optimistic?: boolean;
}

export interface Label {
  id: string;
  accountId: string;
  name: string;
  color: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
  _count?: { conversationLabels: number };
}

export interface ConversationLabel {
  conversationId: string;
  labelId: string;
  label?: Label;
  createdAt: string;
}

export interface CannedResponse {
  id: string;
  accountId: string;
  shortCode: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

export interface AutomationRule {
  id: string;
  accountId: string;
  name: string;
  description: string | null;
  eventName: string;
  conditions: AutomationCondition[];
  actions: AutomationAction[];
  active: boolean;
  runCount: number;
  lastRunAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AutomationCondition {
  attribute: string;
  operator: 'equals' | 'not_equals' | 'contains' | 'not_contains' | 'starts_with' | 'ends_with' | 'is_present' | 'is_not_present';
  value?: string;
}

export interface AutomationAction {
  type: 'assign_agent' | 'assign_label' | 'send_message' | 'send_webhook' | 'change_status' | 'start_treeflow' | 'mute_conversation';
  params: Record<string, unknown>;
}

export interface AISuggestion {
  id: string;
  accountId: string;
  conversationId: string;
  talkId: string | null;
  talkStepId: string | null;
  triggeredBy: string | null;
  triggerId: string | null;
  content: string;
  editedContent: string | null;
  status: 'pending' | 'approved' | 'rejected' | 'sent' | 'edited';
  confidence: number | null;
  autoMode: boolean;
  funnelStage: string | null;
  context: Record<string, unknown>;
  reviewedBy: string | null;
  reviewedAt: string | null;
  sentAt: string | null;
  createdAt: string;
  updatedAt: string;
  // Relations
  conversation?: Conversation;
}

export interface TreeFlow {
  id: string;
  accountId: string;
  name: string;
  slug: string;
  description: string | null;
  category: string | null;
  activeVersionId: string | null;
  settings: Record<string, unknown>;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
  activeVersion?: TreeFlowVersion;
  versions?: TreeFlowVersion[];
}

export interface TreeFlowVersion {
  id: string;
  treeFlowId: string;
  versionNumber: number;
  status: 'draft' | 'published' | 'deprecated';
  definition: Record<string, unknown>;
  abWeight: number;
  notes: string | null;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Objection {
  id: string;
  accountId: string;
  name: string;
  category: string | null;
  description: string | null;
  detectionHints: string[];
  rebuttalStrategy: string | null;
  rebuttalExamples: string[];
  severity: 'low' | 'medium' | 'high' | 'critical';
  createdAt: string;
  updatedAt: string;
}

export interface TreeFlowObjection {
  treeFlowId: string;
  objectionId: string;
  stepIds: string[];
  priority: number;
  createdAt: string;
}

export interface Talk {
  id: string;
  accountId: string;
  conversationId: string;
  contactId: string;
  treeFlowId: string;
  treeFlowVersionId: string;
  parentTalkId: string | null;
  status: 'active' | 'paused' | 'completed' | 'closed_inactivity' | 'closed_manual' | 'archived';
  priority: number;
  metadata: Record<string, unknown>;
  startedAt: string;
  pausedAt: string | null;
  resumedAt: string | null;
  closedAt: string | null;
  lastActivityAt: string;
  inactivityTimeoutMinutes: number;
  createdAt: string;
  updatedAt: string;
  talkFlow?: TalkFlow;
  treeFlow?: TreeFlow;
}

export interface TalkFlow {
  id: string;
  talkId: string;
  currentStepId: string;
  state: Record<string, unknown>;
  objectionsEncountered: string[];
  escapeAttempts: number;
  confidenceHistory: number[];
  snapshot: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

export interface TalkEvent {
  id: string;
  talkId: string;
  eventType: string;
  data: Record<string, unknown>;
  actorType: 'system' | 'ai' | 'agent' | 'automation';
  actorId: string | null;
  actor?: User;
  createdAt: string;
}

export interface TalkMessage {
  id: string;
  talkId: string;
  messageId: string;
  routingConfidence: number | null;
  routedBy: 'ai' | 'manual' | 'system';
  createdAt: string;
}

// ── Auth ──────────────────────────────────────────────────────

export interface LoginResult {
  user: User;
  accounts: Array<{ accountId: string; accountName: string; role: string }>;
  tokens: TokenPair;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export interface JwtPayload {
  userId: string;
  accountId: string;
  role: string;
  iat: number;
  exp: number;
}

// ── Pagination ────────────────────────────────────────────────

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

// ── Filters ───────────────────────────────────────────────────

export interface ConversationFilters {
  status?: ConversationStatus | null;
  inboxId?: string | null;
  labelId?: string | null;
  assigneeId?: string | null;
  search?: string;
  page?: number;
  limit?: number;
}
