import type { Message } from './api';

// ════════════════════════════════════════════════════════════
// WebSocket Event Types
// ════════════════════════════════════════════════════════════

// ── Client → Server ──────────────────────────────────────────

export interface ClientToServerEvents {
  'subscribe:account': (accountId: string) => void;
  'subscribe:conversation': (conversationId: string) => void;
  'unsubscribe:conversation': (conversationId: string) => void;
  'typing:start': (data: { conversationId: string; userId: string }) => void;
  'typing:stop': (data: { conversationId: string; userId: string }) => void;
}

// ── Server → Client ──────────────────────────────────────────

export interface ServerToClientEvents {
  'message:created': (data: MessageCreatedEvent) => void;
  'conversation:updated': (data: ConversationUpdatedEvent) => void;
  'conversation:typing_on': (data: TypingEvent) => void;
  'conversation:typing_off': (data: TypingEvent) => void;
  'conversation:assigned': (data: ConversationAssignedEvent) => void;
  'conversation:status_changed': (data: ConversationStatusChangedEvent) => void;
  'conversation:reopened': (data: ConversationReopenedEvent) => void;
  'talk:started': (data: TalkStartedEvent) => void;
  'talk:step_changed': (data: TalkStepChangedEvent) => void;
  'talk:auto_sent': (data: TalkAutoSentEvent) => void;
  'talk:hitl_queued': (data: TalkHitlQueuedEvent) => void;
  'suggestion:created': (data: SuggestionCreatedEvent) => void;
  'talk:sub_talk_spawned': (data: TalkSubTalkSpawnedEvent) => void;
  'talk:completed': (data: TalkCompletedEvent) => void;
  'talk:closed': (data: TalkClosedEvent) => void;
}

// ── Event Payloads ───────────────────────────────────────────

export interface MessageCreatedEvent {
  message: Message;
}

export interface ConversationUpdatedEvent {
  conversationId: string;
  lastActivityAt: string;
  unreadCount: number;
}

export interface TypingEvent {
  conversationId: string;
  userId: string;
}

export interface ConversationAssignedEvent {
  conversationId: string;
  assigneeId: string;
}

export interface ConversationStatusChangedEvent {
  conversationId: string;
  status: string;
  previousStatus?: string;
}

export interface ConversationReopenedEvent {
  conversationId: string;
  reason: string;
}

export interface TalkStartedEvent {
  conversationId: string;
  treeFlowName: string;
}

export interface TalkStepChangedEvent {
  talkId: string;
  conversationId: string;
  previousStepId: string;
  currentStepId: string;
  stepName: string;
  reason?: string;
}

export interface TalkAutoSentEvent {
  talkId: string;
  conversationId: string;
  content: string;
}

export interface TalkHitlQueuedEvent {
  talkId: string;
  conversationId: string;
  suggestionId: string;
  content: string;
}

export interface SuggestionCreatedEvent {
  conversationId: string;
  suggestionId: string;
  content: string;
  context: Record<string, unknown>;
}

export interface TalkSubTalkSpawnedEvent {
  parentTalkId: string;
  subTalkId: string;
  conversationId: string;
  treeFlowSlug: string;
}

export interface TalkCompletedEvent {
  talkId: string;
  conversationId: string;
}

export interface TalkClosedEvent {
  talkId: string;
  conversationId: string;
  reason: string;
}
