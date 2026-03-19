import { Worker, Job, Queue } from 'bullmq';
import { getRedis } from '../config/redis.js';
import { getPrisma } from '../config/database.js';
import { Server as SocketIOServer } from 'socket.io';
import { getWhatsAppProvider } from '../providers/factory.js';
import type { NormalizedMessage } from '../providers/whatsapp.interface.js';

// ════════════════════════════════════════════════════════════
// Webhook Process Worker
// Queue: webhook:process
// Processes incoming webhooks from WhatsApp providers:
// 1. Normalize payload
// 2. Find or create contact
// 3. Find or create conversation
// 4. Insert message
// 5. Trigger automation + talk routing
// ════════════════════════════════════════════════════════════

export interface WebhookProcessJobData {
  webhookEventId: string;
  inboxId: string;
  accountId: string;
  provider: string;
  eventType: string;
  payload: Record<string, any>;
}

// NormalizedMessage is now imported from providers/whatsapp.interface.ts

// Singleton queues to avoid per-job connection overhead
let _automationQueue: Queue | null = null;
let _talkRouteQueue: Queue | null = null;

function getAutomationQueue(): Queue {
  if (!_automationQueue) {
    _automationQueue = new Queue('automation-evaluate', { connection: getRedis() as any });
  }
  return _automationQueue;
}

function getTalkRouteQueue(): Queue {
  if (!_talkRouteQueue) {
    _talkRouteQueue = new Queue('talk-route-message', { connection: getRedis() as any });
  }
  return _talkRouteQueue;
}

