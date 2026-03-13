import { Server as SocketIOServer } from 'socket.io';
import { Queue } from 'bullmq';
import { getPrisma } from '../../config/database.js';
import { getRedis } from '../../config/redis.js';
import {
  LoadedTalkContext,
  DecisionResult,
  PostProcessResult,
  TreeFlowDefinition,
  TreeFlowStep,
} from '../treeflow/treeflow.types.js';
import { StateApplyResult } from './state-applier.js';

// ════════════════════════════════════════════════════════════
// [6] Post Processor
// ════════════════════════════════════════════════════════════

/**
 * Post-processing after state changes:
 * - Emit WebSocket events for step changes
 * - Spawn sub-Talks if step has sub_treeflow_slug
 * - Complete Talk if step type='closing' and all required actions filled
 * - Update last_activity_at
 * - Apply step labels
 * - If auto mode, enqueue message to be sent
 */
export async function runPostProcessing(
  ctx: LoadedTalkContext,
  stateResult: StateApplyResult,
  decision: DecisionResult,
  io: SocketIOServer,
): Promise<PostProcessResult> {
  const prisma = getPrisma();

  const result: PostProcessResult = {
    stepChanged: stateResult.stepChanged,
    subTalkSpawned: null,
    talkCompleted: false,
    labelsApplied: [],
  };

  // Resolve the new step from definition
  const newStep = ctx.definition.steps.find((s) => s.id === stateResult.newStepId);

  // ── Emit WebSocket: step changed ──
  if (stateResult.stepChanged) {
    io.to(`conversation:${ctx.talk.conversationId}`).emit('talk:step_changed', {
      talkId: ctx.talk.id,
      conversationId: ctx.talk.conversationId,
      previousStepId: stateResult.previousStepId,
      currentStepId: stateResult.newStepId,
      stepName: newStep?.name ?? stateResult.newStepId,
      reason: stateResult.transitionReason,
    });

    io.to(`account:${ctx.talk.accountId}`).emit('talk:step_changed', {
      talkId: ctx.talk.id,
      conversationId: ctx.talk.conversationId,
      previousStepId: stateResult.previousStepId,
      currentStepId: stateResult.newStepId,
      stepName: newStep?.name ?? stateResult.newStepId,
    });
  }

  // ── Emit WebSocket events based on decision mode ──
  if (decision.mode === 'auto' && decision.messageContent) {
    io.to(`conversation:${ctx.talk.conversationId}`).emit('talk:auto_sent', {
      talkId: ctx.talk.id,
      conversationId: ctx.talk.conversationId,
      content: decision.messageContent,
    });
    io.to(`account:${ctx.talk.accountId}`).emit('talk:auto_sent', {
      talkId: ctx.talk.id,
      conversationId: ctx.talk.conversationId,
      content: decision.messageContent,
    });
  }

  if (decision.mode === 'hitl' && decision.suggestionId) {
    io.to(`conversation:${ctx.talk.conversationId}`).emit('talk:hitl_queued', {
      talkId: ctx.talk.id,
      conversationId: ctx.talk.conversationId,
      suggestionId: decision.suggestionId,
      content: decision.messageContent,
    });
    io.to(`account:${ctx.talk.accountId}`).emit('talk:hitl_queued', {
      talkId: ctx.talk.id,
      conversationId: ctx.talk.conversationId,
      suggestionId: decision.suggestionId,
      content: decision.messageContent,
    });
  }

  // ── Spawn sub-Talk if step has sub_treeflow_slug ──
  if (newStep?.sub_treeflow_slug && stateResult.stepChanged) {
    const subTalkId = await spawnSubTalk(ctx, newStep.sub_treeflow_slug);
    if (subTalkId) {
      result.subTalkSpawned = subTalkId;

      io.to(`conversation:${ctx.talk.conversationId}`).emit('talk:sub_talk_spawned', {
        parentTalkId: ctx.talk.id,
        subTalkId,
        conversationId: ctx.talk.conversationId,
        treeFlowSlug: newStep.sub_treeflow_slug,
      });
    }
  }

  // ── Complete Talk if closing step + all required actions filled ──
  if (newStep?.type === 'closing') {
    const allRequiredFilled = await checkAllRequiredActionsFilled(ctx, stateResult.newStepId);
    if (allRequiredFilled) {
      await completeTalk(ctx);
      result.talkCompleted = true;

      io.to(`conversation:${ctx.talk.conversationId}`).emit('talk:completed', {
        talkId: ctx.talk.id,
        conversationId: ctx.talk.conversationId,
      });
    }
  }

  // ── Apply step labels ──
  if (newStep?.labels_to_apply && newStep.labels_to_apply.length > 0 && stateResult.stepChanged) {
    const applied = await applyLabels(ctx, newStep.labels_to_apply);
    result.labelsApplied = applied;
  }

  // ── If auto mode, enqueue message to be sent ──
  if (decision.mode === 'auto' && decision.suggestionId) {
    const sendQueue = new Queue('message-send', { connection: getRedis() as any });
    await sendQueue.add('send-auto-response', {
      accountId: ctx.talk.accountId,
      conversationId: ctx.talk.conversationId,
      talkId: ctx.talk.id,
      suggestionId: decision.suggestionId,
      content: decision.messageContent,
    });
    await sendQueue.close();
  }

  return result;
}

