import OpenAI from 'openai';
import { getPrisma } from '../../config/database.js';
import { getEnv } from '../../config/env.js';
import { EngineContext, RoutingResult } from '../treeflow/treeflow.types.js';
import { buildRoutingPrompt } from './prompts/routing.prompt.js';
import { ROUTING_RESPONSE_SCHEMA } from './prompts/schemas.js';

// ════════════════════════════════════════════════════════════
// [1] Talk Router
// ════════════════════════════════════════════════════════════

/**
 * Routes an incoming message to the correct Talk.
 *
 * - 0 active talks → return null (no TreeFlow active)
 * - 1 active talk  → direct route (confidence 1.0)
 * - 2+ active talks → AI router decides which talk gets the message
 */
export async function routeMessage(context: EngineContext): Promise<RoutingResult> {
  const prisma = getPrisma();

  // Find all active talks for this conversation
  const activeTalks = await prisma.talk.findMany({
    where: {
      conversationId: context.conversationId,
      accountId: context.accountId,
      status: 'active',
    },
    include: {
      treeFlow: { select: { id: true, name: true, slug: true, description: true } },
      talkFlow: { select: { currentStepId: true } },
      treeFlowVersion: { select: { definition: true } },
    },
    orderBy: { priority: 'desc' },
  });

  // ── 0 active talks ──
  if (activeTalks.length === 0) {
    return { talkId: null, confidence: 0, routedBy: 'system' };
  }

  // ── 1 active talk ──
  if (activeTalks.length === 1) {
    return {
      talkId: activeTalks[0].id,
      confidence: 1.0,
      routedBy: 'direct',
    };
  }

  // ── 2+ active talks → AI routing ──
  const env = getEnv();
  const openai = new OpenAI({ apiKey: env.OPENAI_API_KEY });

  const talkSummaries = activeTalks.map((talk) => {
    const def = talk.treeFlowVersion.definition as any;
    const currentStep = def?.steps?.find((s: any) => s.id === talk.talkFlow?.currentStepId);

    return {
      talk_id: talk.id,
      treeflow_name: talk.treeFlow.name,
      treeflow_description: talk.treeFlow.description,
      current_step_name: currentStep?.name ?? 'unknown',
      current_step_description: currentStep?.description ?? '',
    };
  });

  const { systemPrompt, userPrompt } = buildRoutingPrompt(talkSummaries, context.messageContent);

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'routing_response',
          strict: true,
          schema: ROUTING_RESPONSE_SCHEMA,
        },
      },
      temperature: 0.1,
      max_tokens: 256,
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      // Fallback to highest priority talk
      return {
        talkId: activeTalks[0].id,
        confidence: 0.5,
        routedBy: 'system',
      };
    }

    const parsed = JSON.parse(content) as {
      talk_id: string;
      confidence: number;
      reasoning: string;
    };

    // Validate the returned talk_id exists
    const validTalk = activeTalks.find((t) => t.id === parsed.talk_id);
    if (!validTalk) {
      return {
        talkId: activeTalks[0].id,
        confidence: 0.5,
        routedBy: 'system',
      };
    }

    return {
      talkId: parsed.talk_id,
      confidence: parsed.confidence,
      routedBy: 'ai',
    };
  } catch (error) {
    // On AI failure, route to highest priority talk
    console.error('[TalkRouter] AI routing failed, falling back to priority:', error);
    return {
      talkId: activeTalks[0].id,
      confidence: 0.5,
      routedBy: 'system',
    };
  }
}
