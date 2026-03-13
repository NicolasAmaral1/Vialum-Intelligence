import OpenAI from 'openai';
import { getEnv } from '../../config/env.js';
import { LoadedTalkContext, TreeFlowAIResponse } from '../treeflow/treeflow.types.js';
import { buildAnalysisPrompt } from './prompts/analysis.prompt.js';
import { TREEFLOW_AI_RESPONSE_SCHEMA } from './prompts/schemas.js';

// ════════════════════════════════════════════════════════════
// [3] AI Analyzer
// ════════════════════════════════════════════════════════════

/**
 * Builds the analysis prompt from the loaded context, calls OpenAI
 * with structured output, and returns a parsed TreeFlowAIResponse.
 */
export async function analyzeMessage(
  ctx: LoadedTalkContext,
  newMessageContent: string,
): Promise<TreeFlowAIResponse> {
  const env = getEnv();
  const openai = new OpenAI({ apiKey: env.OPENAI_API_KEY });

  const { systemPrompt, userPrompt } = buildAnalysisPrompt(ctx, newMessageContent);

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    response_format: {
      type: 'json_schema',
      json_schema: {
        name: 'treeflow_ai_response',
        strict: true,
        schema: TREEFLOW_AI_RESPONSE_SCHEMA,
      },
    },
    temperature: 0.3,
    max_tokens: 2048,
  });

  const content = completion.choices[0]?.message?.content;
  if (!content) {
    throw new Error('[Analyzer] OpenAI returned empty response');
  }

  const parsed = JSON.parse(content) as TreeFlowAIResponse;
  return validateAIResponse(parsed, ctx);
}

/**
 * Validates and sanitizes the AI response to ensure consistency.
 */
function validateAIResponse(
  response: TreeFlowAIResponse,
  ctx: LoadedTalkContext,
): TreeFlowAIResponse {
  // Validate extracted_data action IDs exist in current step
  const validActionIds = new Set(ctx.currentStep.actions.map((a) => a.id));
  const cleanedExtracted: typeof response.extracted_data = {};

  for (const [key, extraction] of Object.entries(response.extracted_data)) {
    if (validActionIds.has(extraction.action_id)) {
      cleanedExtracted[key] = {
        ...extraction,
        confidence: Math.min(1, Math.max(0, extraction.confidence)),
      };
    }
  }

  // Validate step transition target exists in definition
  if (response.step_transition.should_transition && response.step_transition.target_step_id) {
    const targetExists = ctx.definition.steps.some(
      (s) => s.id === response.step_transition.target_step_id,
    );
    if (!targetExists) {
      response.step_transition = {
        should_transition: false,
        target_step_id: null,
        reason: 'Target step not found in definition',
      };
    }
  }

  // Clamp confidence
  response.suggested_response.confidence = Math.min(
    1,
    Math.max(0, response.suggested_response.confidence),
  );

  return {
    ...response,
    extracted_data: cleanedExtracted,
  };
}