// ── Helpers ──

async function spawnSubTalk(ctx: LoadedTalkContext, subTreeFlowSlug: string): Promise<string | null> {
  const prisma = getPrisma();

  // Find the sub TreeFlow by slug in the same account
  const subTreeFlow = await prisma.treeFlow.findUnique({
    where: {
      accountId_slug: {
        accountId: ctx.talk.accountId,
        slug: subTreeFlowSlug,
      },
    },
    include: { activeVersion: true },
  });

  if (!subTreeFlow || !subTreeFlow.activeVersion) {
    console.error(`[PostProcessor] Sub TreeFlow "${subTreeFlowSlug}" not found or has no active version`);
    return null;
  }

  const subDefinition = subTreeFlow.activeVersion.definition as unknown as TreeFlowDefinition;

  // Pause the current (parent) talk
  await prisma.talk.update({
    where: { id: ctx.talk.id },
    data: { status: 'paused', pausedAt: new Date() },
  });

  await prisma.talkEvent.create({
    data: {
      talkId: ctx.talk.id,
      eventType: 'talk_paused',
      data: { reason: 'sub_talk_spawn', subTreeFlowSlug },
      actorType: 'system',
    },
  });

  // Create the sub-talk
  const subTalk = await prisma.talk.create({
    data: {
      accountId: ctx.talk.accountId,
      conversationId: ctx.talk.conversationId,
      contactId: ctx.talk.contactId,
      treeFlowId: subTreeFlow.id,
      treeFlowVersionId: subTreeFlow.activeVersion.id,
      parentTalkId: ctx.talk.id,
      status: 'active',
      metadata: { parentTalkId: ctx.talk.id },
    },
  });

  // Create TalkFlow for sub-talk
  await prisma.talkFlow.create({
    data: {
      talkId: subTalk.id,
      currentStepId: subDefinition.initial_step_id,
      state: {
        filled_actions: {},
        step_history: [{
          step_id: subDefinition.initial_step_id,
          entered_at: new Date().toISOString(),
          exited_at: null,
          exit_reason: null,
        }],
        variables: {},
        messages_in_current_step: 0,
      },
      objectionsEncountered: [],
      escapeAttempts: 0,
      confidenceHistory: [],
    },
  });

  // Set sub-talk as active on conversation
  await prisma.conversation.update({
    where: { id: ctx.talk.conversationId },
    data: { activeTalkId: subTalk.id },
  });

  await prisma.talkEvent.create({
    data: {
      talkId: subTalk.id,
      eventType: 'talk_started',
      data: {
        treeFlowId: subTreeFlow.id,
        parentTalkId: ctx.talk.id,
        initialStepId: subDefinition.initial_step_id,
      },
      actorType: 'system',
    },
  });

  return subTalk.id;
}

