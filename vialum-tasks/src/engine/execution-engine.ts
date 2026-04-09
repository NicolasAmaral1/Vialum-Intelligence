import { getPrisma } from '../config/database.js';
import { broadcastToAccount, broadcastToWorkflow } from '../plugins/websocket.js';
import { getAdapter } from '../adapters/adapter.registry.js';
import { isSessionAware } from '../adapters/adapter.interface.js';
import { ContextBus } from './context-bus.js';
import { parseDefinitionYaml } from './definition-parser.js';
import { evaluateCondition, evaluateTransitions } from './condition-evaluator.js';
import { tryValidateSchema } from './schema-validator.js';
import type {
  SessionHandle,
  LogCallback,
  TranscriptEntry,
  SessionAwareAdapter,
} from '../adapters/adapter.interface.js';
import { Prisma } from '@prisma/client';

type JsonInput = Prisma.InputJsonValue;

/**
 * Active session handles — keyed by `${taskId}:${adapterType}`.
 * FIX #1: Session per (task, adapterType), not per task alone.
 */
const sessionHandles = new Map<string, SessionHandle>();

function sessionKey(taskId: string, adapterType: string): string {
  return `${taskId}:${adapterType}`;
}

// ═══════════════════════════════════════════════════════════
// CREATE WORKFLOW
// ═══════════════════════════════════════════════════════════

export interface CreateWorkflowOpts {
  definitionId: string;
  accountId: string;
  clientData: Record<string, unknown>;
  contactPhone?: string;
  conversationId?: string;
  hubContactId?: string;
  idempotencyKey?: string;
}

export async function createWorkflow(opts: CreateWorkflowOpts) {
  const prisma = getPrisma();

  const definition = await prisma.workflowDefinition.findUnique({
    where: { id: opts.definitionId },
  });
  if (!definition) throw new Error(`Definition ${opts.definitionId} not found`);
  if (definition.definitionFormat !== 'v2' || !definition.definitionYaml) {
    throw new Error('Definition is not v2 format');
  }
  if (definition.accountId !== opts.accountId) {
    throw new Error('Definition does not belong to this account');
  }

  const parsed = parseDefinitionYaml(definition.definitionYaml);

  // Validate clientData against dataSchema
  if (parsed.dataSchema) {
    const { validateSchema } = await import('./schema-validator.js');
    validateSchema(opts.clientData, parsed.dataSchema);
  }

  // FIX #8: Check for active workflow for same contact
  if (opts.contactPhone) {
    const activeForContact = await prisma.workflow.findFirst({
      where: {
        accountId: opts.accountId,
        contactPhone: opts.contactPhone,
        status: { in: ['running', 'idle'] },
        deletedAt: null,
      },
    });
    if (activeForContact) {
      throw new Error(`Active workflow already exists for contact ${opts.contactPhone}: ${activeForContact.id}`);
    }
  }

  const bus = ContextBus.create(
    '',
    opts.accountId,
    opts.clientData,
    {
      contactPhone: opts.contactPhone ?? null,
      conversationId: opts.conversationId ?? null,
      hubContactId: opts.hubContactId ?? null,
    },
  );

  const firstStage = parsed.stages[0];

  const workflow = await prisma.$transaction(async (tx) => {
    const wf = await tx.workflow.create({
      data: {
        accountId: opts.accountId,
        definitionId: opts.definitionId,
        stage: firstStage.id,
        status: 'idle',
        clientData: opts.clientData as JsonInput,
        context: bus.persist() as JsonInput,
        contactPhone: opts.contactPhone,
        conversationId: opts.conversationId,
        hubContactId: opts.hubContactId,
        idempotencyKey: opts.idempotencyKey,
        definitionVersion: parsed.version,
      },
    });

    for (const stageDef of parsed.stages) {
      const stage = await tx.workflowStage.create({
        data: {
          accountId: opts.accountId,
          workflowId: wf.id,
          definitionStageId: stageDef.id,
          name: stageDef.name,
          position: stageDef.position,
        },
      });

      for (const taskDef of stageDef.tasks) {
        const task = await tx.workflowTask.create({
          data: {
            accountId: opts.accountId,
            workflowId: wf.id,
            stageId: stage.id,
            definitionTaskId: taskDef.id,
            name: taskDef.name,
            position: taskDef.position,
          },
        });

        for (const stepDef of taskDef.steps) {
          await tx.workflowStep.create({
            data: {
              accountId: opts.accountId,
              workflowId: wf.id,
              taskId: task.id,
              definitionStepId: stepDef.id,
              name: stepDef.name,
              position: stepDef.position,
              executor: stepDef.executor,
              adapterType: stepDef.adapterType,
              assigneeRole: stepDef.assigneeRole,
              isGate: stepDef.isGate ?? false,
              condition: stepDef.condition,
              inputSchema: (stepDef.inputSchema ?? undefined) as JsonInput | undefined,
              outputSchema: (stepDef.outputSchema ?? undefined) as JsonInput | undefined,
              promptTemplate: stepDef.promptTemplate,
              waitConfig: (stepDef.waitConfig as unknown as JsonInput) ?? undefined,
              transitions: (stepDef.transitions as unknown as JsonInput) ?? undefined,
              allowCheckpoints: stepDef.allowCheckpoints ?? false,
              onComplete: (stepDef.onComplete as unknown as JsonInput) ?? undefined,
              timeoutMs: stepDef.timeoutMs,
              onTimeout: stepDef.onTimeout,
              onFailure: stepDef.onFailure,
              followUp: (stepDef.followUp as unknown as JsonInput) ?? undefined,
              maxRetries: stepDef.maxRetries ?? 3,
            },
          });
        }
      }
    }

    return wf;
  });

  broadcastToAccount(opts.accountId, 'workflow:created', {
    workflowId: workflow.id,
    definitionSlug: parsed.slug,
  });

  console.log(`[engine] Workflow created: ${workflow.id} (${parsed.slug})`);
  return workflow;
}

