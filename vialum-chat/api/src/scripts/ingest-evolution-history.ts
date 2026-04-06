/**
 * Ingest historical conversations from Evolution API into Vialum Chat.
 *
 * Usage:
 *   npx tsx src/scripts/ingest-evolution-history.ts
 *
 * Environment: Uses the same DB connection as the main app.
 * Idempotent: skips messages that already exist (by externalMessageId).
 */

import { getPrisma, disconnectPrisma } from '../config/database.js';

// ── Config (from environment) ──
if (!process.env.EVOLUTION_BASE_URL || !process.env.EVOLUTION_API_KEY || !process.env.EVOLUTION_INSTANCE || !process.env.INGEST_INBOX_ID || !process.env.INGEST_ACCOUNT_ID) {
  console.error('Missing required env vars: EVOLUTION_BASE_URL, EVOLUTION_API_KEY, EVOLUTION_INSTANCE, INGEST_INBOX_ID, INGEST_ACCOUNT_ID');
  process.exit(1);
}
const EVOLUTION_BASE_URL = process.env.EVOLUTION_BASE_URL as string;
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY as string;
const EVOLUTION_INSTANCE = process.env.EVOLUTION_INSTANCE as string;
const INBOX_ID = process.env.INGEST_INBOX_ID as string;
const ACCOUNT_ID = process.env.INGEST_ACCOUNT_ID as string;

// ── Types ──
interface EvoChat {
  id: string;
  remoteJid: string;
  pushName: string | null;
  profilePicUrl: string | null;
  updatedAt: string;
  lastMessage?: Record<string, any>;
}

interface EvoMessage {
  id: string;
  key: {
    id: string;
    fromMe: boolean;
    remoteJid: string;
    participant?: string;
  };
  pushName: string | null;
  messageType: string;
  message: Record<string, any>;
  messageTimestamp: number;
  source: string;
  status: string;
}

// ── Evolution API helpers ──
async function evoFetch<T>(path: string, body?: Record<string, any>): Promise<T> {
  const url = `${EVOLUTION_BASE_URL}${path}`;
  const opts: RequestInit = {
    headers: { 'Content-Type': 'application/json', apikey: EVOLUTION_API_KEY },
  };
  if (body) {
    opts.method = 'POST';
    opts.body = JSON.stringify(body);
  }
  const res = await fetch(url, opts);
  if (!res.ok) throw new Error(`Evolution API ${res.status}: ${await res.text()}`);
  return res.json() as Promise<T>;
}

async function fetchAllChats(): Promise<EvoChat[]> {
  return evoFetch<EvoChat[]>(`/chat/findChats/${EVOLUTION_INSTANCE}`, {});
}

async function fetchMessages(remoteJid: string, page: number = 1): Promise<{ total: number; pages: number; records: EvoMessage[] }> {
  const result = await evoFetch<{ messages: { total: number; pages: number; currentPage: number; records: EvoMessage[] } }>(
    `/chat/findMessages/${EVOLUTION_INSTANCE}`,
    { where: { key: { remoteJid } }, page, limit: 100 },
  );
  return result.messages;
}

// ── Message content extraction (mirrors webhook normalizer) ──
function extractContent(msg: Record<string, any>): { content: string | null; contentType: string; contentAttributes: Record<string, any> } {
  const contentAttributes: Record<string, any> = {};

  if (msg?.conversation) {
    return { content: msg.conversation, contentType: 'text', contentAttributes };
  }
  if (msg?.extendedTextMessage?.text) {
    return { content: msg.extendedTextMessage.text, contentType: 'text', contentAttributes };
  }
  if (msg?.imageMessage) {
    contentAttributes.mimetype = msg.imageMessage.mimetype;
    return { content: msg.imageMessage.caption ?? null, contentType: 'image', contentAttributes };
  }
  if (msg?.audioMessage) {
    contentAttributes.mimetype = msg.audioMessage.mimetype;
    contentAttributes.seconds = msg.audioMessage.seconds;
    contentAttributes.ptt = msg.audioMessage.ptt;
    return { content: null, contentType: 'audio', contentAttributes };
  }
  if (msg?.videoMessage) {
    contentAttributes.mimetype = msg.videoMessage.mimetype;
    return { content: msg.videoMessage.caption ?? null, contentType: 'video', contentAttributes };
  }
  if (msg?.documentMessage) {
    contentAttributes.mimetype = msg.documentMessage.mimetype;
    contentAttributes.fileName = msg.documentMessage.fileName;
    return { content: msg.documentMessage.fileName ?? null, contentType: 'document', contentAttributes };
  }
  if (msg?.stickerMessage) {
    return { content: null, contentType: 'sticker', contentAttributes };
  }
  if (msg?.locationMessage) {
    contentAttributes.latitude = msg.locationMessage.degreesLatitude;
    contentAttributes.longitude = msg.locationMessage.degreesLongitude;
    return { content: null, contentType: 'location', contentAttributes };
  }

  // Unknown type — store raw type as content
  const type = Object.keys(msg || {}).find((k) => k.endsWith('Message')) ?? 'unknown';
  return { content: `[${type}]`, contentType: 'text', contentAttributes };
}

