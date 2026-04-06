import { Worker, Job } from 'bullmq';
import { getRedis } from '../config/redis.js';
import { getPrisma } from '../config/database.js';
import { getEnv } from '../config/env.js';
import crypto from 'node:crypto';

// ════════════════════════════════════════════════════════════
// Hub Ensure Worker
// Queue: hub-ensure
// Calls the Vialum Hub POST /contacts/ensure to register
// contacts and obtain a hubContactId. Retries on failure.
// Replaces the old fire-and-forget syncContactNameFromCRM.
// ════════════════════════════════════════════════════════════

export interface HubEnsureJobData {
  contactId: string;     // Chat contact ID
  accountId: string;
  phone: string;
  name?: string | null;
}

function generateHubToken(accountId: string): string {
  const env = getEnv();
  const secret = env.MEDIA_JWT_SECRET; // same JWT secret used by Hub
  if (!secret) throw new Error('MEDIA_JWT_SECRET not configured');

  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  const payload = Buffer.from(JSON.stringify({
    userId: 'chat-service', accountId, role: 'service',
    iat: now, exp: now + 300,
  })).toString('base64url');
  const signature = crypto.createHmac('sha256', secret).update(`${header}.${payload}`).digest('base64url');
  return `${header}.${payload}.${signature}`;
}

export function createHubEnsureWorker(): Worker {
  const worker = new Worker<HubEnsureJobData>(
    'hub-ensure',
    async (job: Job<HubEnsureJobData>) => {
      const prisma = getPrisma();
      const env = getEnv();
      const { contactId, accountId, phone, name } = job.data;

      const hubUrl = env.HUB_URL ?? env.CRM_HUB_URL;
      if (!hubUrl) {
        job.log('CRM_HUB_URL not configured, skipping');
        return { skipped: true };
      }

      // Check if contact already has hubContactId
      const contact = await prisma.contact.findUnique({
        where: { id: contactId },
        select: { hubContactId: true, crmName: true },
      });

      if (contact?.hubContactId) {
        job.log(`Contact ${contactId} already has hubContactId ${contact.hubContactId}`);
        return { skipped: true, hubContactId: contact.hubContactId };
      }

      // Call Hub POST /contacts/ensure (5s timeout)
      const token = generateHubToken(accountId);
      const controller = new AbortController();
      const hubTimeout = setTimeout(() => controller.abort(), 5000);
      const response = await fetch(`${hubUrl}/api/v1/contacts/ensure`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          phone,
          name,
          nameSource: 'whatsapp',
          sourceId: contactId,
          source: 'vialum_chat',
        }),
        signal: controller.signal,
      }).finally(() => clearTimeout(hubTimeout));

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        throw new Error(`Hub ensure failed (${response.status}): ${errorText}`);
      }

      const result = await response.json() as { data: { hubContactId: string; name: string | null } };
      const hubContactId = result.data.hubContactId;

      // Save hubContactId + crmName on Chat contact
      const updates: Record<string, unknown> = { hubContactId };
      if (result.data.name && !contact?.crmName) {
        updates.crmName = result.data.name;
      }

      await prisma.contact.update({
        where: { id: contactId },
        data: updates,
      });

      job.log(`Contact ${contactId} linked to Hub ${hubContactId}`);
      return { hubContactId, isNew: result.data.hubContactId === hubContactId };
    },
    {
      connection: getRedis() as any,
      concurrency: 5,
    },
  );

  worker.on('completed', (job) => {
    console.log(`[hub:ensure] Job ${job.id} completed`);
  });

  worker.on('failed', (job, err) => {
    console.error(`[hub:ensure] Job ${job?.id} failed:`, err.message);
  });

  return worker;
}