// ═══════════════════════════════════════════════════════════
// START WORKFLOW
// ═══════════════════════════════════════════════════════════

export async function startWorkflow(workflowId: string): Promise<void> {
  const prisma = getPrisma();

  await prisma.workflow.update({
    where: { id: workflowId },
    data: { status: 'running', startedAt: new Date(), lastActivityAt: new Date() },
  });

  const firstStep = await prisma.workflowStep.findFirst({
    where: { workflowId, status: 'pending' },
    orderBy: [{ position: 'asc' }],
    include: { task: { include: { stage: true } } },
  });

  if (!firstStep) {
    await prisma.workflow.update({
      where: { id: workflowId },
      data: { status: 'completed', completedAt: new Date() },
    });
    return;
  }

  await prisma.workflowStage.update({
    where: { id: firstStep.task.stageId },
    data: { status: 'active', startedAt: new Date() },
  });
  await prisma.workflowTask.update({
    where: { id: firstStep.taskId },
    data: { status: 'active', startedAt: new Date() },
  });

  broadcastToWorkflow(workflowId, 'workflow:updated', { workflowId, status: 'running' });

  await runStep(workflowId, firstStep.id);
}

// ═══════════════════════════════════════════════════════════
// RUN STEP — main dispatch
// ═══════════════════════════════════════════════════════════

async function runStep(workflowId: string, stepId: string): Promise<void> {
  const prisma = getPrisma();

  const step = await prisma.workflowStep.findUnique({
    where: { id: stepId },
    include: { task: { include: { stage: true } } },
  });
  if (!step) throw new Error(`Step ${stepId} not found`);

  const workflow = await prisma.workflow.findUnique({ where: { id: workflowId } });
  if (!workflow) throw new Error(`Workflow ${workflowId} not found`);

  const bus = ContextBus.hydrate(workflow.context as Record<string, unknown>);

  // Check condition — skip if false
  if (step.condition) {
    const shouldRun = evaluateCondition(step.condition, bus.getSnapshot());
    if (!shouldRun) {
      await prisma.workflowStep.update({
        where: { id: stepId },
        data: { status: 'skipped', completedAt: new Date() },
      });
      broadcastToWorkflow(workflowId, 'step:skipped', { workflowId, stepId, name: step.name });
      await advanceToNext(workflowId, step, bus);
      return;
    }
  }

  // Update step + workflow position
  await prisma.workflowStep.update({
    where: { id: stepId },
    data: { status: 'running', startedAt: new Date() },
  });
  await prisma.workflow.update({
    where: { id: workflowId },
    data: {
      currentStageId: step.task.stageId,
      currentStepId: stepId,
      lastActivityAt: new Date(),
    },
  });

  broadcastToWorkflow(workflowId, 'step:started', {
    workflowId, stepId, name: step.name,
    executor: step.executor, adapterType: step.adapterType,
  });

  try {
    switch (step.executor) {
      case 'ai':
        await runAiStep(workflowId, step, bus);
        break;
      case 'human':
        await runHumanStep(workflowId, step, bus);
        break;
      case 'system':
        await runSystemStep(workflowId, step, bus);
        break;
      case 'client':
        await runClientStep(workflowId, step, bus);
        break;
      default:
        throw new Error(`Unknown executor: ${step.executor}`);
    }
  } catch (err) {
    // FIX #5 partial: catch unexpected errors so workflow doesn't hang
    console.error(`[engine] Unexpected error in step ${stepId}:`, err);
    await handleStepFailure(workflowId, step, bus, (err as Error).message);
  }
}

// ─── AI Step ────────────────────────────────────────────────

