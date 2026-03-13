import { LoadedTalkContext, TalkFlowFilledAction, TreeFlowAction } from '../../treeflow/treeflow.types.js';

// ════════════════════════════════════════════════════════════
// Analysis Prompt Builder
// ════════════════════════════════════════════════════════════

export interface AnalysisPrompts {
  systemPrompt: string;
  userPrompt: string;
}

/**
 * Builds the system and user prompts for the TreeFlow AI analyzer.
 * Assembles all context: global instructions, step instructions, actions,
 * current state, objections, and contact data.
 */
export function buildAnalysisPrompt(
  ctx: LoadedTalkContext,
  newMessageContent: string,
): AnalysisPrompts {
  const systemPrompt = buildSystemPrompt(ctx);
  const userPrompt = buildUserPrompt(ctx, newMessageContent);
  return { systemPrompt, userPrompt };
}

function buildSystemPrompt(ctx: LoadedTalkContext): string {
  const parts: string[] = [];

  // ── Role ──
  parts.push(`You are an AI sales/support assistant operating within a structured conversation flow (TreeFlow).
Your job is to analyze incoming customer messages, extract relevant data, detect objections or escape attempts, suggest step transitions, and craft appropriate responses.

You MUST respond with valid JSON matching the required schema. Do not include any text outside the JSON.`);

  // ── Global Instructions ──
  if (ctx.definition.global_instructions) {
    parts.push(`\n## GLOBAL INSTRUCTIONS\n${ctx.definition.global_instructions}`);
  }

  // ── Current Step ──
  parts.push(`\n## CURRENT STEP
- Step ID: ${ctx.currentStep.id}
- Step Name: ${ctx.currentStep.name}
- Step Type: ${ctx.currentStep.type}
- Description: ${ctx.currentStep.description}
- Max messages in step: ${ctx.currentStep.max_messages_in_step}
- Messages so far: ${ctx.talkFlow.state.messages_in_current_step}`);

  // ── Step Instructions ──
  if (ctx.currentStep.instructions) {
    parts.push(`\n## STEP INSTRUCTIONS\n${ctx.currentStep.instructions}`);
  }

  // ── Actions to Collect ──
  if (ctx.currentStep.actions.length > 0) {
    parts.push('\n## ACTIONS TO COLLECT');
    parts.push('The following data points need to be collected in this step:');

    for (const action of ctx.currentStep.actions) {
      const filled = ctx.talkFlow.state.filled_actions[action.id];
      const statusStr = formatActionStatus(action, filled);
      parts.push(`\n- **${action.name}** (id: ${action.id})
  - Type: ${action.type}
  - Required: ${action.required}
  - Extraction hint: ${action.extraction_hint}
  - Status: ${statusStr}${action.validation ? `\n  - Validation: ${JSON.stringify(action.validation)}` : ''}`);
    }
  }

  // ── Available Transitions ──
  if (ctx.currentStep.transitions.length > 0) {
    parts.push('\n## AVAILABLE TRANSITIONS');
    for (const t of ctx.currentStep.transitions) {
      const targetStep = ctx.definition.steps.find((s) => s.id === t.target_step_id);
      parts.push(`- To "${targetStep?.name ?? t.target_step_id}" (id: ${t.target_step_id}): condition=${t.condition.type}, priority=${t.priority}`);
    }
  }

  // ── Objections ──
  if (ctx.objections.length > 0) {
    parts.push('\n## KNOWN OBJECTIONS');
    parts.push('Watch for these objections in the customer message:');
    for (const obj of ctx.objections) {
      parts.push(`\n- **${obj.name}** (id: ${obj.id}, severity: ${obj.severity})
  - Detection hints: ${obj.detectionHints.join(', ')}
  - Rebuttal strategy: ${obj.rebuttalStrategy ?? 'none'}
  - Rebuttal examples: ${obj.rebuttalExamples.length > 0 ? obj.rebuttalExamples.join(' | ') : 'none'}`);
    }
  }

  // ── Contact Context ──
  parts.push(`\n## CONTACT INFORMATION
- Name: ${ctx.contact.name}
- Phone: ${ctx.contact.phone ?? 'unknown'}
- Email: ${ctx.contact.email ?? 'unknown'}
- Funnel Stage: ${ctx.contact.funnelStage ?? 'unknown'}`);

  if (Object.keys(ctx.contact.customAttributes).length > 0) {
    parts.push(`- Custom attributes: ${JSON.stringify(ctx.contact.customAttributes)}`);
  }

  // ── Current State Summary ──
  const filledCount = Object.keys(ctx.talkFlow.state.filled_actions).length;
  const totalActions = ctx.currentStep.actions.length;
  parts.push(`\n## FLOW STATE
- Step history length: ${ctx.talkFlow.state.step_history.length}
- Actions filled: ${filledCount}/${totalActions}
- Escape attempts so far: ${ctx.talkFlow.escapeAttempts}
- Objections encountered: ${ctx.talkFlow.objectionsEncountered.length}`);

  // ── Variables ──
  if (Object.keys(ctx.talkFlow.state.variables).length > 0) {
    parts.push(`- Flow variables: ${JSON.stringify(ctx.talkFlow.state.variables)}`);
  }

  return parts.join('\n');
}

function buildUserPrompt(ctx: LoadedTalkContext, newMessageContent: string): string {
  const parts: string[] = [];

  // ── Recent Message History ──
  if (ctx.recentMessages.length > 0) {
    parts.push('## CONVERSATION HISTORY (most recent messages)');
    for (const msg of ctx.recentMessages) {
      const role = msg.senderType === 'contact' ? 'CUSTOMER' : msg.senderType === 'user' ? 'AGENT' : 'BOT';
      parts.push(`[${role}]: ${msg.content ?? '(media/attachment)'}`);
    }
  }

  // ── New Message ──
  parts.push(`\n## NEW INCOMING MESSAGE\n[CUSTOMER]: ${newMessageContent}`);

  // ── Instructions ──
  parts.push(`\n## YOUR TASK
Analyze the new customer message and produce a structured JSON response with:
1. message_analysis: intent, sentiment, summary
2. extracted_data: any data that maps to the actions to collect
3. objection_detected: whether an objection from the known list was detected
4. escape_detected: whether the customer is trying to leave/end the conversation
5. step_transition: whether we should move to a different step
6. suggested_response: the message to send back to the customer
7. state_diff: any variables to set or actions to confirm

IMPORTANT:
- Only extract data for action IDs that exist in the current step.
- Only suggest transitions to target_step_ids available in the transitions list.
- The suggested response should be natural, conversational, and in the same language the customer is using.
- If the customer provides information matching an action, extract it with a confidence score.
- Use the contact's name naturally when appropriate.`);

  return parts.join('\n');
}

function formatActionStatus(action: TreeFlowAction, filled?: TalkFlowFilledAction): string {
  if (!filled) return 'NOT FILLED';
  return `FILLED (value: ${JSON.stringify(filled.value)}, confidence: ${filled.confidence}, confirmed: ${filled.confirmed})`;
}
