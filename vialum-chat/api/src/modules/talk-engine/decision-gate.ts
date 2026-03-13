import { getPrisma } from '../../config/database.js';
import {
  LoadedTalkContext,
  TreeFlowAIResponse,
  DecisionResult,
} from '../treeflow/treeflow.types.js';
import { StateApplyResult } from './state-applier.js';

// ════════════════════════════════════════════════════════════
// [5] Decision Gate
// ════════════════════════════════════════════════════════════

/**
 * Determines whether to auto-send the AI suggested response or
 * create an AISuggestion for HITL review.
 *
 * Auto-send conditions (ALL must be true):
 * - TreeFlow settings: auto_mode_enabled = true
 * - Response confidence >= confidence_threshold
 * - No escape detected in this message
 * - Objection severity is not "critical"
 *
 * Otherwise → create AISuggestion with status='pending', auto_mode=false
 */
export async function evaluateDecision(
  ctx: LoadedTalkContext,
  aiResponse: TreeFlowAIResponse,
  stateResult: StateApplyResult,
): Promise<DecisionResult> {
  const prisma = getPrisma();

  const { settings } = ctx;
  const { suggested_response, objection_detected, escape_detected } = aiResponse;

  const isCriticalObjection =
    objection_detected.detected && objection_detected.severity === 'critical';

  const shouldAutoSend =
    settings.auto_mode_enabled &&
    suggested_response.confidence >= settings.confidence_threshold &&
    !escape_detected.detected &&
    !isCriticalObjection;

  if (shouldAutoSend) {
    // Auto-send: create the AISuggestion with auto_mode=true and status='sent'
    const suggestion = await prisma.aISuggestion.create({
      data: {
        accountId: ctx.talk.accountId,
        conversationId: ctx.talk.conversationId,
        talkId: ctx.talk.id,
        talkStepId: stateResult.newStepId,
        triggeredBy: 'treeflow',
        content: suggested_response.content,
        status: 'sent',
        confidence: suggested_response.confidence,
        autoMode: true,
        funnelStage: ctx.contact.funnelStage,
        context: {
          reasoning: suggested_response.reasoning,
          step_changed: stateResult.stepChanged,
          new_filled_actions: stateResult.newFilledActions,
          objection_registered: stateResult.objectionRegistered,
        },
        sentAt: new Date(),
      },
    });

    return {
      mode: 'auto',
      suggestionId: suggestion.id,
      messageContent: suggested_response.content,
    };
  }

  // HITL: create pending suggestion for human review
  const suggestion = await prisma.aISuggestion.create({
    data: {
      accountId: ctx.talk.accountId,
      conversationId: ctx.talk.conversationId,
      talkId: ctx.talk.id,
      talkStepId: stateResult.newStepId,
      triggeredBy: 'treeflow',
      content: suggested_response.content,
      status: 'pending',
      confidence: suggested_response.confidence,
      autoMode: false,
      funnelStage: ctx.contact.funnelStage,
      context: {
        reasoning: suggested_response.reasoning,
        step_changed: stateResult.stepChanged,
        new_filled_actions: stateResult.newFilledActions,
        objection_registered: stateResult.objectionRegistered,
        escape_detected: escape_detected.detected,
        critical_objection: isCriticalObjection,
        auto_mode_disabled_reason: !settings.auto_mode_enabled
          ? 'auto_mode_disabled'
          : suggested_response.confidence < settings.confidence_threshold
            ? 'low_confidence'
            : escape_detected.detected
              ? 'escape_detected'
              : 'critical_objection',
      },
    },
  });

  return {
    mode: 'hitl',
    suggestionId: suggestion.id,
    messageContent: suggested_response.content,
  };
}
