/**
 * Workflow Definition V2 Types — Parsed from YAML
 *
 * Taxonomy: Workflow > Stage > Task > Step
 *
 * - Stage: macro phase, visible on board, maps 1:1 to ClickUp status
 * - Task: work block. Claude session lives during a Task.
 * - Step: executable unit with defined executor (ai | human | system | client)
 */

export interface WorkflowDefinitionV2 {
  slug: string;
  name: string;
  description?: string;
  version: number;
  dataSchema?: Record<string, unknown>;
  stages: StageDefinition[];
}

export interface StageDefinition {
  id: string;
  name: string;
  position: number;
  clickupStatus?: string;
  tasks: TaskDefinition[];
}

export interface TaskDefinition {
  id: string;
  name: string;
  position: number;
  steps: StepDefinition[];
}

export interface StepDefinition {
  id: string;
  name: string;
  position: number;

  /** Who does the work */
  executor: 'ai' | 'human' | 'system' | 'client';

  /** How the work is done */
  adapterType: 'squad' | 'sdk' | 'langchain' | 'script' | 'human' | 'wait';

  /** Adapter-specific configuration (squadRef, scriptPath, etc.) */
  adapterConfig?: Record<string, unknown>;

  /** Role that sees this in the inbox (for executor: human) */
  assigneeRole?: string;

  /** If true, stage only completes after this step completes */
  isGate?: boolean;

  /** JSONLogic condition — skip step if evaluates to false */
  condition?: string;

  /** JSON Schema of what this step receives from the context bus */
  inputSchema?: Record<string, unknown>;

  /** JSON Schema of what this step produces */
  outputSchema?: Record<string, unknown>;

  /** Prompt template with {{key}} interpolation (for executor: ai) */
  promptTemplate?: string;

  /** Wait config (for executor: client) */
  waitConfig?: WaitConfig;

  /** Graph transitions — if set, overrides linear position-based advancement */
  transitions?: StepTransition[];

  /** Squad can request dynamic human input mid-step */
  allowCheckpoints?: boolean;

  /** Post-completion variable updates: [{ set: "key", value: "expression" }] */
  onComplete?: Array<{ set: string; value: string }>;

  /** Max wait time for human/client steps (ms) */
  timeoutMs?: number;

  /** Step to jump to on timeout (null = fail workflow) */
  onTimeout?: string;

  /** Step to jump to on failure after all retries (null = fail workflow) */
  onFailure?: string;

  /** Follow-up config for human/client steps */
  followUp?: FollowUpConfig;

  /** Max retries on failure */
  maxRetries?: number;
}

export interface FollowUpConfig {
  /** Intervals in minutes: [1440, 4320] = D+1, D+3 */
  intervals: number[];
  /** Message template with {{key}} interpolation */
  message?: string;
  /** Role to escalate to after all follow-ups */
  escalateTo?: string;
  /** Business hours restriction */
  businessHours?: {
    start: string;  // "09:00"
    end: string;    // "18:00"
    timezone: string; // "America/Sao_Paulo"
  };
}

export interface WaitConfig {
  /** How to reach the client */
  channel: 'chat' | 'email' | 'portal';
  /** TreeFlow slug to spawn (for channel: chat) */
  treeFlowSlug?: string;
  /** Follow-up schedule */
  followUp?: {
    /** Intervals in minutes: [1440, 4320] = D+1, D+3 */
    intervals: number[];
    /** Follow-up message template with {{key}} interpolation */
    message?: string;
  };
}

export interface StepTransition {
  /** JSONLogic condition — first match wins */
  condition?: string;
  /** Target definitionStepId to jump to */
  target: string;
  /** If true, this is the fallback when no condition matches */
  default?: boolean;
}