async function runAiStep(workflowId: string, step: StepRow, bus: ContextBus): Promise<void> {
  const prisma = getPrisma();
  const adapter = getAdapter(step.adapterType);

  const input = bus.resolveInput(step.inputSchema as Record<string, unknown> | null);
  const prompt = step.promptTemplate ? bus.renderPrompt(step.promptTemplate) : '';

  const onLog: LogCallback = (entry: TranscriptEntry) => {
    const payload = { workflowId, stepId: step.id, entry };
    broadcastToWorkflow(workflowId, 'step:transcript', payload);
    broadcastToAccount(step.accountId, 'step:transcript', payload);

    // Persist significant entries as WorkflowEvent for debug/audit
    const significantKinds = ['message', 'tool_call', 'error', 'cost', 'init'];
    if (significantKinds.includes(entry.kind)) {
      const eventTypeMap: Record<string, string> = {
        message: 'assistant.message',
        tool_call: 'tool.call',
        error: 'session.error',
        cost: 'session.cost',
        init: 'session.start',
      };
      prisma.workflowEvent.create({
        data: {
          workflowId,
          eventType: eventTypeMap[entry.kind] || entry.kind,
          toolName: 'name' in entry ? (entry as Record<string, unknown>).name as string : null,
          payload: entry as JsonInput,
        },
      }).catch(() => {}); // fire-and-forget, don't block execution
    }
  };

  const execution = await prisma.stepExecution.create({
    data: {
      accountId: step.accountId,
      workflowId,
      stepId: step.id,
      adapterType: step.adapterType,
      inputContext: input as JsonInput,
    },
  });

  let result;
  const startTime = Date.now();
  const sKey = sessionKey(step.taskId, step.adapterType);

  if (isSessionAware(adapter)) {
    // FIX #1: Session keyed by (taskId, adapterType)
    let handle = sessionHandles.get(sKey);

    if (!handle) {
      handle = await (adapter as SessionAwareAdapter).startSession({
        workflowId, taskId: step.taskId,
        accountId: step.accountId, adapterConfig: {}, cwd: '',
      });
      sessionHandles.set(sKey, handle);
    } else if (!handle.pid && handle.adapterSessionId) {
      // Session paused with valid adapterSessionId — resume
      handle = await (adapter as SessionAwareAdapter).resumeSession(handle, {
        workflowId, taskId: step.taskId,
        accountId: step.accountId, adapterConfig: {}, cwd: '',
      });
      sessionHandles.set(sKey, handle);
    } else if (!handle.pid) {
      // Session exists but no adapterSessionId (failed before init) — start fresh
      sessionHandles.delete(sKey);
      handle = await (adapter as SessionAwareAdapter).startSession({
        workflowId, taskId: step.taskId,
        accountId: step.accountId, adapterConfig: {}, cwd: '',
      });
      sessionHandles.set(sKey, handle);
    }

    // Build prompt with catch-up summary for resumed sessions
    const fullPrompt = handle.adapterSessionId ? buildResumePrompt(prompt, step, bus) : prompt;

    result = await (adapter as SessionAwareAdapter).executeStep(
      handle,
      { stepId: step.id, definitionStepId: step.definitionStepId, prompt: fullPrompt, input, outputSchema: step.outputSchema as Record<string, unknown> | undefined },
      onLog,
    );
  } else {
    const controller = new AbortController();
    result = await adapter.execute({
      executionId: execution.id, workflowId, stepId: step.id,
      accountId: step.accountId, adapterConfig: {}, input, prompt,
      outputSchema: step.outputSchema as Record<string, unknown> | undefined,
      onLog, abortSignal: controller.signal,
    });
  }

  const durationMs = Date.now() - startTime;

  // FIX #4: Check for dynamic checkpoint
  if (step.allowCheckpoints && result.success && result.output._checkpoint) {
    await handleCheckpoint(workflowId, step, bus, result, execution.id);
    return;
  }

  // Update execution
  await prisma.stepExecution.update({
    where: { id: execution.id },
    data: {
      status: result.success ? 'completed' : 'failed',
      outputContext: result.output as JsonInput,
      errorMessage: result.error, durationMs,
      inputTokens: result.usage?.inputTokens,
      outputTokens: result.usage?.outputTokens,
      costUsd: result.usage?.costUsd,
      modelId: result.usage?.modelId,
      completedAt: new Date(),
    },
  });

  if (!result.success) {
    await handleStepFailure(workflowId, step, bus, result.error ?? 'Unknown error');
    return;
  }

  // FIX #7: Soft validation for squad, strict for SDK/langchain
  if (step.outputSchema) {
    const { valid, errors } = tryValidateSchema(
      result.output,
      step.outputSchema as Record<string, unknown>,
    );
    if (!valid) {
      if (step.adapterType === 'squad') {
        console.warn(`[engine] Squad output schema mismatch for ${step.id}:`, errors);
        // Continue anyway — squad output is best-effort
      } else {
        await handleStepFailure(workflowId, step, bus, `Output validation failed: ${errors.join('; ')}`);
        return;
      }
    }
  }

  // Write output to context bus
  bus.writeOutput(step.definitionStepId, result.output);

  // Record cost
  if (result.usage?.costUsd) {
    await prisma.costEvent.create({
      data: {
        accountId: step.accountId, workflowId, stepId: step.id,
        executionId: execution.id, adapterType: step.adapterType,
        modelId: result.usage.modelId, billingType: 'token',
        inputTokens: result.usage.inputTokens, outputTokens: result.usage.outputTokens,
        costUsd: result.usage.costUsd,
      },
    });
    await prisma.workflow.update({
      where: { id: workflowId },
      data: { totalCostUsd: { increment: result.usage.costUsd } },
    });
  }

  await completeStep(workflowId, step, bus, result.output);
}

// ─── Human Step ─────────────────────────────────────────────

async function runHumanStep(workflowId: string, step: StepRow, bus: ContextBus): Promise<void> {
  const prisma = getPrisma();
  const sKey = sessionKey(step.taskId, step.adapterType);

  // Pause squad session if active (ball leaving AI)
  await pauseSessionIfActive(step.taskId);

  let inputData = bus.resolveInput(step.inputSchema as Record<string, unknown> | null);

  // If no inputSchema defined, pass previous step's output as context for the reviewer
  if (!step.inputSchema || Object.keys(inputData).length === 0) {
    const snapshot = bus.getSnapshot();
    const stepOutputs = (snapshot.stepOutputs || {}) as Record<string, unknown>;
    const outputKeys = Object.keys(stepOutputs);
    if (outputKeys.length > 0) {
      inputData = stepOutputs[outputKeys[outputKeys.length - 1]] as Record<string, unknown> ?? {};
    }
  }

  // FIX #6: Check for existing pending inbox item
  const existing = await prisma.inboxItem.findFirst({
    where: { stepId: step.id, status: 'pending' },
  });
  if (existing) {
    console.log(`[engine] Inbox item already exists for step ${step.id}, skipping creation`);
    return;
  }

  await prisma.inboxItem.create({
    data: {
      accountId: step.accountId,
      type: 'human_step',
      sourceService: 'tasks',
      sourceId: step.id,
      workflowId, stepId: step.id,
      title: step.name,
      description: step.promptTemplate ? bus.renderPrompt(step.promptTemplate) : undefined,
      assigneeRole: step.assigneeRole,
      inputData: inputData as JsonInput,
      outputSchema: (step.outputSchema ?? undefined) as JsonInput | undefined,
      context: {
        workflowId, stageName: step.task.stage.name, taskName: step.task.name,
      } as JsonInput,
    },
  });

  await prisma.workflowStep.update({
    where: { id: step.id },
    data: { status: 'awaiting_human' },
  });

  // Schedule follow-ups and timeout
  await scheduleFollowUps(step, 'follow_up_human');
  await scheduleTimeout(step);

  broadcastToWorkflow(workflowId, 'step:awaiting_human', {
    workflowId, stepId: step.id, name: step.name, assigneeRole: step.assigneeRole,
  });
  broadcastToAccount(step.accountId, 'inbox:item_created', {
    type: 'human_step', title: step.name, assigneeRole: step.assigneeRole, workflowId,
  });
}

