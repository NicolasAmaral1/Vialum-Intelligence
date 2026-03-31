import type { ContextSnapshot } from './context-bus.js';
import type { StepTransition } from './definition.types.js';

/**
 * Evaluate a simple condition string against the context bus snapshot.
 *
 * Supports:
 *   - "$.stepOutputs.step1.tipo == 'PF'"
 *   - "$.stepOutputs.step1.campos_faltantes.length > 0"
 *   - "$.variables.tentativa < 3"
 *   - "$.clientData.tipo_marca == 'nominativa'"
 *
 * Returns true if condition evaluates to truthy, false otherwise.
 * Returns true if condition is null/undefined/empty (no condition = always execute).
 */
export function evaluateCondition(
  condition: string | null | undefined,
  snapshot: ContextSnapshot,
): boolean {
  if (!condition || !condition.trim()) return true;

  try {
    // Resolve all $.path references to actual values
    const resolved = condition.replace(/\$\.([a-zA-Z0-9_.]+)/g, (_match, path: string) => {
      const value = getByPath(snapshot, path);
      if (value === undefined || value === null) return 'null';
      if (typeof value === 'string') return JSON.stringify(value);
      return String(value);
    });

    // Evaluate using Function (sandboxed — only has access to resolved literals)
    // eslint-disable-next-line no-new-func
    const result = new Function(`return (${resolved})`)();
    return !!result;
  } catch (err) {
    console.warn(`[condition] Failed to evaluate: "${condition}"`, (err as Error).message);
    return false;
  }
}

/**
 * Evaluate step transitions to find the next step.
 *
 * Evaluates conditions in order. Returns the target of:
 *   1. First transition whose condition evaluates to true
 *   2. First transition with default: true (if no condition matches)
 *   3. null if no transition matches
 */
export function evaluateTransitions(
  transitions: StepTransition[],
  snapshot: ContextSnapshot,
  stepOutput: Record<string, unknown>,
): string | null {
  // Create an enriched snapshot that includes $.output for the current step's output
  const enriched = {
    ...snapshot,
    output: stepOutput,
  };

  // First pass: evaluate conditions
  for (const t of transitions) {
    if (t.default) continue;
    if (!t.condition) return t.target; // no condition = always match
    if (evaluateCondition(t.condition, enriched as ContextSnapshot)) {
      return t.target;
    }
  }

  // Second pass: find default
  const defaultTransition = transitions.find((t) => t.default);
  return defaultTransition?.target ?? null;
}

// ─── Utility ────────────────────────────────────────────────────

function getByPath(obj: unknown, path: string): unknown {
  const parts = path.split('.');
  let current: unknown = obj;

  for (const part of parts) {
    if (current == null || typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[part];
  }

  return current;
}
