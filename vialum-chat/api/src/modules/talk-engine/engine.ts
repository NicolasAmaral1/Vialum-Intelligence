import { Server as SocketIOServer } from 'socket.io';
import { getPrisma } from '../../config/database.js';
import { EngineContext, RoutingResult, DecisionResult } from '../treeflow/treeflow.types.js';
import { routeMessage } from './router.js';
import { loadTalkContext } from './loader.js';
import { analyzeMessage } from './analyzer.js';
import { applyStateDiff } from './state-applier.js';
import { evaluateDecision } from './decision-gate.js';
import { runPostProcessing } from './post-processor.js';

// ════════════════════════════════════════════════════════════
// Talk Engine — 6-Stage Pipeline Orchestrator
// ════════════════════════════════════════════════════════════

export interface EngineResult {
  routed: boolean;
  talkId: string | null;
  routingConfidence: number;
  decision: DecisionResult | null;
  stepChanged: boolean;
  talkCompleted: boolean;
  subTalkSpawned: string | null;
  error: string | null;
}

/**
 * Full pipeline entry point: route an incoming message through stages [1]-[6].
 * Called by the talk:route-message worker after a new incoming message is persisted.
 */
export async function processIncomingMessage(
  context: EngineContext,
  io: SocketIOServer,
): Promise<EngineResult> {
  const prisma = getPrisma();

  // ── [1] Route Message to correct Talk ──
  const routing: RoutingResult = await routeMessage(context);

  if (!routing.talkId) {
    // No active talk for this conversation — skip pipeline
    return {
      routed: false,
      talkId: null,
      routingConfidence: 0,
      decision: null,
      stepChanged: false,
      talkCompleted: false,
      subTalkSpawned: null,
      error: null,
    };
  }

  // Create TalkMessage link
  await prisma.talkMessage.create({
    data: {
      talkId: routing.talkId,
      messageId: context.messageId,
      routingConfidence: routing.confidence,
      routedBy: routing.routedBy === 'ai' ? 'ai' : routing.routedBy === 'direct' ? 'system' : 'system',
    },
  });

  // ── [2] Load TalkFlow context ──
  const talkContext = await loadTalkContext(routing.talkId);

  // ── [3] AI Analyzer ──
  const aiResponse = await analyzeMessage(talkContext, context.messageContent);

  // ── [4] Apply State Diff ──
  const stateResult = await applyStateDiff(talkContext, aiResponse, context.messageId);

  // ── [5] Decision Gate ──
  const decision = await evaluateDecision(
    talkContext,
    aiResponse,
    stateResult,
  );

  // ── [6] Post Processing ──
  const postResult = await runPostProcessing(
    talkContext,
    stateResult,
    decision,
    io,
  );

  return {
    routed: true,
    talkId: routing.talkId,
    routingConfidence: routing.confidence,
    decision,
    stepChanged: postResult.stepChanged,
    talkCompleted: postResult.talkCompleted,
    subTalkSpawned: postResult.subTalkSpawned,
    error: null,
  };
}

/**
 * Run stages [2]-[6] directly for a known Talk (used by talk:analyze worker).
 */
export async function analyzeTalkMessage(
  talkId: string,
  messageId: string,
  messageContent: string,
  io: SocketIOServer,
): Promise<EngineResult> {
  // ── [2] Load TalkFlow context ──
  const talkContext = await loadTalkContext(talkId);

  // ── [3] AI Analyzer ──
  const aiResponse = await analyzeMessage(talkContext, messageContent);

  // ── [4] Apply State Diff ──
  const stateResult = await applyStateDiff(talkContext, aiResponse, messageId);

  // ── [5] Decision Gate ──
  const decision = await evaluateDecision(talkContext, aiResponse, stateResult);

  // ── [6] Post Processing ──
  const postResult = await runPostProcessing(talkContext, stateResult, decision, io);

  return {
    routed: true,
    talkId,
    routingConfidence: 1.0,
    decision,
    stepChanged: postResult.stepChanged,
    talkCompleted: postResult.talkCompleted,
    subTalkSpawned: postResult.subTalkSpawned,
    error: null,
  };
}
