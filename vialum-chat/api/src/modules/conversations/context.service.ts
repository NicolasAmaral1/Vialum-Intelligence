import { getPrisma } from '../../config/database.js';
import { getRedis } from '../../config/redis.js';
import { getEnv } from '../../config/env.js';
import { getDisplayName, formatPhoneBR } from '../../lib/contact-utils.js';
import crypto from 'node:crypto';

// ════════════════════════════════════════════════════════════
// Context Service — Returns full conversation context in 1 call
//
// Design: 2 sequential rounds, max 4 DB queries + 1 cached HTTP
// Round 1: conversation bundle (1 query)
// Round 2 (parallel): messages + CRM cache/fetch + cross-channel
//
// Scalability:
// - CRM data cached in Redis 5min per (phone, accountId)
// - Hub call has 500ms timeout with graceful degradation
// - textContent excluded by default (opt-in for AI callers)
// - Cross-channel only queries if linkedGroupId is set
// - Zero calls to Media or Switch (data already in messages table)
// ════════════════════════════════════════════════════════════

export interface ContextParams {
  limit?: number;
  includeTextContent?: boolean;
}

export async function getConversationContext(
  accountId: string,
  conversationId: string,
  userId: string,
  params: ContextParams,
) {
  const prisma = getPrisma();
  const limit = Math.min(params.limit ?? 30, 100);
  const includeTextContent = params.includeTextContent ?? false;

  // ── Round 1: Conversation bundle (1 query with JOINs) ──
  const conv = await prisma.conversation.findFirst({
    where: { id: conversationId, accountId, deletedAt: null },
    include: {
      contact: {
        select: {
          id: true, name: true, customName: true, crmName: true,
          phone: true, email: true, avatarUrl: true, hubContactId: true,
          funnelStage: true, customAttributes: true,
        },
      },
      inbox: { select: { id: true, name: true, channelType: true, provider: true } },
      assignee: { select: { id: true, name: true, email: true, avatarUrl: true } },
      group: {
        select: {
          id: true, jid: true, name: true, groupType: true,
          profilePicUrl: true, description: true,
          members: {
            select: {
              role: true,
              contact: { select: { id: true, name: true, phone: true } },
            },
          },
        },
      },
      conversationLabels: {
        include: { label: { select: { id: true, name: true, color: true } } },
      },
      activeTalk: {
        select: {
          id: true, status: true, treeFlowId: true,
          treeFlow: { select: { name: true, slug: true, category: true } },
          talkFlow: { select: { currentStepId: true, state: true } },
        },
      },
      contactInbox: {
        select: {
          id: true, activeConversationId: true, linkedGroupId: true,
        },
      },
    },
  });

  if (!conv) {
    throw { statusCode: 404, message: 'Conversation not found', code: 'CONVERSATION_NOT_FOUND' };
  }

  // ── Round 2: Parallel — messages + CRM + cross-channel ──
  const [messages, crmResult, crossChannel] = await Promise.all([
    fetchMessages(conversationId, accountId, limit, includeTextContent),
    conv.contact?.phone
      ? fetchCrmData(conv.contact.phone, accountId)
      : Promise.resolve({ data: null, error: null }),
    fetchCrossChannelSummary(
      prisma, accountId, conv.contact?.id, conv.inbox.id,
      conversationId, conv.contactInbox?.linkedGroupId ?? null, conv.groupId ?? null,
    ),
  ]);

  // ── Compute derived fields ──
  const conversationType = conv.groupId ? 'group' : 'individual';
  const activeConvId = conv.contactInbox?.activeConversationId;
  const activeChannel = activeConvId
    ? (activeConvId === conversationId ? conversationType : (conversationType === 'group' ? 'individual' : 'group'))
    : null;

  const hint = generateHint(
    conversationType as 'group' | 'individual',
    activeChannel as 'group' | 'individual' | null,
    !!conv.contactInbox?.linkedGroupId,
    !!crossChannel,
  );

  return {
    conversation: {
      id: conv.id,
      status: conv.status,
      unreadCount: conv.unreadCount,
      lastActivityAt: conv.lastActivityAt,
      customAttributes: conv.customAttributes,
    },
    inbox: conv.inbox,
    contact: conv.contact ? {
      ...conv.contact,
      displayName: getDisplayName(conv.contact),
      formattedPhone: formatPhoneBR(conv.contact.phone),
    } : null,
    assignee: conv.assignee,
    labels: conv.conversationLabels.map((cl) => cl.label),
    messages: messages.reverse(), // chronological order
    activeTalk: conv.activeTalk ? {
      id: conv.activeTalk.id,
      status: conv.activeTalk.status,
      treeFlow: conv.activeTalk.treeFlow,
      currentStepId: conv.activeTalk.talkFlow?.currentStepId ?? null,
      state: conv.activeTalk.talkFlow?.state ?? null,
    } : null,
    group: conv.group,
    crmData: crmResult.data,
    crmError: crmResult.error,
    activeChannel,
    crossChannelSummary: crossChannel,
    hint,
  };
}