// ─── System Step ────────────────────────────────────────────

async function runSystemStep(workflowId: string, step: StepRow, bus: ContextBus): Promise<void> {
  // TODO S7: implement script adapter with function registry
  // For now, complete with empty output
  console.log(`[engine] System step ${step.id} — script adapter not yet implemented`);
  await completeStep(workflowId, step, bus, {});
}

// ─── Client Step ────────────────────────────────────────────

async function runClientStep(workflowId: string, step: StepRow, bus: ContextBus): Promise<void> {
  const prisma = getPrisma();

  // Pause squad session if active
  await pauseSessionIfActive(step.taskId);

  const waitConfig = step.waitConfig as { channel?: string; treeFlowSlug?: string } | null;

  if (waitConfig?.channel === 'chat' && waitConfig.treeFlowSlug) {
    // FIX #8: Check for active workflow/talk for same contact
    // TODO S5: call chatClient.spawnTalk() — endpoint doesn't exist in Chat yet
    console.log(`[engine] Would spawn Talk: ${waitConfig.treeFlowSlug} for workflow ${workflowId}`);
  }

  await prisma.workflowStep.update({
    where: { id: step.id },
    data: { status: 'awaiting_client' },
  });

  // Schedule follow-ups and timeout
  await scheduleFollowUps(step, 'follow_up_client');
  await scheduleTimeout(step);

  broadcastToWorkflow(workflowId, 'step:awaiting_client', {
    workflowId, stepId: step.id, name: step.name,
  });
}

// ═══════════════════════════════════════════════════════════
// RESUME — after human or client
// ═══════════════════════════════════════════════════════════

/**
 * Called when a human completes an inbox item.
 */
export async function onInboxCompleted(
  inboxItemId: string,
  outputData: Record<string, unknown>,
  completedBy: string,
): Promise<void> {
  const prisma = getPrisma();

  const item = await prisma.inboxItem.findUnique({ where: { id: inboxItemId } });
  if (!item || item.status !== 'pending') {
    throw new Error('Inbox item not found or already completed');
  }
  if (!item.stepId || !item.workflowId) {
    throw new Error('Inbox item not linked to a workflow step');
  }

  await prisma.inboxItem.update({
    where: { id: inboxItemId },
    data: { status: 'completed', outputData: outputData as JsonInput, completedBy, completedAt: new Date() },
  });

  // Cancel pending follow-ups and timeout for this step
  await cancelScheduledJobs(item.stepId);

  const step = await prisma.workflowStep.findUnique({
    where: { id: item.stepId },
    include: { task: { include: { stage: true } } },
  });
  if (!step) throw new Error(`Step ${item.stepId} not found`);

  const workflow = await prisma.workflow.findUnique({ where: { id: item.workflowId } });
  if (!workflow) throw new Error(`Workflow ${item.workflowId} not found`);

  const bus = ContextBus.hydrate(workflow.context as Record<string, unknown>);
  bus.writeOutput(step.definitionStepId, outputData);

  broadcastToWorkflow(item.workflowId, 'inbox:item_completed', {
    inboxItemId, stepId: item.stepId, completedBy,
  });

  await completeStep(item.workflowId, step, bus, outputData);
}

/**
 * Called when a client responds (Talk completes or message received).
 */
export async function onClientResponded(
  workflowId: string,
  stepId: string,
  data: Record<string, unknown>,
): Promise<void> {
  const prisma = getPrisma();

  const step = await prisma.workflowStep.findUnique({
    where: { id: stepId },
    include: { task: { include: { stage: true } } },
  });
  if (!step || step.status !== 'awaiting_client') {
    throw new Error(`Step ${stepId} not awaiting client`);
  }

  // Cancel pending follow-ups and timeout
  await cancelScheduledJobs(stepId);

  const workflow = await prisma.workflow.findUnique({ where: { id: workflowId } });
  if (!workflow) throw new Error(`Workflow ${workflowId} not found`);

  const bus = ContextBus.hydrate(workflow.context as Record<string, unknown>);
  bus.writeOutput(step.definitionStepId, data);

  await completeStep(workflowId, step, bus, data);
}

