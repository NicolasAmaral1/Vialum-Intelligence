// ════════════════════════════════════════════════════════════
// JSON Schemas for OpenAI Structured Output
// ════════════════════════════════════════════════════════════

/**
 * Schema for the main TreeFlow AI analysis response.
 * Used with OpenAI's `response_format.json_schema`.
 */
export const TREEFLOW_AI_RESPONSE_SCHEMA = {
  type: 'object' as const,
  properties: {
    message_analysis: {
      type: 'object' as const,
      properties: {
        intent: {
          type: 'string' as const,
          description: 'The detected intent of the user message (e.g., "provide_info", "ask_question", "express_interest", "decline", "greeting")',
        },
        sentiment: {
          type: 'string' as const,
          enum: ['positive', 'neutral', 'negative'],
          description: 'Overall sentiment of the message',
        },
        summary: {
          type: 'string' as const,
          description: 'Brief summary of what the user said',
        },
      },
      required: ['intent', 'sentiment', 'summary'] as const,
      additionalProperties: false,
    },
    extracted_data: {
      type: 'object' as const,
      description: 'Data extracted from the message, keyed by a descriptive label. Each entry maps to an action_id in the current step.',
      additionalProperties: {
        type: 'object' as const,
        properties: {
          value: {
            description: 'The extracted value (string, number, boolean, etc.)',
          },
          confidence: {
            type: 'number' as const,
            description: 'Confidence score 0.0-1.0 for this extraction',
          },
          action_id: {
            type: 'string' as const,
            description: 'The ID of the action this data fills',
          },
        },
        required: ['value', 'confidence', 'action_id'] as const,
        additionalProperties: false,
      },
    },
    objection_detected: {
      type: 'object' as const,
      properties: {
        detected: {
          type: 'boolean' as const,
          description: 'Whether an objection was detected in the message',
        },
        objection_id: {
          type: ['string', 'null'] as const,
          description: 'The ID of the matched objection from the provided list, or null',
        },
        severity: {
          type: ['string', 'null'] as const,
          enum: ['low', 'medium', 'high', 'critical', null],
          description: 'Severity level of the objection',
        },
        details: {
          type: ['string', 'null'] as const,
          description: 'Additional details about the objection',
        },
      },
      required: ['detected', 'objection_id', 'severity', 'details'] as const,
      additionalProperties: false,
    },
    escape_detected: {
      type: 'object' as const,
      properties: {
        detected: {
          type: 'boolean' as const,
          description: 'Whether the contact is trying to end/escape the conversation',
        },
        reason: {
          type: ['string', 'null'] as const,
          description: 'Why the escape was detected',
        },
      },
      required: ['detected', 'reason'] as const,
      additionalProperties: false,
    },
    step_transition: {
      type: 'object' as const,
      properties: {
        should_transition: {
          type: 'boolean' as const,
          description: 'Whether the conversation should move to a different step',
        },
        target_step_id: {
          type: ['string', 'null'] as const,
          description: 'The step ID to transition to, from the available transitions',
        },
        reason: {
          type: ['string', 'null'] as const,
          description: 'Reason for the transition',
        },
      },
      required: ['should_transition', 'target_step_id', 'reason'] as const,
      additionalProperties: false,
    },
    suggested_response: {
      type: 'object' as const,
      properties: {
        content: {
          type: 'string' as const,
          description: 'The suggested response message to send to the contact',
        },
        confidence: {
          type: 'number' as const,
          description: 'Confidence score 0.0-1.0 that this response is appropriate',
        },
        reasoning: {
          type: 'string' as const,
          description: 'Internal reasoning for why this response was chosen',
        },
      },
      required: ['content', 'confidence', 'reasoning'] as const,
      additionalProperties: false,
    },
    state_diff: {
      type: 'object' as const,
      properties: {
        variables_to_set: {
          type: 'object' as const,
          description: 'Key-value pairs to store as flow variables',
          additionalProperties: true,
        },
        actions_to_confirm: {
          type: 'array' as const,
          items: { type: 'string' as const },
          description: 'Action IDs that should be marked as confirmed',
        },
      },
      required: ['variables_to_set', 'actions_to_confirm'] as const,
      additionalProperties: false,
    },
  },
  required: [
    'message_analysis',
    'extracted_data',
    'objection_detected',
    'escape_detected',
    'step_transition',
    'suggested_response',
    'state_diff',
  ] as const,
  additionalProperties: false,
};

/**
 * Schema for the routing response when multiple talks are active.
 */
export const ROUTING_RESPONSE_SCHEMA = {
  type: 'object' as const,
  properties: {
    talk_id: {
      type: 'string' as const,
      description: 'The ID of the talk this message should be routed to',
    },
    confidence: {
      type: 'number' as const,
      description: 'Confidence score 0.0-1.0 for this routing decision',
    },
    reasoning: {
      type: 'string' as const,
      description: 'Brief explanation of why this talk was chosen',
    },
  },
  required: ['talk_id', 'confidence', 'reasoning'] as const,
  additionalProperties: false,
};
