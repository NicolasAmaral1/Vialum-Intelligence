import { getPrisma } from '../../config/database.js';
import {
  LoadedTalkContext,
  LoadedObjection,
  TalkFlowState,
  TreeFlowDefinition,
  TreeFlowSettings,
  DEFAULT_TREEFLOW_SETTINGS,
  DEFAULT_TALKFLOW_STATE,
} from '../treeflow/treeflow.types.js';

// ════════════════════════════════════════════════════════════
// [2] TalkFlow Loader
// ════════════════════════════════════════════════════════════

const RECENT_MESSAGES_LIMIT = 30;

/**
 * Loads the full context needed by the AI analyzer:
 * - Talk + TalkFlow from DB
 * - TreeFlowVersion.definition
 * - Objections linked via tree_flow_objections
 * - Last N messages from talk_messages
 * - Contact data
 */
export async function loadTalkContext(talkId: string): Promise<LoadedTalkContext> {
  const prisma = getPrisma();

  // Load Talk with all relations
  const talk = await prisma.talk.findUniqueOrThrow({
    where: { id: talkId },
    include: {
      talkFlow: true,
      treeFlow: {
        select: { id: true, settings: true },
      },
      treeFlowVersion: {
        select: { id: true, definition: true },
      },
      contact: {
        select: {
          id: true,
          name: true,
          phone: true,
          email: true,
          customAttributes: true,
          funnelStage: true,
        },
      },
    },
  });

  if (!talk.talkFlow) {
    throw new Error(`Talk ${talkId} has no TalkFlow record`);
  }

  // Parse definition and settings
  const definition = talk.treeFlowVersion.definition as unknown as TreeFlowDefinition;
  const settings: TreeFlowSettings = {
    ...DEFAULT_TREEFLOW_SETTINGS,
    ...((talk.treeFlow.settings as Record<string, unknown>) ?? {}),
  };

  // Find current step in definition
  const currentStep = definition.steps.find((s) => s.id === talk.talkFlow!.currentStepId);
  if (!currentStep) {
    throw new Error(
      `Current step "${talk.talkFlow.currentStepId}" not found in TreeFlow definition for Talk ${talkId}`,
    );
  }

  // Load objections linked to this TreeFlow
  const treeFlowObjections = await prisma.treeFlowObjection.findMany({
    where: { treeFlowId: talk.treeFlowId },
    include: {
      objection: true,
    },
    orderBy: { priority: 'desc' },
  });

  // Filter objections relevant to current step (empty stepIds = all steps)
  const objections: LoadedObjection[] = treeFlowObjections
    .filter((tfo) => {
      const stepIds = tfo.stepIds as string[];
      return stepIds.length === 0 || stepIds.includes(talk.talkFlow!.currentStepId);
    })
    .map((tfo) => ({
      id: tfo.objection.id,
      name: tfo.objection.name,
      category: tfo.objection.category,
      description: tfo.objection.description,
      detectionHints: tfo.objection.detectionHints as string[],
      rebuttalStrategy: tfo.objection.rebuttalStrategy,
      rebuttalExamples: tfo.objection.rebuttalExamples as string[],
      severity: tfo.objection.severity,
      stepIds: tfo.stepIds as string[],
      priority: tfo.priority,
    }));

  // Load recent messages linked to this talk
  const talkMessages = await prisma.talkMessage.findMany({
    where: { talkId },
    include: {
      message: {
        select: {
          id: true,
          content: true,
          senderType: true,
          messageType: true,
          createdAt: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: RECENT_MESSAGES_LIMIT,
  });

  const recentMessages = talkMessages
    .map((tm) => ({
      id: tm.message.id,
      content: tm.message.content,
      senderType: tm.message.senderType,
      messageType: tm.message.messageType,
      createdAt: tm.message.createdAt,
    }))
    .reverse(); // Oldest first for prompt context

  // Parse TalkFlow state
  const state = (talk.talkFlow.state as unknown as TalkFlowState) ?? DEFAULT_TALKFLOW_STATE;
  const objectionsEncountered = (talk.talkFlow.objectionsEncountered as string[]) ?? [];
  const confidenceHistory = (talk.talkFlow.confidenceHistory as number[]) ?? [];

  return {
    talk: {
      id: talk.id,
      accountId: talk.accountId,
      conversationId: talk.conversationId,
      contactId: talk.contactId,
      treeFlowId: talk.treeFlowId,
      treeFlowVersionId: talk.treeFlowVersionId,
      status: talk.status,
      parentTalkId: talk.parentTalkId,
      metadata: (talk.metadata as Record<string, unknown>) ?? {},
    },
    talkFlow: {
      id: talk.talkFlow.id,
      currentStepId: talk.talkFlow.currentStepId,
      state,
      objectionsEncountered,
      escapeAttempts: talk.talkFlow.escapeAttempts,
      confidenceHistory,
    },
    definition,
    currentStep,
    settings,
    objections,
    recentMessages,
    contact: {
      id: talk.contact.id,
      name: talk.contact.name,
      phone: talk.contact.phone,
      email: talk.contact.email,
      customAttributes: (talk.contact.customAttributes as Record<string, unknown>) ?? {},
      funnelStage: talk.contact.funnelStage,
    },
  };
}