// FIX #4: Checkpoint completed by human
export async function onCheckpointCompleted(
  inboxItemId: string,
  humanResponse: Record<string, unknown>,
  completedBy: string,
): Promise<void> {
  const prisma = getPrisma();

  const item = await prisma.inboxItem.findUnique({ where: { id: inboxItemId } });
  if (!item || item.status !== 'pending' || item.type !== 'checkpoint') {
    throw new Error('Checkpoint inbox item not found or already completed');
  }

  await prisma.inboxItem.update({
    where: { id: inboxItemId },
    data: { status: 'completed', outputData: humanResponse as JsonInput, completedBy, completedAt: new Date() },
  });

  const step = await prisma.workflowStep.findUnique({
    where: { id: item.stepId! },
    include: { task: { include: { stage: true } } },
  });
  if (!step) throw new Error(`Step not found`);

  const workflow = await prisma.workflow.findUnique({ where: { id: item.workflowId! } });
  if (!workflow) throw new Error(`Workflow not found`);

  const bus = ContextBus.hydrate(workflow.context as Record<string, unknown>);

  // Resume squad session and continue step with human's response
  const adapter = getAdapter(step.adapterType);
  if (!isSessionAware(adapter)) throw new Error('Checkpoint only works with session-aware adapters');

  const sKey = sessionKey(step.taskId, step.adapterType);
  let handle = sessionHandles.get(sKey);
  if (!handle) throw new Error(`No session handle for checkpoint resume`);

  handle = await (adapter as SessionAwareAdapter).resumeSession(handle, {
    workflowId: workflow.id, taskId: step.taskId,
    accountId: step.accountId, adapterConfig: {}, cwd: '',
  });
  sessionHandles.set(sKey, handle);

  // Build checkpoint response prompt
  const checkpointPrompt = [
    `O operador revisou seu checkpoint e respondeu:`,
    JSON.stringify(humanResponse, null, 2),
    `Continue a execução.`,
  ].join('\n');

  const onLog: LogCallback = (entry) => {
    broadcastToWorkflow(workflow.id, 'step:transcript', { workflowId: workflow.id, stepId: step.id, entry });
  };

  const result = await (adapter as SessionAwareAdapter).executeStep(
    handle,
    { stepId: step.id, definitionStepId: step.definitionStepId, prompt: checkpointPrompt, input: humanResponse },
    onLog,
  );

  // Might generate another checkpoint — recurse
  if (step.allowCheckpoints && result.success && result.output._checkpoint) {
    await handleCheckpoint(workflow.id, step, bus, result, null);
    return;
  }

  if (!result.success) {
    await handleStepFailure(workflow.id, step, bus, result.error ?? 'Unknown error');
    return;
  }

  bus.writeOutput(step.definitionStepId, result.output);
  await completeStep(workflow.id, step, bus, result.output);
}

// ═══════════════════════════════════════════════════════════
// ADVANCE — navigate the graph/linear flow
// ═══════════════════════════════════════════════════════════

async function completeStep(
  workflowId: string,
  step: StepRow,
  bus: ContextBus,
  output: Record<string, unknown>,
): Promise<void> {
  const prisma = getPrisma();

  await prisma.workflowStep.update({
    where: { id: step.id },
    data: { status: 'completed', output: output as JsonInput, completedAt: new Date() },
  });

  // Execute onComplete variable updates
  await applyOnComplete(step, bus);

  // Persist context bus
  await prisma.workflow.update({
    where: { id: workflowId },
    data: { context: bus.persist() as JsonInput, lastActivityAt: new Date() },
  });

  broadcastToWorkflow(workflowId, 'step:completed', { workflowId, stepId: step.id, name: step.name });

  await advanceToNext(workflowId, step, bus);
}

async function advanceToNext(workflowId: string, currentStep: StepRow, bus: ContextBus): Promise<void> {
  const prisma = getPrisma();

  // Check transitions (graph mode)
  const transitions = currentStep.transitions as Array<{ condition?: string; target: string; default?: boolean }> | null;
  if (transitions && transitions.length > 0) {
    const stepOutput = (currentStep.output as Record<string, unknown>) ?? {};
    const targetDefId = evaluateTransitions(transitions, bus.getSnapshot(), stepOutput);

    if (targetDefId) {
      await advanceToStepByDefId(workflowId, currentStep, targetDefId, bus);
      return;
    }
  }

  // Linear mode: next step by position in same task
  const nextStep = await prisma.workflowStep.findFirst({
    where: { taskId: currentStep.taskId, position: { gt: currentStep.position }, status: 'pending' },
    orderBy: { position: 'asc' },
  });

  if (nextStep) {
    await runStep(workflowId, nextStep.id);
    return;
  }

  // Task complete — end session for this (task, adapterType)
  await endSessionsForTask(currentStep.taskId);
  await completeContainer(workflowId, currentStep, bus);
}

/**
 * FIX #2 + #3: Navigate to step by definitionStepId.
 * Handles cross-task transitions and loop resets.
 */
async function advanceToStepByDefId(
  workflowId: string,
  fromStep: StepRow,
  targetDefId: string,
  bus: ContextBus,
): Promise<void> {
  const prisma = getPrisma();

  let targetStep = await prisma.workflowStep.findFirst({
    where: { workflowId, definitionStepId: targetDefId, status: 'pending' },
    include: { task: { include: { stage: true } } },
  });

  // FIX #3: If target step already completed (loop), reset it
  if (!targetStep) {
    const completedTarget = await prisma.workflowStep.findFirst({
      where: { workflowId, definitionStepId: targetDefId, status: { in: ['completed', 'skipped', 'failed'] } },
      include: { task: { include: { stage: true } } },
    });

    if (completedTarget) {
      // Reset step for next loop iteration
      await prisma.workflowStep.update({
        where: { id: completedTarget.id },
        data: {
          status: 'pending',
          output: Prisma.JsonNull,
          errorMessage: null,
          startedAt: null,
          completedAt: null,
          // retryCount keeps accumulating as iteration tracker
        },
      });
      targetStep = { ...completedTarget, status: 'pending' } as typeof completedTarget;
      console.log(`[engine] Loop: reset step ${targetDefId} to pending`);
    }
  }

  if (!targetStep) {
    console.error(`[engine] Transition target "${targetDefId}" not found in workflow ${workflowId}`);
    return;
  }

  // FIX #2: Handle cross-task and cross-stage transitions
  if (targetStep.taskId !== fromStep.taskId) {
    // Completing current task
    await endSessionsForTask(fromStep.taskId);
    await prisma.workflowTask.update({
      where: { id: fromStep.taskId },
      data: { status: 'completed', completedAt: new Date() },
    });

    // Mark skipped steps in the task we're leaving
    await prisma.workflowStep.updateMany({
      where: { taskId: fromStep.taskId, status: 'pending' },
      data: { status: 'skipped', completedAt: new Date() },
    });

    // Activate target task
    await prisma.workflowTask.update({
      where: { id: targetStep.taskId },
      data: { status: 'active', startedAt: new Date() },
    });

    // Cross-stage?
    if (targetStep.task.stageId !== fromStep.task.stageId) {
      await prisma.workflowStage.update({
        where: { id: fromStep.task.stageId },
        data: { status: 'completed', completedAt: new Date() },
      });

      // Mark skipped tasks in the stage we're leaving
      await prisma.workflowTask.updateMany({
        where: { stageId: fromStep.task.stageId, status: 'pending' },
        data: { status: 'skipped', completedAt: new Date() },
      });

      await prisma.workflowStage.update({
        where: { id: targetStep.task.stageId },
        data: { status: 'active', startedAt: new Date() },
      });

      await prisma.workflow.update({
        where: { id: workflowId },
        data: { stage: targetStep.task.stage.definitionStageId, currentStageId: targetStep.task.stageId },
      });

      broadcastToWorkflow(workflowId, 'workflow:stage_changed', {
        workflowId, stageId: targetStep.task.stageId, status: 'active',
      });
    }
  }

  await runStep(workflowId, targetStep.id);
}