function extractPhone(jid: string): string {
  return jid.replace(/@s\.whatsapp\.net$/, '').replace(/@lid$/, '');
}

// ── Main ──
async function main() {
  const prisma = getPrisma();

  console.log('Fetching chats from Evolution API...');
  const allChats = await fetchAllChats();

  // Filter: only 1:1 chats (skip groups and @lid for now)
  const directChats = allChats.filter((c) => c.remoteJid.endsWith('@s.whatsapp.net'));
  const groupChats = allChats.filter((c) => c.remoteJid.endsWith('@g.us'));

  console.log(`Total chats: ${allChats.length}`);
  console.log(`Direct (1:1): ${directChats.length}`);
  console.log(`Groups: ${groupChats.length}`);
  console.log(`LID/other: ${allChats.length - directChats.length - groupChats.length}`);
  console.log('');

  let totalMessages = 0;
  let totalCreated = 0;
  let totalSkipped = 0;
  let totalContacts = 0;
  let totalConversations = 0;

  // ── Process direct chats ──
  console.log('=== Processing direct chats ===');
  for (let i = 0; i < directChats.length; i++) {
    const chat = directChats[i];
    const phone = extractPhone(chat.remoteJid);
    const sourceId = chat.remoteJid; // e.g. 5547999999999@s.whatsapp.net

    console.log(`[${i + 1}/${directChats.length}] ${phone} (${chat.pushName ?? '?'})...`);

    // 1. Upsert contact
    let contact = await prisma.contact.findFirst({
      where: { accountId: ACCOUNT_ID, phone },
    });

    if (!contact) {
      contact = await prisma.contact.create({
        data: {
          accountId: ACCOUNT_ID,
          name: chat.pushName ?? phone,
          phone,
          avatarUrl: chat.profilePicUrl,
        },
      });
      totalContacts++;
    } else if (chat.profilePicUrl && !contact.avatarUrl) {
      await prisma.contact.update({
        where: { id: contact.id },
        data: { avatarUrl: chat.profilePicUrl },
      });
    }

    // 2. Upsert ContactInbox
    let contactInbox = await prisma.contactInbox.findUnique({
      where: { inboxId_sourceId: { inboxId: INBOX_ID, sourceId } },
    });

    if (!contactInbox) {
      contactInbox = await prisma.contactInbox.create({
        data: {
          contactId: contact.id,
          inboxId: INBOX_ID,
          sourceId,
        },
      });
    }

    // 3. Find or create conversation (use a single "resolved" conversation for historical data)
    let conversation = await prisma.conversation.findFirst({
      where: {
        accountId: ACCOUNT_ID,
        contactId: contact.id,
        inboxId: INBOX_ID,
      },
      orderBy: { lastActivityAt: 'desc' },
    });

    if (!conversation) {
      conversation = await prisma.conversation.create({
        data: {
          accountId: ACCOUNT_ID,
          inboxId: INBOX_ID,
          contactId: contact.id,
          contactInboxId: contactInbox.id,
          status: 'resolved',
          lastActivityAt: new Date(chat.updatedAt),
        },
      });
      totalConversations++;
    }

    // 4. Fetch all pages of messages
    let page = 1;
    let pages = 1;
    let chatCreated = 0;

    do {
      const result = await fetchMessages(chat.remoteJid, page);
      pages = result.pages;

      for (const evoMsg of result.records) {
        totalMessages++;

        const externalMessageId = evoMsg.key.id;

        // Dedup check
        const existing = await prisma.message.findFirst({
          where: { externalMessageId, conversationId: conversation.id },
          select: { id: true },
        });

        if (existing) {
          totalSkipped++;
          continue;
        }

        const { content, contentType, contentAttributes } = extractContent(evoMsg.message);
        const isFromMe = evoMsg.key.fromMe;
        const timestamp = new Date(evoMsg.messageTimestamp * 1000);

        await prisma.message.create({
          data: {
            accountId: ACCOUNT_ID,
            conversationId: conversation.id,
            inboxId: INBOX_ID,
            senderType: isFromMe ? 'user' : 'contact',
            senderId: isFromMe ? null : contact.id,
            content,
            messageType: isFromMe ? 'outgoing' : 'incoming',
            contentType,
            contentAttributes: contentAttributes as any,
            status: 'delivered',
            externalMessageId,
            createdAt: timestamp,
            updatedAt: timestamp,
          },
        });

        chatCreated++;
        totalCreated++;
      }

      page++;
    } while (page <= pages);

    // Update conversation lastActivityAt to the most recent message
    if (chatCreated > 0) {
      const lastMsg = await prisma.message.findFirst({
        where: { conversationId: conversation.id },
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true },
      });

      if (lastMsg) {
        await prisma.conversation.update({
          where: { id: conversation.id },
          data: { lastActivityAt: lastMsg.createdAt },
        });
      }
    }

    if (chatCreated > 0) {
      console.log(`  → ${chatCreated} messages created`);
    }
  }

  // ── Process group chats ──
  console.log('');
  console.log('=== Processing group chats ===');
  for (let i = 0; i < groupChats.length; i++) {
    const chat = groupChats[i];
    const groupJid = chat.remoteJid;

    console.log(`[${i + 1}/${groupChats.length}] ${chat.pushName ?? groupJid}...`);

    // 1. Upsert Group
    let group = await prisma.group.findUnique({
      where: { inboxId_jid: { inboxId: INBOX_ID, jid: groupJid } },
    });

    if (!group) {
      group = await prisma.group.create({
        data: {
          accountId: ACCOUNT_ID,
          inboxId: INBOX_ID,
          jid: groupJid,
          name: chat.pushName ?? groupJid,
          profilePicUrl: chat.profilePicUrl,
        },
      });
    }

    // 2. We need a contact for the conversation — use a placeholder or first participant
    // For groups, create a "group contact" placeholder
    let groupContact = await prisma.contact.findFirst({
      where: { accountId: ACCOUNT_ID, phone: groupJid },
    });

    if (!groupContact) {
      groupContact = await prisma.contact.create({
        data: {
          accountId: ACCOUNT_ID,
          name: chat.pushName ?? groupJid,
          phone: groupJid,
        },
      });
    }

    // 3. Find or create group conversation
    let conversation = await prisma.conversation.findFirst({
      where: {
        accountId: ACCOUNT_ID,
        groupId: group.id,
        inboxId: INBOX_ID,
      },
      orderBy: { lastActivityAt: 'desc' },
    });

    if (!conversation) {
      conversation = await prisma.conversation.create({
        data: {
          accountId: ACCOUNT_ID,
          inboxId: INBOX_ID,
          contactId: groupContact.id,
          groupId: group.id,
          status: 'resolved',
          lastActivityAt: new Date(chat.updatedAt),
        },
      });
      totalConversations++;
    }

    // 4. Fetch all pages of messages
    let page = 1;
    let pages = 1;
    let chatCreated = 0;

    do {
      const result = await fetchMessages(groupJid, page);
      pages = result.pages;

      for (const evoMsg of result.records) {
        totalMessages++;

        const externalMessageId = evoMsg.key.id;

        // Dedup check
        const existing = await prisma.message.findFirst({
          where: { externalMessageId, conversationId: conversation.id },
          select: { id: true },
        });

        if (existing) {
          totalSkipped++;
          continue;
        }

        // Resolve participant contact for group messages
        const participantJid = evoMsg.key.participant ?? evoMsg.key.remoteJid;
        const participantPhone = extractPhone(participantJid);
        let senderContact: { id: string } | null = null;

        if (!evoMsg.key.fromMe && participantPhone) {
          senderContact = await prisma.contact.findFirst({
            where: { accountId: ACCOUNT_ID, phone: participantPhone },
            select: { id: true },
          });

          if (!senderContact) {
            senderContact = await prisma.contact.create({
              data: {
                accountId: ACCOUNT_ID,
                name: evoMsg.pushName ?? participantPhone,
                phone: participantPhone,
              },
            });
            totalContacts++;
          }

          // Upsert group member
          await prisma.groupMember.upsert({
            where: { groupId_contactId: { groupId: group.id, contactId: senderContact.id } },
            create: { groupId: group.id, contactId: senderContact.id, role: 'member' },
            update: {},
          });
        }

        const { content, contentType, contentAttributes } = extractContent(evoMsg.message);
        const isFromMe = evoMsg.key.fromMe;
        const timestamp = new Date(evoMsg.messageTimestamp * 1000);

        await prisma.message.create({
          data: {
            accountId: ACCOUNT_ID,
            conversationId: conversation.id,
            inboxId: INBOX_ID,
            senderType: isFromMe ? 'user' : 'contact',
            senderId: isFromMe ? null : (senderContact?.id ?? groupContact.id),
            senderContactId: isFromMe ? null : (senderContact?.id ?? groupContact.id),
            content,
            messageType: isFromMe ? 'outgoing' : 'incoming',
            contentType,
            contentAttributes: contentAttributes as any,
            status: 'delivered',
            externalMessageId,
            createdAt: timestamp,
            updatedAt: timestamp,
          },
        });

        chatCreated++;
        totalCreated++;
      }

      page++;
    } while (page <= pages);

    // Update conversation lastActivityAt
    if (chatCreated > 0) {
      const lastMsg = await prisma.message.findFirst({
        where: { conversationId: conversation.id },
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true },
      });

      if (lastMsg) {
        await prisma.conversation.update({
          where: { id: conversation.id },
          data: { lastActivityAt: lastMsg.createdAt },
        });
      }

      console.log(`  → ${chatCreated} messages created`);
    }
  }

  console.log('');
  console.log('=== Summary ===');
  console.log(`Contacts created: ${totalContacts}`);
  console.log(`Conversations created: ${totalConversations}`);
  console.log(`Messages processed: ${totalMessages}`);
  console.log(`Messages created: ${totalCreated}`);
  console.log(`Messages skipped (duplicate): ${totalSkipped}`);

  await disconnectPrisma();
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
