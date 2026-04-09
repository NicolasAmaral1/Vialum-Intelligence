import yaml from 'js-yaml';
import type { WorkflowDefinitionV2, StageDefinition, TaskDefinition, StepDefinition } from './definition.types.js';

/**
 * Parse a YAML string into a validated WorkflowDefinitionV2.
 * Throws on invalid structure.
 */
export function parseDefinitionYaml(yamlStr: string): WorkflowDefinitionV2 {
  const raw = yaml.load(yamlStr) as Record<string, unknown>;
  if (!raw || typeof raw !== 'object') {
    throw new Error('Definition YAML must be an object');
  }

  // Required top-level fields
  requireString(raw, 'slug', 'definition');
  requireString(raw, 'name', 'definition');

  const def: WorkflowDefinitionV2 = {
    slug: raw.slug as string,
    name: raw.name as string,
    description: raw.description as string | undefined,
    version: (raw.version as number) ?? 1,
    dataSchema: raw.dataSchema as Record<string, unknown> | undefined,
    stages: [],
  };

  // Parse stages
  const rawStages = raw.stages as unknown[];
  if (!Array.isArray(rawStages) || rawStages.length === 0) {
    throw new Error('Definition must have at least one stage');
  }

  def.stages = rawStages.map((s, i) => parseStage(s as Record<string, unknown>, i));

  // Validate all transition targets exist
  const allStepIds = new Set<string>();
  for (const stage of def.stages) {
    for (const task of stage.tasks) {
      for (const step of task.steps) {
        allStepIds.add(step.id);
      }
    }
  }

  for (const stage of def.stages) {
    for (const task of stage.tasks) {
      for (const step of task.steps) {
        if (step.transitions) {
          for (const t of step.transitions) {
            if (!allStepIds.has(t.target)) {
              throw new Error(`Step "${step.id}" has transition to unknown target "${t.target}"`);
            }
          }
        }
      }
    }
  }

  return def;
}

function parseStage(raw: Record<string, unknown>, index: number): StageDefinition {
  requireString(raw, 'id', `stage[${index}]`);
  requireString(raw, 'name', `stage[${index}]`);

  const rawTasks = raw.tasks as unknown[];
  if (!Array.isArray(rawTasks) || rawTasks.length === 0) {
    throw new Error(`Stage "${raw.id}" must have at least one task`);
  }

  return {
    id: raw.id as string,
    name: raw.name as string,
    position: (raw.position as number) ?? index + 1,
    clickupStatus: raw.clickupStatus as string | undefined,
    tasks: rawTasks.map((t, i) => parseTask(t as Record<string, unknown>, i, raw.id as string)),
  };
}

function parseTask(raw: Record<string, unknown>, index: number, stageId: string): TaskDefinition {
  requireString(raw, 'id', `task[${index}] in stage "${stageId}"`);
  requireString(raw, 'name', `task[${index}] in stage "${stageId}"`);

  const rawSteps = raw.steps as unknown[];
  if (!Array.isArray(rawSteps) || rawSteps.length === 0) {
    throw new Error(`Task "${raw.id}" must have at least one step`);
  }

  return {
    id: raw.id as string,
    name: raw.name as string,
    position: (raw.position as number) ?? index + 1,
    steps: rawSteps.map((s, i) => parseStep(s as Record<string, unknown>, i, raw.id as string)),
  };
}

function parseStep(raw: Record<string, unknown>, index: number, taskId: string): StepDefinition {
  const ctx = `step[${index}] in task "${taskId}"`;
  requireString(raw, 'id', ctx);
  requireString(raw, 'name', ctx);
  requireString(raw, 'executor', ctx);

  const executor = raw.executor as string;
  if (!['ai', 'human', 'system', 'client'].includes(executor)) {
    throw new Error(`${ctx}: executor must be ai|human|system|client, got "${executor}"`);
  }

  // Default adapterType based on executor
  const adapterType = (raw.adapterType as string) ?? defaultAdapterType(executor);

  return {
    id: raw.id as string,
    name: raw.name as string,
    position: (raw.position as number) ?? index + 1,
    executor: executor as StepDefinition['executor'],
    adapterType: adapterType as StepDefinition['adapterType'],
    assigneeRole: raw.assigneeRole as string | undefined,
    isGate: raw.isGate as boolean | undefined,
    condition: raw.condition as string | undefined,
    inputSchema: raw.inputSchema as Record<string, unknown> | undefined,
    outputSchema: raw.outputSchema as Record<string, unknown> | undefined,
    promptTemplate: raw.promptTemplate as string | undefined,
    waitConfig: raw.waitConfig as StepDefinition['waitConfig'] | undefined,
    transitions: parseTransitions(raw.transitions as unknown[] | undefined, raw.id as string),
    allowCheckpoints: raw.allowCheckpoints as boolean | undefined,
    onComplete: raw.onComplete as StepDefinition['onComplete'] | undefined,
    timeoutMs: raw.timeoutMs as number | undefined,
    onTimeout: raw.onTimeout as string | undefined,
    onFailure: raw.onFailure as string | undefined,
    followUp: raw.followUp as StepDefinition['followUp'] | undefined,
    maxRetries: raw.maxRetries as number | undefined,
    adapterConfig: raw.adapterConfig as Record<string, unknown> | undefined,
  };
}

function parseTransitions(raw: unknown[] | undefined, stepId: string): StepDefinition['transitions'] {
  if (!raw || !Array.isArray(raw)) return undefined;

  return raw.map((t, i) => {
    const tr = t as Record<string, unknown>;
    if (!tr.target || typeof tr.target !== 'string') {
      throw new Error(`Step "${stepId}" transition[${i}] must have a "target" string`);
    }
    return {
      condition: tr.condition as string | undefined,
      target: tr.target as string,
      default: tr.default as boolean | undefined,
    };
  });
}

function defaultAdapterType(executor: string): string {
  switch (executor) {
    case 'ai': return 'squad';
    case 'human': return 'human';
    case 'system': return 'script';
    case 'client': return 'wait';
    default: return 'squad';
  }
}

function requireString(obj: Record<string, unknown>, field: string, context: string): void {
  if (!obj[field] || typeof obj[field] !== 'string') {
    throw new Error(`${context}: "${field}" is required and must be a string`);
  }
}