/**
 * Complete task → stage → workflow cascade (linear advancement).
 */
async function completeContainer(workflowId: string, currentStep: StepRow, bus: ContextBus): Promise<void> {
  const prisma = getPrisma();

  // Complete current task
  await prisma.workflowTask.update({
    where: { id: currentStep.taskId },
    data: { status: 'completed', completedAt: new Date() },
  });

  const currentTask = await prisma.workflowTask.findUnique({ where: { id: currentStep.taskId } });
  if (!currentTask) return;

  // Next task in same stage
  const nextTask = await prisma.workflowTask.findFirst({
    where: { stageId: currentTask.stageId, position: { gt: currentTask.position }, status: 'pending' },
    orderBy: { position: 'asc' },
  });

  if (nextTask) {
    await prisma.workflowTask.update({ where: { id: nextTask.id }, data: { status: 'active', startedAt: new Date() } });
    const firstStep = await prisma.workflowStep.findFirst({
      where: { taskId: nextTask.id, status: 'pending' },
      orderBy: { position: 'asc' },
    });
    if (firstStep) { await runStep(workflowId, firstStep.id); return; }
  }

  // Stage complete
  await prisma.workflowStage.update({
    where: { id: currentTask.stageId },
    data: { status: 'completed', completedAt: new Date() },
  });

  const currentStage = await prisma.workflowStage.findUnique({ where: { id: currentTask.stageId } });
  if (!currentStage) return;

  broadcastToWorkflow(workflowId, 'workflow:stage_changed', {
    workflowId, stageId: currentTask.stageId, status: 'completed',
  });

  // Next stage
  const nextStage = await prisma.workflowStage.findFirst({
    where: { workflowId, position: { gt: currentStage.position }, status: 'pending' },
    orderBy: { position: 'asc' },
  });

  if (nextStage) {
    await prisma.workflowStage.update({ where: { id: nextStage.id }, data: { status: 'active', startedAt: new Date() } });
    await prisma.workflow.update({
      where: { id: workflowId },
      data: { stage: nextStage.definitionStageId, currentStageId: nextStage.id },
    });
    broadcastToWorkflow(workflowId, 'workflow:stage_changed', { workflowId, stageId: nextStage.id, status: 'active' });

    const firstTask = await prisma.workflowTask.findFirst({
      where: { stageId: nextStage.id, status: 'pending' },
      orderBy: { position: 'asc' },
    });
    if (firstTask) {
      await prisma.workflowTask.update({ where: { id: firstTask.id }, data: { status: 'active', startedAt: new Date() } });
      const firstStep = await prisma.workflowStep.findFirst({
        where: { taskId: firstTask.id, status: 'pending' },
        orderBy: { position: 'asc' },
      });
      if (firstStep) { await runStep(workflowId, firstStep.id); return; }
    }
  }

  // ALL DONE
  const workflow = await prisma.workflow.findUnique({ where: { id: workflowId } });
  await prisma.workflow.update({
    where: { id: workflowId },
    data: { status: 'completed', completedAt: new Date() },
  });
  broadcastToWorkflow(workflowId, 'workflow:updated', { workflowId, status: 'completed' });
  broadcastToAccount(workflow!.accountId, 'workflow:updated', { workflowId, status: 'completed' });
  console.log(`[engine] Workflow completed: ${workflowId}`);
}

// ═══════════════════════════════════════════════════════════
// FAILURE + CHECKPOINT HANDLERS
// ═══════════════════════════════════════════════════════════

async function handleStepFailure(
  workflowId: string, step: StepRow, bus: ContextBus, error: string,
): Promise<void> {
  const prisma = getPrisma();

  // Retry?
  if (step.retryCount < step.maxRetries) {
    await prisma.workflowStep.update({
      where: { id: step.id },
      data: { retryCount: step.retryCount + 1, status: 'pending' },
    });
    console.log(`[engine] Step ${step.id} retry ${step.retryCount + 1}/${step.maxRetries}`);
    await runStep(workflowId, step.id);
    return;
  }

  // onFailure target?
  if (step.onFailure) {
    console.log(`[engine] Step ${step.id} failed, jumping to onFailure: ${step.onFailure}`);
    await prisma.workflowStep.update({
      where: { id: step.id },
      data: { status: 'failed', errorMessage: error, completedAt: new Date() },
    });
    await advanceToStepByDefId(workflowId, step, step.onFailure, bus);
    return;
  }

  // Fail workflow
  await prisma.workflowStep.update({
    where: { id: step.id },
    data: { status: 'failed', errorMessage: error, completedAt: new Date() },
  });
  await prisma.workflow.update({
    where: { id: workflowId },
    data: { status: 'failed', errorMessage: `Step "${step.name}" failed: ${error}` },
  });
  broadcastToWorkflow(workflowId, 'step:failed', { workflowId, stepId: step.id, error });
  console.log(`[engine] Workflow failed: ${workflowId} — step ${step.id}: ${error}`);
}

