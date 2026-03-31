import { validateSchema } from './schema-validator.js';

/**
 * ContextBus — Shared context between workflow steps.
 *
 * Each step reads input from the bus (resolveInput) and writes output to it (writeOutput).
 * The bus is persisted to the workflow.context column after each step.
 * On resume (after human/client pause), it's rehydrated from DB.
 *
 * Data flow:
 *   clientData (immutable, from workflow creation)
 *   stepOutputs[stepId] (accumulated, one per completed step)
 *   variables (mutable cross-step state)
 *   refs (external IDs — contact, conversation, hub, clickup)
 */

export interface ContextSnapshot {
  workflowId: string;
  accountId: string;
  clientData: Record<string, unknown>;
  stepOutputs: Record<string, Record<string, unknown>>;
  variables: Record<string, unknown>;
  refs: {
    contactPhone: string | null;
    conversationId: string | null;
    hubContactId: string | null;
    externalTaskId: string | null;
  };
}

export class ContextBus {
  private data: ContextSnapshot;

  constructor(initial: ContextSnapshot) {
    this.data = structuredClone(initial);
  }

  // ─── Read ─────────────────────────────────────────────────────

  /**
   * Resolve input for a step based on its inputSchema.
   * Properties with $ref are resolved from the bus snapshot.
   * Properties without $ref are passed through as-is.
   *
   * Example inputSchema:
   *   { type: "object", properties: {
   *       marca: { $ref: "$.clientData.marca" },
   *       tipo:  { $ref: "$.stepOutputs.classificar.tipo" },
   *       fixed: { type: "string", default: "hello" }
   *   }}
   *
   * Returns: { marca: "Café Bonito", tipo: "nominativa", fixed: "hello" }
   */
  resolveInput(inputSchema: Record<string, unknown> | null | undefined): Record<string, unknown> {
    if (!inputSchema) return {};

    const properties = inputSchema.properties as Record<string, Record<string, unknown>> | undefined;
    if (!properties) return {};

    const result: Record<string, unknown> = {};

    for (const [key, prop] of Object.entries(properties)) {
      if (prop.$ref && typeof prop.$ref === 'string') {
        result[key] = this.resolveRef(prop.$ref);
      } else if (prop.default !== undefined) {
        result[key] = prop.default;
      }
    }

    return result;
  }

  /**
   * Get the full snapshot (read-only clone).
   */
  getSnapshot(): ContextSnapshot {
    return structuredClone(this.data);
  }

  /**
   * Get a value by dot-notation path (e.g., "clientData.marca" or "stepOutputs.step1.tipo").
   */
  get(path: string): unknown {
    return getByPath(this.data, path);
  }

  // ─── Write ────────────────────────────────────────────────────

  /**
   * Write step output to the bus.
   * Validates against outputSchema if provided.
   */
  writeOutput(
    definitionStepId: string,
    output: Record<string, unknown>,
    outputSchema?: Record<string, unknown> | null,
  ): void {
    if (outputSchema) {
      validateSchema(output, outputSchema);
    }
    this.data.stepOutputs[definitionStepId] = structuredClone(output);
  }

  /**
   * Set a variable (mutable cross-step state).
   */
  setVariable(key: string, value: unknown): void {
    this.data.variables[key] = value;
  }

  /**
   * Update external references.
   */
  setRef(key: keyof ContextSnapshot['refs'], value: string | null): void {
    this.data.refs[key] = value;
  }

  // ─── Prompt Rendering ─────────────────────────────────────────

  /**
   * Render a prompt template by replacing {{key}} placeholders.
   *
   * Resolution order:
   *   1. clientData.key
   *   2. variables.key
   *   3. stepOutputs (flattened: stepOutputs.stepId.field)
   *   4. refs.key
   *
   * Dot notation supported: {{stepOutputs.classificar.tipo}}
   * Missing values replaced with empty string.
   */
  renderPrompt(template: string): string {
    return template.replace(/\{\{([^}]+)\}\}/g, (_match, path: string) => {
      const trimmed = path.trim();

      // Try direct dot-path resolution on entire snapshot
      const value = getByPath(this.data, trimmed);
      if (value != null) return String(value);

      // Try clientData shorthand (e.g., {{marca}} → clientData.marca)
      const clientValue = getByPath(this.data.clientData, trimmed);
      if (clientValue != null) return String(clientValue);

      // Try variables shorthand
      const varValue = getByPath(this.data.variables, trimmed);
      if (varValue != null) return String(varValue);

      return '';
    });
  }

  // ─── Persistence ──────────────────────────────────────────────

  /**
   * Serialize to JSON for DB storage (workflow.context column).
   */
  persist(): Record<string, unknown> {
    return structuredClone(this.data) as unknown as Record<string, unknown>;
  }

  /**
   * Reconstruct from DB.
   */
  static hydrate(json: Record<string, unknown>): ContextBus {
    const data = json as unknown as ContextSnapshot;

    // Ensure all required fields exist (backward compat)
    data.stepOutputs ??= {};
    data.variables ??= {};
    data.clientData ??= {};
    data.refs ??= {
      contactPhone: null,
      conversationId: null,
      hubContactId: null,
      externalTaskId: null,
    };

    return new ContextBus(data);
  }

  /**
   * Create a fresh bus for a new workflow.
   */
  static create(
    workflowId: string,
    accountId: string,
    clientData: Record<string, unknown>,
    refs?: Partial<ContextSnapshot['refs']>,
  ): ContextBus {
    return new ContextBus({
      workflowId,
      accountId,
      clientData: structuredClone(clientData),
      stepOutputs: {},
      variables: {},
      refs: {
        contactPhone: refs?.contactPhone ?? null,
        conversationId: refs?.conversationId ?? null,
        hubContactId: refs?.hubContactId ?? null,
        externalTaskId: refs?.externalTaskId ?? null,
      },
    });
  }

  // ─── Internal ─────────────────────────────────────────────────

  /**
   * Resolve a $ref path like "$.clientData.marca" or "$.stepOutputs.step1.tipo".
   */
  private resolveRef(ref: string): unknown {
    // Strip leading "$." if present
    const path = ref.startsWith('$.') ? ref.slice(2) : ref;
    return getByPath(this.data, path);
  }
}

// ─── Utility ────────────────────────────────────────────────────────

/**
 * Get a value from a nested object by dot-notation path.
 * e.g., getByPath({ a: { b: 1 } }, "a.b") → 1
 */
function getByPath(obj: unknown, path: string): unknown {
  const parts = path.split('.');
  let current: unknown = obj;

  for (const part of parts) {
    if (current == null || typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[part];
  }

  return current;
}
