import { getPrisma } from '../../config/database.js';
import { normalizePhone } from '../../lib/phone.js';
import { isValidAliasType, shouldOverwriteName } from '../../lib/alias-types.js';

// ════════════════════════════════════════════════════════════
// Contact Ensure — Atomic find-or-create with race condition safety
// Used by external services (Chat, Portal) to register contacts in the Hub.
// Does NOT trigger provider sync — that's a separate concern.
// ════════════════════════════════════════════════════════════

export interface EnsureParams {
  accountId: string;
  phone?: string;
  email?: string;
  name?: string;
  nameSource?: string;
  sourceId?: string;   // ID in the calling service (e.g., Chat contact UUID)
  source?: string;     // Which service: 'vialum_chat', 'vialum_portal', etc.
}

export interface EnsureResult {
  hubContactId: string;
  name: string | null;
  phone: string | null;
  email: string | null;
  isNew: boolean;
}

export async function ensureContact(params: EnsureParams): Promise<EnsureResult> {
  const prisma = getPrisma();
  const { accountId } = params;
  const normalizedPhone = params.phone ? normalizePhone(params.phone) : null;
  const normalizedEmail = params.email?.toLowerCase().trim() ?? null;

  // ── 1. Try to find by phone alias (highest confidence identifier) ──
  if (normalizedPhone) {
    const phoneAlias = await prisma.contactAlias.findUnique({
      where: { accountId_type_value: { accountId, type: 'phone', value: normalizedPhone } },
      include: { contact: true },
    });

    if (phoneAlias) {
      // Found by phone — update source if not set
      const contact = phoneAlias.contact;
      await updateSourceAndName(contact, params);
      await ensureSourceAlias(accountId, contact.id, params);
      return { hubContactId: contact.id, name: contact.name, phone: contact.phone, email: contact.email, isNew: false };
    }
  }

  // ── 2. Try to find by source ID (if provided) ──
  if (params.sourceId && params.source) {
    const sourceAlias = await prisma.contactAlias.findUnique({
      where: { accountId_type_value: { accountId, type: `source:${params.source}`, value: params.sourceId } },
      include: { contact: true },
    });

    if (sourceAlias) {
      const contact = sourceAlias.contact;
      // Found by source — add phone alias if missing
      if (normalizedPhone) {
        await prisma.contactAlias.upsert({
          where: { accountId_type_value: { accountId, type: 'phone', value: normalizedPhone } },
          create: { accountId, crmContactId: contact.id, type: 'phone', value: normalizedPhone, isPrimary: true },
          update: {},
        }).catch(() => {}); // ignore if phone belongs to another contact (conflict detection)
      }
      return { hubContactId: contact.id, name: contact.name, phone: contact.phone, email: contact.email, isNew: false };
    }
  }

  // ── 3. Try to find by email alias (lower confidence — can be shared) ──
  if (normalizedEmail) {
    const emailAlias = await prisma.contactAlias.findUnique({
      where: { accountId_type_value: { accountId, type: 'email', value: normalizedEmail } },
      include: { contact: true },
    });

    if (emailAlias) {
      // Found by email — but DON'T merge if phone doesn't match
      // If caller provided phone AND this contact has a DIFFERENT phone → conflict
      if (normalizedPhone && emailAlias.contact.phone && emailAlias.contact.phone !== normalizedPhone) {
        // Conflict: same email, different phone → create NEW contact, don't merge
        console.warn(`[ensure] Conflict: email ${normalizedEmail} belongs to contact ${emailAlias.contact.id} (phone: ${emailAlias.contact.phone}) but caller has phone ${normalizedPhone}. Creating new contact.`);
        // Fall through to create
      } else {
        const contact = emailAlias.contact;
        await updateSourceAndName(contact, params);
        await ensureSourceAlias(accountId, contact.id, params);
        return { hubContactId: contact.id, name: contact.name, phone: contact.phone, email: contact.email, isNew: false };
      }
    }
  }

  // ── 4. Not found — create atomically ──
  // Use transaction to prevent race condition (2 simultaneous ensures for same phone)
  const contact = await prisma.$transaction(async (tx) => {
    // Double-check inside transaction (another worker may have created between step 1 and here)
    if (normalizedPhone) {
      const existing = await tx.contactAlias.findUnique({
        where: { accountId_type_value: { accountId, type: 'phone', value: normalizedPhone } },
        include: { contact: true },
      });
      if (existing) return existing.contact;
    }

    // Create contact
    const newContact = await tx.crmContact.create({
      data: {
        accountId,
        phone: normalizedPhone,
        email: normalizedEmail,
        name: params.name ?? null,
        nameSource: params.nameSource ?? (params.name ? 'chat' : 'unknown'),
        externalSourceId: params.sourceId ?? null,
        externalSource: params.source ?? null,
      },
    });

    // Create phone alias
    if (normalizedPhone) {
      await tx.contactAlias.create({
        data: { accountId, crmContactId: newContact.id, type: 'phone', value: normalizedPhone, isPrimary: true },
      });
    }

    // Create email alias
    if (normalizedEmail) {
      await tx.contactAlias.create({
        data: { accountId, crmContactId: newContact.id, type: 'email', value: normalizedEmail },
      }).catch(() => {}); // ignore if email already exists (conflict)
    }

    // Create source alias
    if (params.sourceId && params.source) {
      await tx.contactAlias.create({
        data: { accountId, crmContactId: newContact.id, type: `source:${params.source}`, value: params.sourceId },
      }).catch(() => {});
    }

    return newContact;
  });

  return {
    hubContactId: contact.id,
    name: contact.name,
    phone: contact.phone,
    email: contact.email,
    isNew: true,
  };
}

// ── Helpers ──

async function updateSourceAndName(
  contact: { id: string; name: string | null; nameSource: string; externalSourceId: string | null; externalSource: string | null },
  params: EnsureParams,
) {
  const prisma = getPrisma();
  const updates: Record<string, unknown> = {};

  // Update source if not set and caller provides one
  if (!contact.externalSourceId && params.sourceId && params.source) {
    updates.externalSourceId = params.sourceId;
    updates.externalSource = params.source;
  }

  // Update name with priority
  if (params.name && params.nameSource) {
    if (shouldOverwriteName(contact.nameSource, params.nameSource)) {
      updates.name = params.name;
      updates.nameSource = params.nameSource;
    }
  }

  if (Object.keys(updates).length > 0) {
    await prisma.crmContact.update({ where: { id: contact.id }, data: updates }).catch(() => {});
  }
}

async function ensureSourceAlias(accountId: string, contactId: string, params: EnsureParams) {
  if (!params.sourceId || !params.source) return;
  const prisma = getPrisma();
  await prisma.contactAlias.upsert({
    where: { accountId_type_value: { accountId, type: `source:${params.source}`, value: params.sourceId } },
    create: { accountId, crmContactId: contactId, type: `source:${params.source}`, value: params.sourceId },
    update: {},
  }).catch(() => {});
}
