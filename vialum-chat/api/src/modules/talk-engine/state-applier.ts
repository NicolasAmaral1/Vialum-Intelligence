import { getPrisma } from '../../config/database.js';
import {
  LoadedTalkContext,
  TreeFlowAIResponse,
  TalkFlowState,
  TalkFlowFilledAction,
  TransitionCondition,
} from '../treeflow/treeflow.types.js';

// ════════════════════════════════════════════════════════════
// [4] State Applier
// ════════════════════════════════════════════════════════════

export interface StateApplyResult {
  stateUpdated: boolean;
  stepChanged: boolean;
  previousStepId: string;
  newStepId: string;
  newFilledActions: string[];
  objectionRegistered: boolean;
  escapeIncremented: boolean;
  transitionReason: string | null;
}

/**
 * Applies the AI response to the TalkFlow state:
 * - Updates filled_actions with extracted_data
 * - Registers objections if detected
 * - Increments escape_attempts if escape detected
 * - Evaluates transition conditions on the current step
 * - If transition matches: updates current_step_id, adds to step_history
 * - Persists TalkFlow to DB
 * - Creates talk_events for each change
 */
export async function applyStateDiff(
  ctx: LoadedTalkContext,
  aiResponse: TreeFlowAIResponse,
  sourceMessageId: string,
): Promise<StateApplyResult> {
  const prisma = getPrisma();
  const now = new Date().toISOString();

  const state: TalkFlowState = JSON.parse(JSON.stringify(ctx.talkFlow.state));
  const events: Array<{ eventType: string; data: Record<string, unknown> }> = [];
  const newFilledActions: string[] = [];

  let objectionRegistered = false;
  let escapeIncremented = false;
  let objectionsEncountered = [...ctx.talkFlow.objectionsEncountered];
  let escapeAttempts = ctx.talkFlow.escapeAttempts;

  // ── Apply extracted_data to filled_actions ──
  for (const [_key, extraction] of Object.entries(aiResponse.extracted_data)) {
    const actionId = extraction.action_id;
    const existing = state.filled_actions[actionId];

    // Only overwrite if new confidence is higher or action wasn't filled
    if (!existing || extraction.confidence > existing.confidence) {
      const filledAction: TalkFlowFilledAction = {
        value: extraction.value,
        filled_at: now,
        source_message_id: sourceMessageId,
        confidence: extraction.confidence,
        confirmed: extraction.confidence >= 0.95,
      };

      state.filled_actions[actionId] = filledAction;
      newFilledActions.push(actionId);

      events.push({
        eventType: 'action_filled',
        data: {
          action_id: actionId,
          value: extraction.value,
          confidence: extraction.confidence,
          source_message_id: sourceMessageId,
        },
      });
    }
  }

  // ── Register objection if detected ──
  if (aiResponse.objection_detected.detected && aiResponse.objection_detected.objection_id) {
    const objId = aiResponse.objection_detected.objection_id;
    if (!objectionsEncountered.includes(objId)) {
      objectionsEncountered.push(objId);
    }
    objectionRegistered = true;

    events.push({
      eventType: 'objection_detected',
      data: {
        objection_id: objId,
        severity: aiResponse.objection_detected.severity,
        details: aiResponse.objection_detected.details,
      },
    });
  }

  // ── Increment escape attempts ──
  if (aiResponse.escape_detected.detected) {
    escapeAttempts += 1;
    escapeIncremented = true;

    events.push({
      eventType: 'escape_detected',
      data: {
        attempt_number: escapeAttempts,
        reason: aiResponse.escape_detected.reason,
      },
    });
  }

  // ── Increment messages_in_current_step ──
  state.messages_in_current_step += 1;

  // ── Apply variables from state_diff ──
  if (aiResponse.state_diff.variables_to_set) {
    for (const [key, value] of Object.entries(aiResponse.state_diff.variables_to_set)) {
      state.variables[key] = value;
    }
  }

  // ── Confirm actions from state_diff ──
  if (aiResponse.state_diff.actions_to_confirm) {
    for (const actionId of aiResponse.state_diff.actions_to_confirm) {
      if (state.filled_actions[actionId]) {
        state.filled_actions[actionId].confirmed = true;
      }
    }
  }

  // ── Evaluate Transitions ──
  let stepChanged = false;
  let newStepId = ctx.talkFlow.currentStepId;
  let transitionReason: string | null = null;

  // Check AI-suggested transition first
  if (aiResponse.step_transition.should_transition && aiResponse.step_transition.target_step_id) {
    stepChanged = true;
    newStepId = aiResponse.step_transition.target_step_id;
    transitionReason = aiResponse.step_transition.reason ?? 'ai_suggested';
  }

  // Then check rule-based transitions (sorted by priority)
  if (!stepChanged) {
    const sortedTransitions = [...ctx.currentStep.transitions].sort(
      (a, b) => b.priority - a.priority,
    );

    for (const transition of sortedTransitions) {
      if (evaluateCondition(transition.condition, state, ctx, aiResponse)) {
        stepChanged = true;
        newStepId = transition.target_step_id;
        transitionReason = `condition:${transition.condition.type}`;
        break;
      }
    }
  }

  // ── Apply step change ──
  if (stepChanged) {
    // Close current step entry
    state.step_history = state.step_history.map((entry) => {
      if (entry.step_id === ctx.talkFlow.currentStepId && !entry.exited_at) {
        return { ...entry, exited_at: now, exit_reason: 'transition' as const };
      }
      return entry;
    });

    // Add new step entry
    state.step_history.push({
      step_id: newStepId,
      entered_at: now,
      exited_at: null,
      exit_reason: null,
    });

    // Reset messages counter for new step
    state.messages_in_current_step = 0;

    events.push({
      eventType: 'step_changed',
      data: {
        from_step_id: ctx.talkFlow.currentStepId,
        to_step_id: newStepId,
        reason: transitionReason,
      },
    });
  }

  // ── Persist to DB ──
  await prisma.$transaction(async (tx) => {
    // Update TalkFlow
    await tx.talkFlow.update({
      where: { id: ctx.talkFlow.id },
      data: {
        currentStepId: newStepId,
        state: state as any,
        objectionsEncountered: objectionsEncountered as any,
        escapeAttempts,
        confidenceHistory: [
          ...((ctx.talkFlow.confidenceHistory as number[]) || []),
          aiResponse.suggested_response.confidence,
        ] as any,
      },
    });

    // Update Talk last_activity_at
    await tx.talk.update({
      where: { id: ctx.talk.id },
      data: { lastActivityAt: new Date() },
    });

    // Create events
    for (const event of events) {
      await tx.talkEvent.create({
        data: {
          talkId: ctx.talk.id,
          eventType: event.eventType,
          data: event.data as any,
          actorType: 'ai',
        },
      });
    }
  });

  return {
    stateUpdated: newFilledActions.length > 0 || stepChanged || objectionRegistered || escapeIncremented,
    stepChanged,
    previousStepId: ctx.talkFlow.currentStepId,
    newStepId,
    newFilledActions,
    objectionRegistered,
    escapeIncremented,
    transitionReason,
  };
}

// ── Transition Condition Evaluator ──

function evaluateCondition(
  condition: TransitionCondition,
  state: TalkFlowState,
  ctx: LoadedTalkContext,
  aiResponse: TreeFlowAIResponse,
): boolean {
  switch (condition.type) {
    case 'all_actions_filled': {
      const requiredActions = ctx.currentStep.actions.filter((a) => a.required);
      return requiredActions.every(
        (a) => state.filled_actions[a.id] && state.filled_actions[a.id].confirmed,
      );
    }

    case 'specific_actions_filled': {
      const actionIds = (condition.params.action_ids as string[]) ?? [];
      return actionIds.every(
        (id) => state.filled_actions[id] && state.filled_actions[id].confirmed,
      );
    }

    case 'message_count_exceeded': {
      const maxMessages = (condition.params.max_messages as number) ?? ctx.currentStep.max_messages_in_step;
      return state.messages_in_current_step >= maxMessages;
    }

    case 'objection_detected': {
      return aiResponse.objection_detected.detected;
    }

    case 'escape_detected': {
      return aiResponse.escape_detected.detected;
    }

    case 'always': {
      return true;
    }

    case 'manual':
    case 'custom':
    default:
      return false;
  }
}