export function createWebhookProcessWorker(io: SocketIOServer): Worker {
  const worker = new Worker<WebhookProcessJobData>(
    'webhook-process',
    async (job: Job<WebhookProcessJobData>) => {
      const prisma = getPrisma();
      const { webhookEventId, inboxId, accountId, provider, eventType, payload } = job.data;

      job.log(`Processing webhook ${webhookEventId} (${provider}/${eventType})`);

      // Check if already processed
      const webhookEvent = await prisma.webhookEvent.findUnique({
        where: { id: webhookEventId },
      });

      if (!webhookEvent) {
        job.log('Webhook event not found, skipping');
        return { skipped: true, reason: 'not_found' };
      }

      if (webhookEvent.processed) {
        job.log('Already processed, skipping');
        return { skipped: true, reason: 'already_processed' };
      }

      // ── 1. Normalize payload ──
      // Load inbox provider config for LID resolution
      const inbox = await prisma.inbox.findUnique({
        where: { id: inboxId },
        select: { providerConfig: true },
      });
      const providerConfig = (inbox?.providerConfig ?? {}) as Record<string, any>;

      // Use provider adapter for normalization (provider-agnostic)
      const whatsappProvider = getWhatsAppProvider(provider);
      const normalized = await whatsappProvider.normalizeIncomingWebhook(eventType, payload, providerConfig);

      if (!normalized) {
        // Not a message event (e.g., status update) — mark processed and skip
        await prisma.webhookEvent.update({
          where: { id: webhookEventId },
          data: { processed: true },
        });
        job.log('Not a message event, skipping');
        return { skipped: true, reason: 'not_message_event' };
      }

      // ── Group message branch ──
      if (normalized.groupJid) {
        return processGroupMessage(prisma, job, normalized, inboxId, accountId, webhookEventId, io, whatsappProvider, providerConfig);
      }

      // For fromMe messages, senderPhone is the remote contact (who we're talking to)
      // because Evolution API remoteJid is always the other party
      const isOutgoing = !!normalized.isFromMe;

      // ── 2. Find or create contact ──
      const sourceId = `${normalized.senderPhone}@s.whatsapp.net`;

      let contactInbox = await prisma.contactInbox.findUnique({
        where: {
          inboxId_sourceId: { inboxId, sourceId },
        },
        include: { contact: true },
      });

      let contactId: string;

      if (!contactInbox) {
        // Try to find existing contact by phone (supports provider migration:
        // same person, different inbox/provider → reuse existing contact)
        let contact = await prisma.contact.findFirst({
          where: { accountId, phone: normalized.senderPhone },
        });

        if (!contact) {
          contact = await prisma.contact.create({
            data: {
              accountId,
              name: normalized.senderName ?? normalized.senderPhone,
              phone: normalized.senderPhone,
            },
          });
          job.log(`Created new contact ${contact.id} (${normalized.senderPhone})`);
          fetchAndUpdateAvatar(contact.id, normalized.senderPhone, whatsappProvider, providerConfig);
          syncContactNameFromCRM(contact.id, normalized.senderPhone, normalized.senderName);
        } else {
          job.log(`Reusing existing contact ${contact.id} for new inbox`);
          if (!contact.avatarUrl) {
            fetchAndUpdateAvatar(contact.id, normalized.senderPhone, whatsappProvider, providerConfig);
          }
          // Sync name from CRM if contact still has phone as name
          if (contact.name === normalized.senderPhone || contact.name === normalized.senderName) {
            syncContactNameFromCRM(contact.id, normalized.senderPhone, contact.name);
          }
        }

        contactInbox = await prisma.contactInbox.create({
          data: {
            contactId: contact.id,
            inboxId,
            sourceId,
          },
          include: { contact: true },
        });

        contactId = contact.id;
      } else {
        contactId = contactInbox.contactId;

        // Update contact name if we got a new one
        if (normalized.senderName && contactInbox.contact.name === normalized.senderPhone) {
          await prisma.contact.update({
            where: { id: contactId },
            data: { name: normalized.senderName },
          });
        }

        // Fetch avatar if missing
        if (!contactInbox.contact.avatarUrl) {
          fetchAndUpdateAvatar(contactId, normalized.senderPhone, whatsappProvider, providerConfig);
        }
      }

      // ── 3. Find or create conversation (1:1 only — exclude group conversations) ──
      let conversation = await prisma.conversation.findFirst({
        where: {
          accountId,
          contactId,
          inboxId,
          groupId: null, // IMPORTANT: only match 1:1 conversations, never groups
          status: { in: ['open', 'pending'] },
        },
        orderBy: { lastActivityAt: 'desc' },
      });

      if (!conversation) {
        conversation = await prisma.conversation.create({
          data: {
            accountId,
            inboxId,
            contactId,
            contactInboxId: contactInbox.id,
            status: 'open',
          },
        });
        job.log(`Created new conversation ${conversation.id}`);
      }

      // ── 4. Insert message (atomic dedup via transaction) ──
      const message = await prisma.$transaction(async (tx) => {
        const existing = await tx.message.findFirst({
          where: { externalMessageId: normalized.externalMessageId, conversationId: conversation!.id },
          select: { id: true },
        });
        if (existing) return null; // duplicate

        return tx.message.create({
          data: {
            accountId,
            conversationId: conversation!.id,
            inboxId,
            senderType: isOutgoing ? 'user' : 'contact',
            senderId: isOutgoing ? null : contactId,
            senderContactId: isOutgoing ? null : contactId,
            content: normalized.content,
            messageType: isOutgoing ? 'outgoing' : 'incoming',
            contentType: normalized.contentType,
            contentAttributes: normalized.contentAttributes as any,
            status: 'delivered',
            externalMessageId: normalized.externalMessageId,
            createdAt: normalized.timestamp,
            updatedAt: normalized.timestamp,
          },
        });
      });

      if (!message) {
        await prisma.webhookEvent.update({ where: { id: webhookEventId }, data: { processed: true } });
        job.log(`Duplicate message ${normalized.externalMessageId}, skipping`);
        return { skipped: true, reason: 'duplicate_message' };
      }

      // Update conversation
      await prisma.conversation.update({
        where: { id: conversation.id },
        data: {
          lastActivityAt: new Date(),
          // Only increment unread for incoming messages
          ...(isOutgoing ? {} : { unreadCount: { increment: 1 } }),
          status: conversation.status === 'resolved' ? 'open' : conversation.status,
        },
      });

      // Mark webhook as processed
      await prisma.webhookEvent.update({
        where: { id: webhookEventId },
        data: { processed: true },
      });

      // ── 5. Emit WebSocket ──
      io.to(`conversation:${conversation.id}`).emit('message:created', {
        message: {
          id: message.id,
          conversationId: conversation.id,
          content: message.content,
          senderType: message.senderType,
          messageType: message.messageType,
          contentType: message.contentType,
          status: message.status,
          createdAt: message.createdAt,
        },
      });

      // Fetch updated conversation for accurate unreadCount
      const updatedConv = await prisma.conversation.findUnique({
        where: { id: conversation.id },
        select: { unreadCount: true },
      });

      io.to(`account:${accountId}`).emit('conversation:updated', {
        conversationId: conversation.id,
        lastActivityAt: new Date(),
        unreadCount: updatedConv?.unreadCount ?? 0,
      });

      // ── 6. Trigger automation + talk routing ──
      await getAutomationQueue().add('evaluate', {
        accountId,
        eventName: 'message_created',
        eventData: {
          messageId: message.id,
          conversationId: conversation.id,
          contactId,
          inboxId,
          content: normalized.content,
          contentType: normalized.contentType,
          senderType: 'contact',
        },
      });

      await getTalkRouteQueue().add('route', {
        accountId,
        conversationId: conversation.id,
        messageId: message.id,
        messageContent: normalized.content ?? '',
        messageSenderType: 'contact',
      });

      job.log(`Message ${message.id} created, automation + talk routing enqueued`);
      return {
        messageId: message.id,
        conversationId: conversation.id,
        contactId,
        isNewConversation: !conversation,
      };
    },
    {
      connection: getRedis() as any,
      concurrency: 10,
      limiter: {
        max: 100,
        duration: 1000,
      },
    },
  );

  worker.on('completed', (job) => {
    console.log(`[webhook:process] Job ${job.id} completed`);
  });

  worker.on('failed', (job, err) => {
    console.error(`[webhook:process] Job ${job?.id} failed:`, err.message);
  });

  return worker;
}