// ── Messages query ──

async function fetchMessages(
  conversationId: string,
  accountId: string,
  limit: number,
  includeTextContent: boolean,
) {
  const prisma = getPrisma();
  return prisma.message.findMany({
    where: { conversationId, accountId },
    select: {
      id: true,
      content: true,
      messageType: true,
      contentType: true,
      contentAttributes: true,
      status: true,
      private: true,
      createdAt: true,
      senderType: true,
      senderContact: { select: { id: true, name: true, phone: true } },
      ...(includeTextContent ? { textContent: true } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
}

// ── CRM data with Redis cache + Hub timeout ──

async function fetchCrmData(
  phone: string,
  accountId: string,
): Promise<{ data: unknown; error: string | null }> {
  const redis = getRedis();
  const env = getEnv();
  const cacheKey = `crm-context:${accountId}:${phone}`;

  // 1. Check cache
  const cached = await redis.get(cacheKey);
  if (cached) {
    return { data: JSON.parse(cached), error: null };
  }

  // 2. Call Hub
  const hubUrl = env.HUB_URL ?? env.CRM_HUB_URL;
  if (!hubUrl) return { data: null, error: 'hub_not_configured' };

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2000);

    const token = generateServiceToken(accountId);
    const response = await fetch(`${hubUrl}/api/v1/agent/query`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ intent: 'full_profile', identifier: { phone } }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) return { data: null, error: `hub_error_${response.status}` };

    const result = await response.json() as { data: unknown };

    // 3. Cache 5min
    await redis.set(cacheKey, JSON.stringify(result.data), 'EX', 300);
    return { data: result.data, error: null };
  } catch (err: unknown) {
    const e = err as { name?: string };
    if (e.name === 'AbortError') return { data: null, error: 'timeout' };
    return { data: null, error: 'hub_unavailable' };
  }
}

// ── Cross-channel summary ──

async function fetchCrossChannelSummary(
  prisma: ReturnType<typeof getPrisma>,
  accountId: string,
  contactId: string | undefined,
  inboxId: string,
  currentConversationId: string,
  linkedGroupId: string | null,
  currentGroupId: string | null,
) {
  if (!contactId || !linkedGroupId) return null;

  // Find the "other" conversation
  const otherConv = await prisma.conversation.findFirst({
    where: {
      accountId,
      contactId,
      inboxId,
      id: { not: currentConversationId },
      deletedAt: null,
      // If current is 1:1, find the group conv. If current is group, find 1:1.
      groupId: currentGroupId ? null : linkedGroupId,
    },
    orderBy: { lastActivityAt: 'desc' },
    select: { id: true, groupId: true, status: true },
  });

  if (!otherConv) return null;

  const messages = await prisma.message.findMany({
    where: { conversationId: otherConv.id, accountId },
    select: {
      id: true, content: true, messageType: true, contentType: true,
      createdAt: true, senderType: true,
      senderContact: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 5,
  });

  return {
    conversationId: otherConv.id,
    channelType: otherConv.groupId ? 'group' : 'individual',
    status: otherConv.status,
    messages: messages.reverse(),
  };
}

// ── Hint generator ──

function generateHint(
  conversationType: 'group' | 'individual',
  activeChannel: 'group' | 'individual' | null,
  hasLinkedGroup: boolean,
  hasCrossChannel: boolean,
): string {
  const parts: string[] = [];

  if (activeChannel) {
    parts.push(`Canal principal: ${activeChannel === 'group' ? 'grupo' : 'privado'}.`);
  } else {
    parts.push('Nenhum canal principal definido.');
  }

  if (conversationType === 'individual' && activeChannel === 'group') {
    parts.push('Mensagem chegou no privado, mas o canal principal é o grupo.');
  } else if (conversationType === 'group' && activeChannel === 'individual') {
    parts.push('Mensagem chegou no grupo, mas o canal principal é o privado.');
  }

  if (hasCrossChannel) {
    parts.push('Contexto do outro canal incluído.');
  }

  if (hasLinkedGroup && conversationType === 'individual') {
    parts.push('Contato tem grupo vinculado.');
  }

  return parts.join(' ');
}

// ── Service token (same pattern as hub-ensure worker) ──

function generateServiceToken(accountId: string): string {
  const env = getEnv();
  const secret = env.MEDIA_JWT_SECRET;
  if (!secret) return '';

  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  const payload = Buffer.from(JSON.stringify({
    userId: 'chat-context', accountId, role: 'service',
    iat: now, exp: now + 300,
  })).toString('base64url');
  const signature = crypto.createHmac('sha256', secret).update(`${header}.${payload}`).digest('base64url');
  return `${header}.${payload}.${signature}`;
}
