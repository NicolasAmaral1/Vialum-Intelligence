// ════════════════════════════════════════════════════════════
// Routing Prompt Builder
// ════════════════════════════════════════════════════════════

export interface TalkSummary {
  talk_id: string;
  treeflow_name: string;
  treeflow_description: string | null;
  current_step_name: string;
  current_step_description: string;
}

export interface RoutingPrompts {
  systemPrompt: string;
  userPrompt: string;
}

/**
 * Builds the system and user prompts for routing a message
 * between multiple active talks on the same conversation.
 */
export function buildRoutingPrompt(
  talks: TalkSummary[],
  messageContent: string,
): RoutingPrompts {
  const systemPrompt = `You are a message router for a multi-flow conversation system.
A customer has multiple active conversation flows running simultaneously.
Your job is to determine which flow the incoming message is most relevant to.

Analyze the message content and match it to the most appropriate flow based on:
1. The flow's name and description
2. The current step the flow is on
3. The topic/intent of the incoming message

You MUST respond with valid JSON matching the required schema.
Choose the talk_id that best matches the message content.
Set confidence to a value between 0.0 and 1.0 reflecting how certain you are.`;

  const talkDescriptions = talks
    .map((t, i) => {
      return `### Flow ${i + 1}
- Talk ID: ${t.talk_id}
- Flow Name: ${t.treeflow_name}
- Flow Description: ${t.treeflow_description ?? 'No description'}
- Current Step: ${t.current_step_name}
- Step Description: ${t.current_step_description}`;
    })
    .join('\n\n');

  const userPrompt = `## ACTIVE FLOWS

${talkDescriptions}

## INCOMING MESSAGE
[CUSTOMER]: ${messageContent}

## YOUR TASK
Determine which flow this message belongs to. Return the talk_id, confidence score, and brief reasoning.`;

  return { systemPrompt, userPrompt };
}