// ── Group Message Processing ──

async function processGroupMessage(
  prisma: ReturnType<typeof getPrisma>,
  job: Job<WebhookProcessJobData>,
  normalized: NormalizedMessage,
  inboxId: string,
  accountId: string,
  webhookEventId: string,
  io: SocketIOServer,
  whatsappProvider: import('../providers/whatsapp.interface.js').IWhatsAppProvider,
  providerConfig: Record<string, any>,
) {
  const groupJid = normalized.groupJid!;
  const participantPhone = normalized.participantPhone ?? normalized.senderPhone;

  // ── 1. Find or create Group ──
  let group = await prisma.group.findUnique({
    where: { inboxId_jid: { inboxId, jid: groupJid } },
  });

  if (!group) {
    group = await prisma.group.create({
      data: {
        accountId,
        inboxId,
        jid: groupJid,
        name: groupJid, // will be updated below
      },
    });
    job.log(`Created new group ${group.id} (${groupJid})`);

    // Fetch group name in background
    fetchAndUpdateGroupName(group.id, groupJid, whatsappProvider.providerName, providerConfig);
  }

  // ── 2. Find or create sender Contact ──
  let contact = await prisma.contact.findFirst({
    where: { accountId, phone: participantPhone },
  });

  if (!contact) {
    contact = await prisma.contact.create({
      data: {
        accountId,
        name: normalized.senderName ?? participantPhone,
        phone: participantPhone,
      },
    });
    job.log(`Created new contact ${contact.id} (${participantPhone})`);
    fetchAndUpdateAvatar(contact.id, participantPhone, whatsappProvider, providerConfig);
    syncContactNameFromCRM(contact.id, participantPhone, normalized.senderName);
  } else {
    if (normalized.senderName && contact.name === participantPhone) {
      await prisma.contact.update({
        where: { id: contact.id },
        data: { name: normalized.senderName },
      });
    }
    if (!contact.avatarUrl) {
      fetchAndUpdateAvatar(contact.id, participantPhone, whatsappProvider, providerConfig);
    }
    // Sync name from CRM if still using pushName or phone
    if (contact.name === participantPhone || contact.name === normalized.senderName) {
      syncContactNameFromCRM(contact.id, participantPhone, contact.name);
    }
  }

  // ── 3. Find or create GroupMember ──
  await prisma.groupMember.upsert({
    where: { groupId_contactId: { groupId: group.id, contactId: contact.id } },
    create: { groupId: group.id, contactId: contact.id, role: 'member' },
    update: {}, // no-op if already exists
  });

  // ── 4. Find or create group Conversation ──
  // For groups, reuse any existing conversation (including resolved) to avoid duplicates
  let conversation = await prisma.conversation.findFirst({
    where: {
      accountId,
      groupId: group.id,
      inboxId,
      deletedAt: null,
    },
    orderBy: { lastActivityAt: 'desc' },
  });

  if (!conversation) {
    // Find or create ContactInbox for the first participant
    const groupContactInbox = await prisma.contactInbox.findFirst({
      where: { contactId: contact.id, inboxId },
    });

    conversation = await prisma.conversation.create({
      data: {
        accountId,
        inboxId,
        contactId: contact.id, // first participant becomes the conversation contact
        contactInboxId: groupContactInbox?.id ?? null,
        groupId: group.id,
        status: 'open',
      },
    });
    job.log(`Created new group conversation ${conversation.id}`);
  }

  // ── 5. Insert message (atomic dedup via transaction) ──
  const isGroupOutgoing = !!normalized.isFromMe;

  const message = await prisma.$transaction(async (tx) => {
    const existing = await tx.message.findFirst({
      where: { externalMessageId: normalized.externalMessageId, conversationId: conversation!.id },
      select: { id: true },
    });
    if (existing) return null;

    return tx.message.create({
      data: {
        accountId,
        conversationId: conversation!.id,
        inboxId,
        senderType: isGroupOutgoing ? 'user' : 'contact',
        senderId: isGroupOutgoing ? null : contact.id,
        senderContactId: isGroupOutgoing ? null : contact.id,
        content: normalized.content,
        messageType: isGroupOutgoing ? 'outgoing' : 'incoming',
        contentType: normalized.contentType,
        contentAttributes: normalized.contentAttributes as any,
        status: 'delivered',
        externalMessageId: normalized.externalMessageId,
        createdAt: normalized.timestamp,
        updatedAt: normalized.timestamp,
      },
    });
  });

  if (!message) {
    await prisma.webhookEvent.update({ where: { id: webhookEventId }, data: { processed: true } });
    job.log(`Duplicate message ${normalized.externalMessageId}, skipping`);
    return { skipped: true, reason: 'duplicate_message' };
  }

  // Update conversation
  await prisma.conversation.update({
    where: { id: conversation.id },
    data: {
      lastActivityAt: new Date(),
      ...(isGroupOutgoing ? {} : { unreadCount: { increment: 1 } }),
      status: conversation.status === 'resolved' ? 'open' : conversation.status,
    },
  });

  // Mark webhook as processed
  await prisma.webhookEvent.update({
    where: { id: webhookEventId },
    data: { processed: true },
  });

  // ── 6. Emit WebSocket ──
  io.to(`conversation:${conversation.id}`).emit('message:created', {
    message: {
      id: message.id,
      conversationId: conversation.id,
      content: message.content,
      senderType: message.senderType,
      senderContactId: message.senderContactId,
      messageType: message.messageType,
      contentType: message.contentType,
      status: message.status,
      createdAt: message.createdAt,
    },
    group: { id: group.id, jid: groupJid, name: group.name },
  });

  // Fetch updated conversation for accurate unreadCount
  const updatedGroupConv = await prisma.conversation.findUnique({
    where: { id: conversation.id },
    select: { unreadCount: true },
  });

  io.to(`account:${accountId}`).emit('conversation:updated', {
    conversationId: conversation.id,
    lastActivityAt: new Date(),
    unreadCount: updatedGroupConv?.unreadCount ?? 0,
    groupId: group.id,
  });

  // ── 7. Trigger automation + talk routing ──
  await getAutomationQueue().add('evaluate', {
    accountId,
    eventName: 'message_created',
    eventData: {
      messageId: message.id,
      conversationId: conversation.id,
      contactId: contact.id,
      inboxId,
      content: normalized.content,
      contentType: normalized.contentType,
      senderType: 'contact',
      groupId: group.id,
      groupJid,
    },
  });

  await getTalkRouteQueue().add('route', {
    accountId,
    conversationId: conversation.id,
    messageId: message.id,
    messageContent: normalized.content ?? '',
    messageSenderType: 'contact',
  });

  job.log(`Group message ${message.id} created in group ${group.id}`);
  return {
    messageId: message.id,
    conversationId: conversation.id,
    contactId: contact.id,
    groupId: group.id,
  };
}

