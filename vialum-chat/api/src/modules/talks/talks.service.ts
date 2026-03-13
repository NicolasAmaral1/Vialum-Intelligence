import { getPrisma } from '../../config/database.js';
import {
  TalkFlowState,
  TreeFlowDefinition,
  TreeFlowSettings,
  DEFAULT_TALKFLOW_STATE,
  DEFAULT_TREEFLOW_SETTINGS,
} from '../treeflow/treeflow.types.js';

// ════════════════════════════════════════════════════════════
// Talk Lifecycle Service
// ════════════════════════════════════════════════════════════

export async function listTalks(accountId: string, conversationId: string, opts?: {
  status?: string;
  limit?: number;
  offset?: number;
}) {
  const prisma = getPrisma();

  return prisma.talk.findMany({
    where: {
      accountId,
      conversationId,
      ...(opts?.status ? { status: opts.status } : {}),
    },
    include: {
      treeFlow: { select: { id: true, name: true, slug: true } },
      talkFlow: { select: { id: true, currentStepId: true, state: true } },
      _count: { select: { talkEvents: true, talkMessages: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: opts?.limit ?? 50,
    skip: opts?.offset ?? 0,
  });
}

export async function getTalk(accountId: string, talkId: string) {
  const prisma = getPrisma();

  const talk = await prisma.talk.findFirst({
    where: { id: talkId, accountId },
    include: {
      treeFlow: { select: { id: true, name: true, slug: true, settings: true } },
      treeFlowVersion: { select: { id: true, versionNumber: true, definition: true } },
      talkFlow: true,
      contact: { select: { id: true, name: true, phone: true, email: true, funnelStage: true } },
      parentTalk: { select: { id: true, status: true } },
      childTalks: { select: { id: true, status: true, treeFlowId: true } },
      _count: { select: { talkEvents: true, talkMessages: true, aiSuggestions: true } },
    },
  });

  if (!talk) {
    throw { statusCode: 404, message: 'Talk not found', code: 'TALK_NOT_FOUND' };
  }

  return talk;
}

export async function createTalk(accountId: string, data: {
  conversationId: string;
  treeFlowId: string;
  contactId: string;
  parentTalkId?: string;
  metadata?: Record<string, unknown>;
}) {
  const prisma = getPrisma();

  // Load the TreeFlow and its active version
  const treeFlow = await prisma.treeFlow.findFirst({
    where: { id: data.treeFlowId, accountId },
    include: { activeVersion: true },
  });

  if (!treeFlow) {
    throw { statusCode: 404, message: 'TreeFlow not found', code: 'TREEFLOW_NOT_FOUND' };
  }

  if (!treeFlow.activeVersion) {
    throw { statusCode: 400, message: 'TreeFlow has no published version', code: 'NO_ACTIVE_VERSION' };
  }

  const definition = treeFlow.activeVersion.definition as unknown as TreeFlowDefinition;
  const settings = (treeFlow.settings as unknown as TreeFlowSettings) ?? DEFAULT_TREEFLOW_SETTINGS;

  // Verify conversation belongs to account
  const conversation = await prisma.conversation.findFirst({
    where: { id: data.conversationId, accountId },
  });

  if (!conversation) {
    throw { statusCode: 404, message: 'Conversation not found', code: 'CONVERSATION_NOT_FOUND' };
  }

  // Initialize TalkFlow state
  const initialState: TalkFlowState = {
    ...DEFAULT_TALKFLOW_STATE,
    step_history: [{
      step_id: definition.initial_step_id,
      entered_at: new Date().toISOString(),
      exited_at: null,
      exit_reason: null,
    }],
  };

  // Create Talk + TalkFlow in transaction
  const result = await prisma.$transaction(async (tx) => {
    const talk = await tx.talk.create({
      data: {
        accountId,
        conversationId: data.conversationId,
        contactId: data.contactId,
        treeFlowId: data.treeFlowId,
        treeFlowVersionId: treeFlow.activeVersion!.id,
        parentTalkId: data.parentTalkId ?? null,
        status: 'active',
        metadata: (data.metadata ?? {}) as any,
        inactivityTimeoutMinutes: settings.inactivity_timeout_minutes,
      },
    });

    const talkFlow = await tx.talkFlow.create({
      data: {
        talkId: talk.id,
        currentStepId: definition.initial_step_id,
        state: initialState as any,
        objectionsEncountered: [],
        escapeAttempts: 0,
        confidenceHistory: [],
      },
    });

    // Set as active talk on conversation
    await tx.conversation.update({
      where: { id: data.conversationId },
      data: { activeTalkId: talk.id },
    });

    // Create talk_started event
    await tx.talkEvent.create({
      data: {
        talkId: talk.id,
        eventType: 'talk_started',
        data: {
          treeFlowId: data.treeFlowId,
          treeFlowVersionId: treeFlow.activeVersion!.id,
          initialStepId: definition.initial_step_id,
        },
        actorType: 'system',
      },
    });

    return { talk, talkFlow };
  });

  return result;
}

export async function pauseTalk(accountId: string, talkId: string, actorId?: string) {
  const prisma = getPrisma();

  const talk = await prisma.talk.findFirst({
    where: { id: talkId, accountId, status: 'active' },
  });

  if (!talk) {
    throw { statusCode: 404, message: 'Active talk not found', code: 'TALK_NOT_FOUND' };
  }

  return prisma.$transaction(async (tx) => {
    const updated = await tx.talk.update({
      where: { id: talkId },
      data: { status: 'paused', pausedAt: new Date() },
    });

    // Remove from active talk on conversation if this is the active one
    await tx.conversation.updateMany({
      where: { id: talk.conversationId, activeTalkId: talkId },
      data: { activeTalkId: null },
    });

    await tx.talkEvent.create({
      data: {
        talkId,
        eventType: 'talk_paused',
        data: {},
        actorType: actorId ? 'agent' : 'system',
        actorId: actorId ?? null,
      },
    });

    return updated;
  });
}

export async function resumeTalk(accountId: string, talkId: string, actorId?: string) {
  const prisma = getPrisma();

  const talk = await prisma.talk.findFirst({
    where: { id: talkId, accountId, status: 'paused' },
  });

  if (!talk) {
    throw { statusCode: 404, message: 'Paused talk not found', code: 'TALK_NOT_FOUND' };
  }

  return prisma.$transaction(async (tx) => {
    const updated = await tx.talk.update({
      where: { id: talkId },
      data: {
        status: 'active',
        resumedAt: new Date(),
        lastActivityAt: new Date(),
      },
    });

    // Set as active talk on conversation
    await tx.conversation.update({
      where: { id: talk.conversationId },
      data: { activeTalkId: talkId },
    });

    await tx.talkEvent.create({
      data: {
        talkId,
        eventType: 'talk_resumed',
        data: {},
        actorType: actorId ? 'agent' : 'system',
        actorId: actorId ?? null,
      },
    });

    return updated;
  });
}

export async function closeTalk(accountId: string, talkId: string, reason: string, actorId?: string) {
  const prisma = getPrisma();

  const talk = await prisma.talk.findFirst({
    where: { id: talkId, accountId, status: { in: ['active', 'paused'] } },
    include: { talkFlow: true },
  });

  if (!talk) {
    throw { statusCode: 404, message: 'Talk not found or already closed', code: 'TALK_NOT_FOUND' };
  }

  const closeStatus = reason === 'inactivity' ? 'closed_inactivity' : reason === 'completed' ? 'completed' : 'closed_manual';

  return prisma.$transaction(async (tx) => {
    // Snapshot the TalkFlow state before closing
    if (talk.talkFlow) {
      await tx.talkFlow.update({
        where: { id: talk.talkFlow.id },
        data: {
          snapshot: {
            state: talk.talkFlow.state,
            currentStepId: talk.talkFlow.currentStepId,
            objectionsEncountered: talk.talkFlow.objectionsEncountered,
            escapeAttempts: talk.talkFlow.escapeAttempts,
            closedAt: new Date().toISOString(),
            closeReason: reason,
          },
        },
      });
    }

    const updated = await tx.talk.update({
      where: { id: talkId },
      data: { status: closeStatus, closedAt: new Date() },
    });

    // Remove from active talk on conversation
    await tx.conversation.updateMany({
      where: { id: talk.conversationId, activeTalkId: talkId },
      data: { activeTalkId: null },
    });

    // If this talk has a parent, resume the parent
    if (talk.parentTalkId) {
      const parentTalk = await tx.talk.findFirst({
        where: { id: talk.parentTalkId, status: 'paused' },
      });

      if (parentTalk) {
        await tx.talk.update({
          where: { id: parentTalk.id },
          data: {
            status: 'active',
            resumedAt: new Date(),
            lastActivityAt: new Date(),
          },
        });

        await tx.conversation.update({
          where: { id: parentTalk.conversationId },
          data: { activeTalkId: parentTalk.id },
        });

        await tx.talkEvent.create({
          data: {
            talkId: parentTalk.id,
            eventType: 'talk_resumed',
            data: { reason: 'sub_talk_completed', subTalkId: talkId },
            actorType: 'system',
          },
        });
      }
    }

    await tx.talkEvent.create({
      data: {
        talkId,
        eventType: 'talk_closed',
        data: { reason, status: closeStatus },
        actorType: actorId ? 'agent' : 'system',
        actorId: actorId ?? null,
      },
    });

    return updated;
  });
}

export async function changeStep(accountId: string, talkId: string, targetStepId: string, actorId: string) {
  const prisma = getPrisma();

  const talk = await prisma.talk.findFirst({
    where: { id: talkId, accountId, status: 'active' },
    include: {
      talkFlow: true,
      treeFlowVersion: { select: { definition: true } },
    },
  });

  if (!talk) {
    throw { statusCode: 404, message: 'Active talk not found', code: 'TALK_NOT_FOUND' };
  }

  if (!talk.talkFlow) {
    throw { statusCode: 500, message: 'Talk has no TalkFlow', code: 'NO_TALKFLOW' };
  }

  const definition = talk.treeFlowVersion.definition as unknown as TreeFlowDefinition;
  const targetStep = definition.steps.find((s) => s.id === targetStepId);

  if (!targetStep) {
    throw { statusCode: 400, message: `Step "${targetStepId}" not found in definition`, code: 'INVALID_STEP' };
  }

  const state = talk.talkFlow.state as unknown as TalkFlowState;
  const now = new Date().toISOString();

  // Close current step entry
  const updatedHistory = state.step_history.map((entry) => {
    if (entry.step_id === talk.talkFlow!.currentStepId && !entry.exited_at) {
      return { ...entry, exited_at: now, exit_reason: 'manual' as const };
    }
    return entry;
  });

  // Add new step entry
  updatedHistory.push({
    step_id: targetStepId,
    entered_at: now,
    exited_at: null,
    exit_reason: null,
  });

  const updatedState: TalkFlowState = {
    ...state,
    step_history: updatedHistory,
    messages_in_current_step: 0,
  };

  return prisma.$transaction(async (tx) => {
    await tx.talkFlow.update({
      where: { id: talk.talkFlow!.id },
      data: {
        currentStepId: targetStepId,
        state: updatedState as any,
      },
    });

    await tx.talkEvent.create({
      data: {
        talkId,
        eventType: 'step_changed',
        data: {
          from_step_id: talk.talkFlow!.currentStepId,
          to_step_id: targetStepId,
          reason: 'manual',
        },
        actorType: 'agent',
        actorId,
      },
    });

    return { previousStepId: talk.talkFlow!.currentStepId, currentStepId: targetStepId };
  });
}

export async function listEvents(accountId: string, talkId: string, opts?: {
  eventType?: string;
  limit?: number;
  offset?: number;
}) {
  const prisma = getPrisma();

  // Verify talk belongs to account
  const talk = await prisma.talk.findFirst({
    where: { id: talkId, accountId },
    select: { id: true },
  });

  if (!talk) {
    throw { statusCode: 404, message: 'Talk not found', code: 'TALK_NOT_FOUND' };
  }

  return prisma.talkEvent.findMany({
    where: {
      talkId,
      ...(opts?.eventType ? { eventType: opts.eventType } : {}),
    },
    include: {
      actor: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: opts?.limit ?? 100,
    skip: opts?.offset ?? 0,
  });
}
