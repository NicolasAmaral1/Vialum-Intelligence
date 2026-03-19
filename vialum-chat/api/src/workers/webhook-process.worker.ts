import { Worker, Job, Queue } from 'bullmq';
import { getRedis } from '../config/redis.js';
import { getPrisma } from '../config/database.js';
import { Server as SocketIOServer } from 'socket.io';

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

interface NormalizedMessage {
  externalMessageId: string;
  senderPhone: string;
  senderName: string | null;
  content: string | null;
  contentType: string;
  contentAttributes: Record<string, any>;
  timestamp: Date;
  groupJid?: string;         // e.g. "120363XXXXX@g.us" (null for 1:1)
  participantPhone?: string; // who sent within the group
  isFromMe?: boolean;        // true = sent by us (outgoing from phone/web)
}

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

      const normalized = await normalizePayload(provider, eventType, payload, providerConfig);

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
        return processGroupMessage(prisma, job, normalized, inboxId, accountId, webhookEventId, io, provider, providerConfig);
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
          fetchAndUpdateAvatar(contact.id, normalized.senderPhone, provider, providerConfig);
          syncContactNameFromCRM(contact.id, normalized.senderPhone, normalized.senderName);
        } else {
          job.log(`Reusing existing contact ${contact.id} for new inbox`);
          if (!contact.avatarUrl) {
            fetchAndUpdateAvatar(contact.id, normalized.senderPhone, provider, providerConfig);
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
          fetchAndUpdateAvatar(contactId, normalized.senderPhone, provider, providerConfig);
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

      // ── 4. Insert message (dedup check) ──
      const existingMsg = await prisma.message.findFirst({
        where: { externalMessageId: normalized.externalMessageId, conversationId: conversation.id },
        select: { id: true },
      });

      if (existingMsg) {
        await prisma.webhookEvent.update({ where: { id: webhookEventId }, data: { processed: true } });
        job.log(`Duplicate message ${normalized.externalMessageId}, skipping`);
        return { skipped: true, reason: 'duplicate_message', messageId: existingMsg.id };
      }

      const message = await prisma.message.create({
        data: {
          accountId,
          conversationId: conversation.id,
          inboxId,
          senderType: isOutgoing ? 'user' : 'contact',
          senderId: isOutgoing ? null : contactId,
          senderContactId: isOutgoing ? null : contactId,
          content: normalized.content,
          messageType: isOutgoing ? 'outgoing' : 'incoming',
          contentType: normalized.contentType,
          contentAttributes: normalized.contentAttributes,
          status: 'delivered',
          externalMessageId: normalized.externalMessageId,
          createdAt: normalized.timestamp,
          updatedAt: normalized.timestamp,
        },
      });

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
  provider: string,
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
    fetchAndUpdateGroupName(group.id, groupJid, provider, providerConfig);
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
    fetchAndUpdateAvatar(contact.id, participantPhone, provider, providerConfig);
    syncContactNameFromCRM(contact.id, participantPhone, normalized.senderName);
  } else {
    if (normalized.senderName && contact.name === participantPhone) {
      await prisma.contact.update({
        where: { id: contact.id },
        data: { name: normalized.senderName },
      });
    }
    if (!contact.avatarUrl) {
      fetchAndUpdateAvatar(contact.id, participantPhone, provider, providerConfig);
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

  // ── 5. Insert message with senderContactId (dedup check) ──
  const existingMessage = await prisma.message.findFirst({
    where: { externalMessageId: normalized.externalMessageId, conversationId: conversation.id },
    select: { id: true },
  });

  if (existingMessage) {
    // Already processed — mark webhook and skip
    await prisma.webhookEvent.update({ where: { id: webhookEventId }, data: { processed: true } });
    job.log(`Duplicate message ${normalized.externalMessageId}, skipping`);
    return { skipped: true, reason: 'duplicate_message', messageId: existingMessage.id };
  }

  const isGroupOutgoing = !!normalized.isFromMe;

  const message = await prisma.message.create({
    data: {
      accountId,
      conversationId: conversation.id,
      inboxId,
      senderType: isGroupOutgoing ? 'user' : 'contact',
      senderId: isGroupOutgoing ? null : contact.id,
      senderContactId: isGroupOutgoing ? null : contact.id,
      content: normalized.content,
      messageType: isGroupOutgoing ? 'outgoing' : 'incoming',
      contentType: normalized.contentType,
      contentAttributes: normalized.contentAttributes,
      status: 'delivered',
      externalMessageId: normalized.externalMessageId,
      createdAt: normalized.timestamp,
      updatedAt: normalized.timestamp,
    },
  });

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

// ── LID → Phone Resolution ──

/**
 * Resolves a WhatsApp LID to a real phone number by querying
 * the Evolution API's contacts and matching by profile picture.
 * Results are cached in Redis for 30 days.
 */
async function resolveLidToPhone(
  providerConfig: Record<string, any>,
  lid: string,
): Promise<string | null> {
  const redis = getRedis();

  // Check Redis cache
  const cacheKey = `lid:${lid}`;
  const cached = await redis.get(cacheKey);
  if (cached) return cached;

  const baseUrl = providerConfig.base_url ?? providerConfig.baseUrl;
  const instanceName = providerConfig.instance_name ?? providerConfig.instanceName;
  const apiKey = providerConfig.api_key ?? providerConfig.apiKey;

  if (!baseUrl || !instanceName || !apiKey) {
    console.warn('[LID resolver] Missing Evolution API config, cannot resolve LID');
    return null;
  }

  try {
    // Query Evolution API for all contacts
    const response = await fetch(`${baseUrl}/chat/findContacts/${instanceName}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: apiKey },
      body: JSON.stringify({ where: {} }),
    });

    if (!response.ok) {
      console.warn(`[LID resolver] Evolution API returned ${response.status}`);
      return null;
    }

    const contacts = await response.json() as Array<{
      remoteJid: string;
      profilePicUrl: string | null;
      pushName: string | null;
    }>;

    // Find the LID contact
    const lidJid = `${lid}@lid`;
    const lidContact = contacts.find((c) => c.remoteJid === lidJid);

    if (!lidContact?.profilePicUrl) {
      console.warn(`[LID resolver] LID ${lid} not found or has no profile pic`);
      return null;
    }

    // Extract profile pic filename (stable identifier)
    const lidPicFile = extractPicFilename(lidContact.profilePicUrl);
    if (!lidPicFile) return null;

    // Find matching @s.whatsapp.net contact with same profile pic
    for (const contact of contacts) {
      if (!contact.remoteJid.includes('@s.whatsapp.net')) continue;
      if (!contact.profilePicUrl) continue;

      const contactPicFile = extractPicFilename(contact.profilePicUrl);
      if (contactPicFile === lidPicFile) {
        const phone = contact.remoteJid.replace('@s.whatsapp.net', '');
        // Cache for 30 days
        await redis.set(cacheKey, phone, 'EX', 86400 * 30);
        console.log(`[LID resolver] Resolved ${lid} → ${phone}`);
        return phone;
      }
    }

    console.warn(`[LID resolver] No phone match found for LID ${lid}`);
    return null;
  } catch (err) {
    console.error('[LID resolver] Error:', err);
    return null;
  }
}

/** Extract the stable filename from a WhatsApp profile pic URL */
function extractPicFilename(url: string): string | null {
  try {
    const path = new URL(url).pathname;
    const parts = path.split('/');
    return parts[parts.length - 1] ?? null;
  } catch {
    return null;
  }
}

// ── Payload Normalization ──

async function normalizePayload(
  provider: string,
  eventType: string,
  payload: Record<string, any>,
  providerConfig: Record<string, any>,
): Promise<NormalizedMessage | null> {
  if (provider === 'evolution_api') {
    return normalizeEvolutionAPI(eventType, payload, providerConfig);
  } else if (provider === 'cloud_api') {
    return normalizeCloudAPI(eventType, payload);
  }
  return null;
}

async function normalizeEvolutionAPI(
  eventType: string,
  payload: Record<string, any>,
  providerConfig: Record<string, any>,
): Promise<NormalizedMessage | null> {
  // Evolution API sends different event types
  if (eventType !== 'messages.upsert' && eventType !== 'MESSAGES_UPSERT') {
    return null;
  }

  const data = payload.data ?? payload;
  const key = data.key;
  const msg = data.message;

  const isFromMe = !!key?.fromMe;

  // Extract sender phone from remoteJid
  let senderPhone: string;
  const remoteJid = (key?.remoteJid ?? '') as string;

  let groupJid: string | undefined;
  let participantPhone: string | undefined;

  if (remoteJid.includes('@g.us')) {
    // Group message: remoteJid = group JID, key.participant = sender JID
    groupJid = remoteJid;
    const participantJid = (key?.participant ?? '') as string;

    if (participantJid.includes('@lid')) {
      // Resolve LID to phone number
      const lid = participantJid.replace('@lid', '');
      const resolved = await resolveLidToPhone(providerConfig, lid);
      participantPhone = resolved ?? lid;
    } else {
      participantPhone = participantJid.replace('@s.whatsapp.net', '');
    }
    senderPhone = participantPhone;
  } else if (remoteJid.includes('@lid')) {
    // LID format — resolve to real phone number via Evolution API
    const lid = remoteJid.replace('@lid', '');
    const resolved = await resolveLidToPhone(providerConfig, lid);
    if (resolved) {
      senderPhone = resolved;
    } else {
      // Fallback: store LID as identifier (message will be received but replies may fail)
      console.warn(`[webhook] Could not resolve LID ${lid}, using LID as identifier`);
      senderPhone = lid;
    }
  } else {
    senderPhone = remoteJid.replace('@s.whatsapp.net', '');
  }

  if (!senderPhone) return null;

  let content: string | null = null;
  let contentType = 'text';
  const contentAttributes: Record<string, any> = {};

  if (msg?.conversation) {
    content = msg.conversation;
  } else if (msg?.extendedTextMessage?.text) {
    content = msg.extendedTextMessage.text;
  } else if (msg?.imageMessage) {
    contentType = 'image';
    content = msg.imageMessage.caption ?? null;
    contentAttributes.mimetype = msg.imageMessage.mimetype;
    contentAttributes.url = msg.imageMessage.url;
  } else if (msg?.audioMessage) {
    contentType = 'audio';
    contentAttributes.mimetype = msg.audioMessage.mimetype;
    contentAttributes.seconds = msg.audioMessage.seconds;
    contentAttributes.ptt = msg.audioMessage.ptt;
  } else if (msg?.videoMessage) {
    contentType = 'video';
    content = msg.videoMessage.caption ?? null;
    contentAttributes.mimetype = msg.videoMessage.mimetype;
  } else if (msg?.documentMessage) {
    contentType = 'document';
    content = msg.documentMessage.fileName ?? null;
    contentAttributes.mimetype = msg.documentMessage.mimetype;
    contentAttributes.fileName = msg.documentMessage.fileName;
  } else if (msg?.stickerMessage) {
    contentType = 'sticker';
  } else if (msg?.locationMessage) {
    contentType = 'location';
    contentAttributes.latitude = msg.locationMessage.degreesLatitude;
    contentAttributes.longitude = msg.locationMessage.degreesLongitude;
  }

  return {
    externalMessageId: key?.id ?? `evo_${Date.now()}`,
    senderPhone,
    senderName: data.pushName ?? null,
    content,
    contentType,
    contentAttributes,
    timestamp: new Date(data.messageTimestamp ? data.messageTimestamp * 1000 : Date.now()),
    groupJid,
    participantPhone,
    isFromMe,
  };
}

function normalizeCloudAPI(
  eventType: string,
  payload: Record<string, any>,
): NormalizedMessage | null {
  // Meta Cloud API webhook structure
  const entry = payload.entry?.[0];
  const changes = entry?.changes?.[0];
  const value = changes?.value;

  if (!value?.messages?.[0]) return null;

  const msg = value.messages[0];
  const contact = value.contacts?.[0];

  let content: string | null = null;
  let contentType = 'text';
  const contentAttributes: Record<string, any> = {};

  switch (msg.type) {
    case 'text':
      content = msg.text?.body ?? null;
      contentType = 'text';
      break;
    case 'image':
      contentType = 'image';
      content = msg.image?.caption ?? null;
      contentAttributes.mediaId = msg.image?.id;
      contentAttributes.mimetype = msg.image?.mime_type;
      break;
    case 'audio':
      contentType = 'audio';
      contentAttributes.mediaId = msg.audio?.id;
      contentAttributes.mimetype = msg.audio?.mime_type;
      break;
    case 'video':
      contentType = 'video';
      content = msg.video?.caption ?? null;
      contentAttributes.mediaId = msg.video?.id;
      break;
    case 'document':
      contentType = 'document';
      content = msg.document?.filename ?? null;
      contentAttributes.mediaId = msg.document?.id;
      contentAttributes.fileName = msg.document?.filename;
      break;
    case 'sticker':
      contentType = 'sticker';
      contentAttributes.mediaId = msg.sticker?.id;
      break;
    case 'location':
      contentType = 'location';
      contentAttributes.latitude = msg.location?.latitude;
      contentAttributes.longitude = msg.location?.longitude;
      break;
    default:
      content = `[${msg.type}]`;
      break;
  }

  return {
    externalMessageId: msg.id,
    senderPhone: msg.from,
    senderName: contact?.profile?.name ?? null,
    content,
    contentType,
    contentAttributes,
    timestamp: new Date(parseInt(msg.timestamp, 10) * 1000),
  };
}

// ── Profile Picture Fetch (fire-and-forget) ──

function fetchAndUpdateAvatar(
  contactId: string,
  phone: string,
  provider: string,
  providerConfig: Record<string, any>,
): void {
  if (provider !== 'evolution_api') return;

  const baseUrl = providerConfig.base_url ?? providerConfig.baseUrl;
  const instanceName = providerConfig.instance_name ?? providerConfig.instanceName;
  const apiKey = providerConfig.api_key ?? providerConfig.apiKey;

  fetch(`${baseUrl}/chat/fetchProfilePictureUrl/${instanceName}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: apiKey },
    body: JSON.stringify({ number: phone }),
  })
    .then((res) => res.ok ? res.json() : null)
    .then((data: any) => {
      const url = data?.profilePictureUrl;
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
  provider: string,
  providerConfig: Record<string, any>,
): void {
  if (provider !== 'evolution_api') return;

  const baseUrl = providerConfig.base_url ?? providerConfig.baseUrl;
  const instanceName = providerConfig.instance_name ?? providerConfig.instanceName;
  const apiKey = providerConfig.api_key ?? providerConfig.apiKey;

  fetch(`${baseUrl}/group/findGroupInfos/${instanceName}?groupJid=${groupJid}`, {
    method: 'GET',
    headers: { apikey: apiKey },
  })
    .then((res) => res.ok ? res.json() : null)
    .then((data: any) => {
      if (!data?.subject) return;
      return getPrisma().group.update({
        where: { id: groupId },
        data: {
          name: data.subject,
          description: data.description ?? null,
          profilePicUrl: data.pictureUrl ?? null,
        },
      });
    })
    .catch(() => { /* non-critical */ });
}