/**
 * FIX #4: Handle dynamic checkpoint from squad.
 */
async function handleCheckpoint(
  workflowId: string, step: StepRow, bus: ContextBus,
  result: { output: Record<string, unknown> }, executionId: string | null,
): Promise<void> {
  const prisma = getPrisma();
  const sKey = sessionKey(step.taskId, step.adapterType);

  // Pause squad session
  const adapter = getAdapter(step.adapterType);
  if (isSessionAware(adapter)) {
    const handle = sessionHandles.get(sKey);
    if (handle) await (adapter as SessionAwareAdapter).pauseSession(handle);
  }

  await prisma.workflowStep.update({
    where: { id: step.id },
    data: { status: 'awaiting_human' },
  });

  // FIX #6: Check existing checkpoint inbox item
  const existing = await prisma.inboxItem.findFirst({
    where: { stepId: step.id, type: 'checkpoint', status: 'pending' },
  });
  if (existing) return;

  await prisma.inboxItem.create({
    data: {
      accountId: step.accountId,
      type: 'checkpoint',
      sourceService: 'tasks',
      sourceId: step.id,
      workflowId, stepId: step.id,
      title: `Checkpoint: ${step.name}`,
      description: String(result.output._checkpoint_reason ?? 'Squad requested human input'),
      assigneeRole: step.assigneeRole,
      inputData: (result.output._checkpoint_data ?? result.output) as JsonInput,
      context: { workflowId, stepName: step.name, executionId } as JsonInput,
    },
  });

  broadcastToWorkflow(workflowId, 'step:awaiting_human', {
    workflowId, stepId: step.id, name: step.name, isCheckpoint: true,
  });
  broadcastToAccount(step.accountId, 'inbox:item_created', {
    type: 'checkpoint', title: `Checkpoint: ${step.name}`, workflowId,
  });
}

// ═══════════════════════════════════════════════════════════
// SESSION HELPERS — FIX #1
// ═══════════════════════════════════════════════════════════

async function pauseSessionIfActive(taskId: string): Promise<void> {
  // Pause ALL adapter sessions for this task
  for (const [key, handle] of sessionHandles) {
    if (key.startsWith(`${taskId}:`)) {
      const adapterType = key.split(':')[1];
      const adapter = getAdapter(adapterType);
      if (isSessionAware(adapter)) {
        await (adapter as SessionAwareAdapter).pauseSession(handle);
      }
    }
  }
}

async function endSessionsForTask(taskId: string): Promise<void> {
  for (const [key, handle] of sessionHandles) {
    if (key.startsWith(`${taskId}:`)) {
      const adapterType = key.split(':')[1];
      const adapter = getAdapter(adapterType);
      if (isSessionAware(adapter)) {
        await (adapter as SessionAwareAdapter).endSession(handle);
      }
      sessionHandles.delete(key);
    }
  }
}

// ═══════════════════════════════════════════════════════════
// SCHEDULED JOBS — follow-ups and timeouts
// ═══════════════════════════════════════════════════════════

async function scheduleFollowUps(step: StepRow, type: string): Promise<void> {
  const followUp = step.followUp as { intervals?: number[]; message?: string; escalateTo?: string } | null;
  if (!followUp?.intervals?.length) return;

  const prisma = getPrisma();
  const now = Date.now();

  for (let i = 0; i < followUp.intervals.length; i++) {
    await prisma.scheduledJob.create({
      data: {
        accountId: step.accountId,
        workflowId: step.workflowId,
        stepId: step.id,
        type,
        scheduledAt: new Date(now + followUp.intervals[i] * 60_000),
        payload: {
          message: followUp.message,
          attemptNumber: i + 1,
          escalateTo: (i === followUp.intervals.length - 1) ? followUp.escalateTo : undefined,
        } as JsonInput,
      },
    });
  }
}

async function scheduleTimeout(step: StepRow): Promise<void> {
  if (!step.timeoutMs) return;

  const prisma = getPrisma();
  await prisma.scheduledJob.create({
    data: {
      accountId: step.accountId,
      workflowId: step.workflowId,
      stepId: step.id,
      type: 'timeout',
      scheduledAt: new Date(Date.now() + step.timeoutMs),
      payload: { onTimeout: step.onTimeout } as JsonInput,
    },
  });
}

async function cancelScheduledJobs(stepId: string): Promise<void> {
  const prisma = getPrisma();
  await prisma.scheduledJob.updateMany({
    where: { stepId, executedAt: null, cancelledAt: null },
    data: { cancelledAt: new Date() },
  });
}

// ═══════════════════════════════════════════════════════════
// ON COMPLETE — variable updates
// ═══════════════════════════════════════════════════════════