// ── Helper Functions ──
// Note: Provider-specific normalization (LID resolution, payload parsing, avatar fetching)
// is now handled by the provider adapters in src/providers/*/
// [REMOVED] resolveLidToPhone, extractPicFilename, normalizePayload,
// normalizeEvolutionAPI, normalizeCloudAPI — all moved to provider adapters.
// See: src/providers/evolution/evolution.adapter.ts
// See: src/providers/cloud-api/cloud.adapter.ts

// ── Profile Picture Fetch (fire-and-forget) ──

function fetchAndUpdateAvatar(
  contactId: string,
  phone: string,
  whatsappProvider: import('../providers/whatsapp.interface.js').IWhatsAppProvider,
  providerConfig: Record<string, any>,
): void {
  whatsappProvider.fetchProfilePicture(providerConfig, phone)
    .then((url) => {
      if (!url) return;
      return getPrisma().contact.update({
        where: { id: contactId },
        data: { avatarUrl: url },
      });
    })
    .catch(() => { /* non-critical */ });
}

// ── CRM Name Sync (fire-and-forget) ──
// Calls the CRM Hub to resolve the contact's official name from Pipedrive/CRM
// and updates the contact name in vialum-chat if found.

function syncContactNameFromCRM(
  contactId: string,
  phone: string,
  contactName: string | null,
): void {
  const crmUrl = process.env.CRM_HUB_URL;
  if (!crmUrl) return;

  // Call CRM Hub lookup endpoint
  fetch(`${crmUrl}/api/v1/contacts/lookup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      vialumContactId: contactId,
      phone,
      name: contactName,
    }),
  })
    .then((res) => res.ok ? res.json() : null)
    .then((data: any) => {
      const crmName = data?.data?.name;
      if (!crmName || crmName === contactName) return;

      // Also check integrations for Pipedrive person name
      const integrations = data?.data?.integrations ?? [];
      const pipedrivePersonName = integrations.find(
        (i: any) => i.provider === 'pipedrive' && i.resourceType === 'person',
      )?.resourceName;

      const officialName = pipedrivePersonName || crmName;
      if (!officialName) return;

      return getPrisma().contact.update({
        where: { id: contactId },
        data: { name: officialName },
      });
    })
    .catch(() => { /* non-critical */ });
}

function fetchAndUpdateGroupName(
  groupId: string,
  groupJid: string,
  providerName: string,
  providerConfig: Record<string, any>,
): void {
  import('../providers/factory.js').then(({ getGroupProvider }) => {
    const groupProvider = getGroupProvider(providerName);
    if (!groupProvider) return;

    groupProvider.getGroupInfo(providerConfig, groupJid)
      .then((info) => {
        if (!info.name) return;
        return getPrisma().group.update({
          where: { id: groupId },
          data: {
            name: info.name,
            description: info.description ?? null,
            profilePicUrl: info.profilePicUrl ?? null,
          },
        });
      })
      .catch(() => { /* non-critical */ });
  }).catch(() => {});
}
