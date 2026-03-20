import { getPrisma } from '../../config/database.js';
import { Prisma } from '@prisma/client';
import { getAccessibleInboxIds } from '../inboxes/inbox-access.service.js';
import { getDisplayName, formatPhoneBR } from '../../lib/contact-utils.js';

export interface ConversationFilters {
  status?: string;
  inboxId?: string;
  labelId?: string;
  assigneeId?: string;
  search?: string;
  page?: number;
  limit?: number;
  userId?: string; // for RLS inbox filtering
}

export interface CreateConversationInput {
  inboxId: string;
  contactId: string;
  contactInboxId?: string | null;
  assigneeId?: string | null;
  status?: string;
  customAttributes?: Record<string, unknown>;
  additionalAttributes?: Record<string, unknown>;
}

export interface UpdateConversationInput {
  assigneeId?: string | null;
  status?: string;
  customAttributes?: Record<string, unknown>;
  additionalAttributes?: Record<string, unknown>;
  snoozedUntil?: string | null;
}

export async function findAll(accountId: string, filters: ConversationFilters) {
  const prisma = getPrisma();
  const page = filters.page ?? 1;
  const limit = Math.min(filters.limit ?? 25, 100);
  const skip = (page - 1) * limit;

  const where: Prisma.ConversationWhereInput = {
    accountId,
    deletedAt: null,
  };

  // RLS: restrict to accessible inboxes based on user role
  // Even admins default to their own inboxes unless explicitly requesting all or a specific inbox
  if (filters.userId && !filters.inboxId) {
    const accessibleInboxIds = await getAccessibleInboxIds(accountId, filters.userId);
    if (accessibleInboxIds !== null) {
      if (accessibleInboxIds.length === 0) {
        return { data: [], meta: { total: 0, page, limit, totalPages: 0 } };
      }
      where.inboxId = { in: accessibleInboxIds };
    }
    // null = admin/owner — if no specific inboxId filter, still applies below
  }

  if (filters.status) {
    where.status = filters.status;
  }

  if (filters.inboxId) {
    // If user specified a specific inbox, intersect with accessible inboxes
    if (where.inboxId && typeof where.inboxId === 'object' && 'in' in where.inboxId) {
      const allowed = where.inboxId.in as string[];
      if (!allowed.includes(filters.inboxId)) {
        return { data: [], meta: { total: 0, page, limit, totalPages: 0 } };
      }
    }
    where.inboxId = filters.inboxId;
  }

  if (filters.assigneeId) {
    where.assigneeId = filters.assigneeId === 'unassigned' ? null : filters.assigneeId;
  }

  if (filters.labelId) {
    where.conversationLabels = {
      some: { labelId: filters.labelId },
    };
  }

  if (filters.search) {
    where.contact = {
      OR: [
        { name: { contains: filters.search, mode: 'insensitive' } },
        { phone: { contains: filters.search, mode: 'insensitive' } },
        { email: { contains: filters.search, mode: 'insensitive' } },
      ],
    };
  }

  const [data, total] = await Promise.all([
    prisma.conversation.findMany({
      where,
      include: {
        contact: { select: { id: true, name: true, customName: true, crmName: true, phone: true, email: true, avatarUrl: true } },
        inbox: { select: { id: true, name: true, channelType: true, provider: true } },
        assignee: { select: { id: true, name: true, avatarUrl: true } },
        group: { select: { id: true, jid: true, name: true, groupType: true, profilePicUrl: true } },
        conversationLabels: {
          include: { label: { select: { id: true, name: true, color: true } } },
        },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { id: true, content: true, contentType: true, messageType: true, createdAt: true, senderContactId: true, senderContact: { select: { id: true, name: true, phone: true } } },
        },
      },
      orderBy: { lastActivityAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.conversation.count({ where }),
  ]);

  return {
    data: data.map((conv) => ({
      ...conv,
      contact: conv.contact ? {
        ...conv.contact,
        displayName: getDisplayName(conv.contact),
        formattedPhone: formatPhoneBR(conv.contact.phone),
      } : conv.contact,
      labels: conv.conversationLabels.map((cl) => cl.label),
      lastMessage: conv.messages[0] ?? null,
      conversationLabels: undefined,
      messages: undefined,
    })),
    meta: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  };
}

export async function create(accountId: string, data: CreateConversationInput) {
  const prisma = getPrisma();

  return prisma.conversation.create({
    data: {
      accountId,
      inboxId: data.inboxId,
      contactId: data.contactId,
      contactInboxId: data.contactInboxId ?? null,
      assigneeId: data.assigneeId ?? null,
      status: data.status ?? 'open',
      customAttributes: (data.customAttributes ?? {}) as any,
      additionalAttributes: (data.additionalAttributes ?? {}) as any,
    },
    include: {
      contact: { select: { id: true, name: true, customName: true, crmName: true, phone: true, email: true, avatarUrl: true } },
      inbox: { select: { id: true, name: true, channelType: true, provider: true } },
      assignee: { select: { id: true, name: true, avatarUrl: true } },
    },
  });
}

export async function findById(accountId: string, conversationId: string) {
  const prisma = getPrisma();

  const conversation = await prisma.conversation.findFirst({
    where: { id: conversationId, accountId, deletedAt: null },
    include: {
      contact: { select: { id: true, name: true, customName: true, crmName: true, phone: true, email: true, avatarUrl: true, customAttributes: true, funnelStage: true } },
      inbox: { select: { id: true, name: true, channelType: true, provider: true } },
      assignee: { select: { id: true, name: true, email: true, avatarUrl: true } },
      group: { select: { id: true, jid: true, name: true, groupType: true, profilePicUrl: true, description: true } },
      conversationLabels: {
        include: { label: { select: { id: true, name: true, color: true } } },
      },
      activeTalk: {
        select: {
          id: true,
          status: true,
          treeFlowId: true,
          treeFlow: { select: { name: true, slug: true, category: true } },
          talkFlow: { select: { currentStepId: true } },
        },
      },
      _count: {
        select: {
          aiSuggestions: { where: { status: 'pending' } },
        },
      },
    },
  });

  if (!conversation) {
    throw { statusCode: 404, message: 'Conversation not found', code: 'CONVERSATION_NOT_FOUND' };
  }

  return {
    ...conversation,
    contact: conversation.contact ? {
      ...conversation.contact,
      displayName: getDisplayName(conversation.contact),
      formattedPhone: formatPhoneBR(conversation.contact.phone),
    } : conversation.contact,
    labels: conversation.conversationLabels.map((cl) => cl.label),
    pendingSuggestionsCount: conversation._count.aiSuggestions,
    conversationLabels: undefined,
    _count: undefined,
  };
}

export async function update(accountId: string, conversationId: string, data: UpdateConversationInput) {
  const prisma = getPrisma();

  const existing = await prisma.conversation.findFirst({
    where: { id: conversationId, accountId, deletedAt: null },
  });

  if (!existing) {
    throw { statusCode: 404, message: 'Conversation not found', code: 'CONVERSATION_NOT_FOUND' };
  }

  // Validate assigneeId is a valid AccountUser for this account
  if (data.assigneeId) {
    const accountUser = await prisma.accountUser.findFirst({
      where: { userId: data.assigneeId, accountId },
    });
    if (!accountUser) {
      throw { statusCode: 400, message: 'Assignee is not a member of this account', code: 'INVALID_ASSIGNEE' };
    }
  }

  return prisma.conversation.update({
    where: { id: conversationId },
    data: {
      ...(data.assigneeId !== undefined && { assigneeId: data.assigneeId }),
      ...(data.status !== undefined && { status: data.status }),
      ...(data.customAttributes !== undefined && { customAttributes: data.customAttributes as any }),
      ...(data.additionalAttributes !== undefined && { additionalAttributes: data.additionalAttributes as any }),
      ...(data.snoozedUntil !== undefined && {
        snoozedUntil: data.snoozedUntil ? new Date(data.snoozedUntil) : null,
      }),
      lastActivityAt: new Date(),
    },
    include: {
      contact: { select: { id: true, name: true, customName: true, crmName: true, phone: true, avatarUrl: true } },
      inbox: { select: { id: true, name: true } },
      assignee: { select: { id: true, name: true, avatarUrl: true } },
    },
  });
}

export async function resolve(accountId: string, conversationId: string) {
  const prisma = getPrisma();

  const existing = await prisma.conversation.findFirst({
    where: { id: conversationId, accountId, deletedAt: null },
  });

  if (!existing) {
    throw { statusCode: 404, message: 'Conversation not found', code: 'CONVERSATION_NOT_FOUND' };
  }

  return prisma.conversation.update({
    where: { id: conversationId },
    data: {
      status: 'resolved',
      lastActivityAt: new Date(),
    },
  });
}

export async function reopen(accountId: string, conversationId: string) {
  const prisma = getPrisma();

  const existing = await prisma.conversation.findFirst({
    where: { id: conversationId, accountId, deletedAt: null },
  });

  if (!existing) {
    throw { statusCode: 404, message: 'Conversation not found', code: 'CONVERSATION_NOT_FOUND' };
  }

  return prisma.conversation.update({
    where: { id: conversationId },
    data: {
      status: 'open',
      snoozedUntil: null,
      lastActivityAt: new Date(),
    },
  });
}

export async function addLabel(accountId: string, conversationId: string, labelId: string) {
  const prisma = getPrisma();

  // Verify conversation belongs to account
  const conversation = await prisma.conversation.findFirst({
    where: { id: conversationId, accountId, deletedAt: null },
  });

  if (!conversation) {
    throw { statusCode: 404, message: 'Conversation not found', code: 'CONVERSATION_NOT_FOUND' };
  }

  // Verify label belongs to account
  const label = await prisma.label.findFirst({
    where: { id: labelId, accountId },
  });

  if (!label) {
    throw { statusCode: 404, message: 'Label not found', code: 'LABEL_NOT_FOUND' };
  }

  // Upsert (ignore if already exists)
  await prisma.conversationLabel.upsert({
    where: {
      conversationId_labelId: { conversationId, labelId },
    },
    create: { conversationId, labelId },
    update: {},
  });

  return { conversationId, labelId };
}

export async function removeLabel(accountId: string, conversationId: string, labelId: string) {
  const prisma = getPrisma();

  const conversation = await prisma.conversation.findFirst({
    where: { id: conversationId, accountId, deletedAt: null },
  });

  if (!conversation) {
    throw { statusCode: 404, message: 'Conversation not found', code: 'CONVERSATION_NOT_FOUND' };
  }

  await prisma.conversationLabel.deleteMany({
    where: { conversationId, labelId },
  });
}
