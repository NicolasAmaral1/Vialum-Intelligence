// ════════════════════════════════════════════════════════════
// TreeFlow Type System
// ════════════════════════════════════════════════════════════

// ── TreeFlow Definition (stored in TreeFlowVersion.definition) ──

export interface TreeFlowDefinition {
  initial_step_id: string;
  steps: TreeFlowStep[];
  global_instructions: string;
}

export interface TreeFlowStep {
  id: string;
  name: string;
  description: string;
  type: 'opening' | 'qualification' | 'presentation' | 'negotiation' | 'closing' | 'fallback' | 'custom';
  instructions: string;
  actions: TreeFlowAction[];
  transitions: TreeFlowTransition[];
  max_messages_in_step: number;
  labels_to_apply: string[];
  sub_treeflow_slug: string | null;
}

export interface TreeFlowAction {
  id: string;
  name: string;
  type: 'text' | 'number' | 'boolean' | 'date' | 'email' | 'phone' | 'select' | 'multi_select' | 'url' | 'custom';
  required: boolean;
  validation: ActionValidation | null;
  extraction_hint: string;
}

export interface ActionValidation {
  pattern?: string;
  min?: number;
  max?: number;
  min_length?: number;
  max_length?: number;
  options?: string[];
  custom_message?: string;
}

export interface TreeFlowTransition {
  id: string;
  target_step_id: string;
  condition: TransitionCondition;
  priority: number;
}

export interface TransitionCondition {
  type: 'all_actions_filled' | 'specific_actions_filled' | 'message_count_exceeded' | 'objection_detected' | 'escape_detected' | 'manual' | 'always' | 'custom';
  params: Record<string, unknown>;
}

// ── TalkFlow State (stored in TalkFlow.state) ──

export interface TalkFlowState {
  filled_actions: Record<string, TalkFlowFilledAction>;
  step_history: TalkFlowStepEntry[];
  variables: Record<string, unknown>;
  messages_in_current_step: number;
}

export interface TalkFlowFilledAction {
  value: unknown;
  filled_at: string;
  source_message_id: string | null;
  confidence: number;
  confirmed: boolean;
}

export interface TalkFlowStepEntry {
  step_id: string;
  entered_at: string;
  exited_at: string | null;
  exit_reason: 'transition' | 'manual' | 'timeout' | 'escape' | 'sub_talk' | null;
}

// ── AI Response (structured output from OpenAI) ──

export interface TreeFlowAIResponse {
  message_analysis: {
    intent: string;
    sentiment: 'positive' | 'neutral' | 'negative';
    summary: string;
  };
  extracted_data: Record<string, {
    value: unknown;
    confidence: number;
    action_id: string;
  }>;
  objection_detected: {
    detected: boolean;
    objection_id: string | null;
    severity: 'low' | 'medium' | 'high' | 'critical' | null;
    details: string | null;
  };
  escape_detected: {
    detected: boolean;
    reason: string | null;
  };
  step_transition: {
    should_transition: boolean;
    target_step_id: string | null;
    reason: string | null;
  };
  suggested_response: {
    content: string;
    confidence: number;
    reasoning: string;
  };
  state_diff: {
    variables_to_set: Record<string, unknown>;
    actions_to_confirm: string[];
  };
}

// ── TreeFlow Settings (stored in TreeFlow.settings) ──

export interface TreeFlowSettings {
  auto_mode_enabled: boolean;
  confidence_threshold: number;
  inactivity_timeout_minutes: number;
  max_objection_retries: number;
  default_labels: string[];
}

// ── Engine Internal Types ──

export interface EngineContext {
  talkId: string;
  accountId: string;
  conversationId: string;
  messageId: string;
  messageContent: string;
  messageSenderType: string;
}

export interface RoutingResult {
  talkId: string | null;
  confidence: number;
  routedBy: 'direct' | 'ai' | 'system';
}

export interface LoadedTalkContext {
  talk: {
    id: string;
    accountId: string;
    conversationId: string;
    contactId: string;
    treeFlowId: string;
    treeFlowVersionId: string;
    status: string;
    parentTalkId: string | null;
    metadata: Record<string, unknown>;
  };
  talkFlow: {
    id: string;
    currentStepId: string;
    state: TalkFlowState;
    objectionsEncountered: string[];
    escapeAttempts: number;
    confidenceHistory: number[];
  };
  definition: TreeFlowDefinition;
  currentStep: TreeFlowStep;
  settings: TreeFlowSettings;
  objections: LoadedObjection[];
  recentMessages: LoadedMessage[];
  contact: LoadedContact;
}

export interface LoadedObjection {
  id: string;
  name: string;
  category: string | null;
  description: string | null;
  detectionHints: string[];
  rebuttalStrategy: string | null;
  rebuttalExamples: string[];
  severity: string;
  stepIds: string[];
  priority: number;
}

export interface LoadedMessage {
  id: string;
  content: string | null;
  senderType: string;
  messageType: string;
  createdAt: Date;
}

export interface LoadedContact {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  customAttributes: Record<string, unknown>;
  funnelStage: string | null;
}

export interface DecisionResult {
  mode: 'auto' | 'hitl';
  suggestionId: string | null;
  messageContent: string;
}

export interface PostProcessResult {
  stepChanged: boolean;
  subTalkSpawned: string | null;
  talkCompleted: boolean;
  labelsApplied: string[];
}

// ── Default Settings ──

export const DEFAULT_TREEFLOW_SETTINGS: TreeFlowSettings = {
  auto_mode_enabled: false,
  confidence_threshold: 0.85,
  inactivity_timeout_minutes: 1440,
  max_objection_retries: 3,
  default_labels: [],
};

export const DEFAULT_TALKFLOW_STATE: TalkFlowState = {
  filled_actions: {},
  step_history: [],
  variables: {},
  messages_in_current_step: 0,
};