async function checkAllRequiredActionsFilled(ctx: LoadedTalkContext, stepId: string): Promise<boolean> {
  const step = ctx.definition.steps.find((s) => s.id === stepId);
  if (!step) return false;

  const requiredActions = step.actions.filter((a) => a.required);
  if (requiredActions.length === 0) return true;

  // Read fresh state from DB (post state-applier update)
  const prisma = getPrisma();
  const freshTalkFlow = await prisma.talkFlow.findUnique({
    where: { id: ctx.talkFlow.id },
    select: { state: true },
  });
  if (!freshTalkFlow) return false;

  const state = freshTalkFlow.state as any;
  return requiredActions.every((a) => {
    const filled = state.filled_actions?.[a.id];
    return filled && filled.confirmed;
  });
}

async function completeTalk(ctx: LoadedTalkContext): Promise<void> {
  const prisma = getPrisma();

  await prisma.$transaction(async (tx) => {
    // Snapshot state
    await tx.talkFlow.update({
      where: { id: ctx.talkFlow.id },
      data: {
        snapshot: {
          state: ctx.talkFlow.state,
          currentStepId: ctx.talkFlow.currentStepId,
          objectionsEncountered: ctx.talkFlow.objectionsEncountered,
          escapeAttempts: ctx.talkFlow.escapeAttempts,
          completedAt: new Date().toISOString(),
        } as any,
      },
    });

    await tx.talk.update({
      where: { id: ctx.talk.id },
      data: { status: 'completed', closedAt: new Date() },
    });

    // Clear active talk from conversation
    await tx.conversation.updateMany({
      where: { id: ctx.talk.conversationId, activeTalkId: ctx.talk.id },
      data: { activeTalkId: null },
    });

    await tx.talkEvent.create({
      data: {
        talkId: ctx.talk.id,
        eventType: 'talk_completed',
        data: { reason: 'all_actions_filled_in_closing_step' },
        actorType: 'system',
      },
    });

    // If this talk has a parent, resume the parent
    if (ctx.talk.parentTalkId) {
      const parentTalk = await tx.talk.findFirst({
        where: { id: ctx.talk.parentTalkId, status: 'paused' },
      });

      if (parentTalk) {
        await tx.talk.update({
          where: { id: parentTalk.id },
          data: { status: 'active', resumedAt: new Date(), lastActivityAt: new Date() },
        });

        await tx.conversation.update({
          where: { id: parentTalk.conversationId },
          data: { activeTalkId: parentTalk.id },
        });

        await tx.talkEvent.create({
          data: {
            talkId: parentTalk.id,
            eventType: 'talk_resumed',
            data: { reason: 'sub_talk_completed', subTalkId: ctx.talk.id },
            actorType: 'system',
          },
        });
      }
    }
  });
}

async function applyLabels(ctx: LoadedTalkContext, labelNames: string[]): Promise<string[]> {
  const prisma = getPrisma();
  const applied: string[] = [];

  for (const labelName of labelNames) {
    // Find or skip label (don't create — labels must pre-exist)
    const label = await prisma.label.findUnique({
      where: {
        accountId_name: {
          accountId: ctx.talk.accountId,
          name: labelName,
        },
      },
    });

    if (!label) continue;

    // Upsert conversation label
    try {
      await prisma.conversationLabel.create({
        data: {
          conversationId: ctx.talk.conversationId,
          labelId: label.id,
        },
      });
      applied.push(labelName);
    } catch {
      // Already exists — skip
      applied.push(labelName);
    }
  }

  return applied;
}