async function applyOnComplete(step: StepRow, bus: ContextBus): Promise<void> {
  const onComplete = step.onComplete as Array<{ set: string; value: string }> | null;
  if (!onComplete?.length) return;

  for (const op of onComplete) {
    if (op.set && op.value) {
      // Safe expression evaluation: only resolve $ref paths and simple arithmetic
      const resolved = op.value.replace(/\$\.([a-zA-Z0-9_.]+)/g, (_m, path: string) => {
        const val = bus.get(path);
        return val != null ? String(val) : '0';
      });

      try {
        // Allow only simple math: numbers, +, -, *, parentheses
        if (/^[\d\s+\-*().]+$/.test(resolved)) {
          const result = new Function(`return (${resolved})`)();
          bus.setVariable(op.set, result);
        } else if (resolved === 'now()') {
          bus.setVariable(op.set, new Date().toISOString());
        } else {
          bus.setVariable(op.set, resolved);
        }
      } catch {
        bus.setVariable(op.set, resolved);
      }
    }
  }
}

// ═══════════════════════════════════════════════════════════
// RESUME PROMPT BUILDER — FIX #1 context catch-up
// ═══════════════════════════════════════════════════════════

function buildResumePrompt(prompt: string, step: StepRow, bus: ContextBus): string {
  // Check if other steps completed since session was paused
  const snapshot = bus.getSnapshot();
  const otherOutputs = Object.entries(snapshot.stepOutputs)
    .filter(([key]) => key !== step.definitionStepId);

  if (otherOutputs.length === 0) return prompt;

  const summary = otherOutputs
    .map(([stepId, output]) => `- Step "${stepId}": ${JSON.stringify(output)}`)
    .join('\n');

  return `${prompt}\n\nContexto atualizado (steps que ocorreram enquanto você estava pausado):\n${summary}`;
}

// ═══════════════════════════════════════════════════════════
// CRASH RECOVERY — FIX #5
// ═══════════════════════════════════════════════════════════

export async function recoverStaleSteps(): Promise<void> {
  const prisma = getPrisma();
  const nodeId = process.env.HOSTNAME || process.env.NODE_ID || 'local';

  // Mark orphaned sessions
  const orphaned = await prisma.taskSession.updateMany({
    where: { status: 'active', nodeId },
    data: { status: 'orphaned' },
  });
  if (orphaned.count > 0) {
    console.log(`[recovery] Marked ${orphaned.count} orphaned sessions`);
  }

  // Reset running steps without active session
  const staleSteps = await prisma.workflowStep.findMany({
    where: { status: 'running' },
  });

  for (const step of staleSteps) {
    await prisma.workflowStep.update({
      where: { id: step.id },
      data: { status: 'pending', retryCount: { increment: 1 } },
    });
    console.log(`[recovery] Reset step ${step.id} to pending`);
  }

  // Find workflows that should be running but aren't
  const staleWorkflows = await prisma.workflow.findMany({
    where: { status: 'running', definitionVersion: { gt: 0 } },
  });

  for (const wf of staleWorkflows) {
    const hasActiveStep = await prisma.workflowStep.count({
      where: { workflowId: wf.id, status: { in: ['running', 'awaiting_human', 'awaiting_client'] } },
    });
    const hasPending = await prisma.workflowStep.count({
      where: { workflowId: wf.id, status: 'pending' },
    });

    if (hasActiveStep === 0 && hasPending > 0) {
      const nextStep = await prisma.workflowStep.findFirst({
        where: { workflowId: wf.id, status: 'pending' },
        orderBy: { position: 'asc' },
      });
      if (nextStep) {
        console.log(`[recovery] Resuming workflow ${wf.id} from step ${nextStep.id}`);
        setTimeout(() => runStep(wf.id, nextStep.id).catch(console.error), 5000);
      }
    }
  }
}

// ═══════════════════════════════════════════════════════════
// TIMEOUT HANDLER (called by scheduled job worker)
// ═══════════════════════════════════════════════════════════

export async function onStepTimeout(stepId: string): Promise<void> {
  const prisma = getPrisma();

  const step = await prisma.workflowStep.findUnique({
    where: { id: stepId },
    include: { task: { include: { stage: true } } },
  });
  if (!step) return;
  if (!['awaiting_human', 'awaiting_client'].includes(step.status)) return;

  const workflow = await prisma.workflow.findUnique({ where: { id: step.workflowId } });
  if (!workflow) return;

  const bus = ContextBus.hydrate(workflow.context as Record<string, unknown>);

  // Cancel remaining jobs
  await cancelScheduledJobs(stepId);

  // Dismiss pending inbox items for this step
  await prisma.inboxItem.updateMany({
    where: { stepId, status: 'pending' },
    data: { status: 'dismissed' },
  });

  if (step.onTimeout) {
    // Jump to timeout target step
    await prisma.workflowStep.update({
      where: { id: stepId },
      data: { status: 'failed', errorMessage: 'Timeout', completedAt: new Date() },
    });
    bus.writeOutput(step.definitionStepId, { _timedOut: true });
    await advanceToStepByDefId(step.workflowId, step, step.onTimeout, bus);
  } else {
    // Fail workflow
    await handleStepFailure(step.workflowId, step, bus, 'Step timed out');
  }
}

// ═══════════════════════════════════════════════════════════
// TYPE HELPER
// ═══════════════════════════════════════════════════════════

interface StepRow {
  id: string;
  accountId: string;
  workflowId: string;
  taskId: string;
  definitionStepId: string;
  name: string;
  position: number;
  executor: string;
  adapterType: string;
  status: string;
  assigneeRole: string | null;
  isGate: boolean;
  condition: string | null;
  inputSchema: unknown;
  outputSchema: unknown;
  promptTemplate: string | null;
  waitConfig: unknown;
  transitions: unknown;
  allowCheckpoints: boolean;
  onComplete: unknown;
  timeoutMs: number | null;
  onTimeout: string | null;
  onFailure: string | null;
  followUp: unknown;
  output: unknown;
  retryCount: number;
  maxRetries: number;
  task: {
    id: string;
    name: string;
    stageId: string;
    position: number;
    stage: { id: string; name: string; definitionStageId: string };
  };
}
