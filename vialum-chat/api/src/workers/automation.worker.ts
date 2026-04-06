import { Worker, Job, Queue } from 'bullmq';
import { getRedis } from '../config/redis.js';
import { getPrisma } from '../config/database.js';
import { Server as SocketIOServer } from 'socket.io';

// Singleton queue for message-send (avoids per-job connection overhead)
let _messageSendQueue: Queue | null = null;
function getMessageSendQueue(): Queue {
  if (!_messageSendQueue) {
    _messageSendQueue = new Queue('message-send', { connection: getRedis() as any });
  }
  return _messageSendQueue;
}

export async function closeSingletonQueues(): Promise<void> {
  await _messageSendQueue?.close();
  _messageSendQueue = null;
}

// ════════════════════════════════════════════════════════════
// Automation Worker
// Queue: automation:evaluate
// Evaluates automation rules against events and executes
// matching actions.
// ════════════════════════════════════════════════════════════

export interface AutomationEvaluateJobData {
  accountId: string;
  eventName: string;
  eventData: Record<string, any>;
}

interface AutomationCondition {
  attribute: string;
  operator: 'equals' | 'not_equals' | 'contains' | 'not_contains' | 'starts_with' | 'ends_with' | 'is_present' | 'is_not_present';
  value?: string;
}

interface AutomationAction {
  type: 'assign_agent' | 'assign_label' | 'send_message' | 'send_webhook' | 'change_status' | 'start_treeflow' | 'mute_conversation';
  params: Record<string, any>;
}

export function createAutomationWorker(io: SocketIOServer): Worker {
  const worker = new Worker<AutomationEvaluateJobData>(
    'automation-evaluate',
    async (job: Job<AutomationEvaluateJobData>) => {
      const prisma = getPrisma();
      const { accountId, eventName, eventData } = job.data;

      job.log(`Evaluating automation rules for event: ${eventName}`);

      // Load all active automation rules for this event
      const rules = await prisma.automationRule.findMany({
        where: {
          accountId,
          eventName,
          active: true,
        },
        orderBy: { createdAt: 'asc' },
      });

      if (rules.length === 0) {
        job.log('No matching automation rules');
        return { matchedRules: 0, executedActions: 0 };
      }

      let matchedRules = 0;
      let executedActions = 0;

      for (const rule of rules) {
        const conditions = rule.conditions as unknown as AutomationCondition[];
        const actions = rule.actions as unknown as AutomationAction[];

        // Evaluate all conditions (AND logic)
        const allConditionsMet = conditions.every((condition) =>
          evaluateCondition(condition, eventData),
        );

        if (!allConditionsMet) continue;

        matchedRules++;
        job.log(`Rule "${rule.name}" (${rule.id}) matched`);

        // Execute actions
        for (const action of actions) {
          try {
            await executeAction(action, accountId, eventData, io);
            executedActions++;
          } catch (err) {
            console.error(`[automation] Failed to execute action ${action.type} for rule ${rule.id}:`, err);
          }
        }

        // Update rule stats
        await prisma.automationRule.update({
          where: { id: rule.id },
          data: {
            runCount: { increment: 1 },
            lastRunAt: new Date(),
          },
        });
      }

      job.log(`Automation complete: ${matchedRules} rules matched, ${executedActions} actions executed`);
      return { matchedRules, executedActions };
    },
    {
      connection: getRedis() as any,
      concurrency: 5,
    },
  );

  worker.on('completed', (job) => {
    console.log(`[automation:evaluate] Job ${job.id} completed`);
  });

  worker.on('failed', (job, err) => {
    console.error(`[automation:evaluate] Job ${job?.id} failed:`, err.message);
  });

  return worker;
}

// ── Condition Evaluation ──

function evaluateCondition(condition: AutomationCondition, eventData: Record<string, any>): boolean {
  const attributeValue = getNestedValue(eventData, condition.attribute);
  const stringValue = attributeValue != null ? String(attributeValue) : '';
  const conditionValue = condition.value ?? '';

  switch (condition.operator) {
    case 'equals':
      return stringValue === conditionValue;
    case 'not_equals':
      return stringValue !== conditionValue;
    case 'contains':
      return stringValue.toLowerCase().includes(conditionValue.toLowerCase());
    case 'not_contains':
      return !stringValue.toLowerCase().includes(conditionValue.toLowerCase());
    case 'starts_with':
      return stringValue.toLowerCase().startsWith(conditionValue.toLowerCase());
    case 'ends_with':
      return stringValue.toLowerCase().endsWith(conditionValue.toLowerCase());
    case 'is_present':
      return attributeValue != null && attributeValue !== '';
    case 'is_not_present':
      return attributeValue == null || attributeValue === '';
    default:
      return false;
  }
}

function getNestedValue(obj: Record<string, any>, path: string): any {
  return path.split('.').reduce((acc, key) => acc?.[key], obj);
}

// ── Action Execution ──

async function executeAction(
  action: AutomationAction,
  accountId: string,
  eventData: Record<string, any>,
  io: SocketIOServer,
): Promise<void> {
  const prisma = getPrisma();
  const conversationId = eventData.conversationId;

  switch (action.type) {
    case 'assign_agent': {
      const agentId = action.params.agent_id;
      if (!agentId || !conversationId) return;

      await prisma.conversation.update({
        where: { id: conversationId },
        data: { assigneeId: agentId },
      });

      io.to(`conversation:${conversationId}`).emit('conversation:assigned', {
        conversationId,
        assigneeId: agentId,
      });
      break;
    }

    case 'assign_label': {
      const labelName = action.params.label_name ?? action.params.label;
      if (!labelName || !conversationId) return;

      const label = await prisma.label.findUnique({
        where: { accountId_name: { accountId, name: labelName } },
      });

      if (label) {
        try {
          await prisma.conversationLabel.create({
            data: { conversationId, labelId: label.id },
          });
        } catch {
          // Already exists
        }
      }
      break;
    }

    case 'send_message': {
      const content = action.params.content;
      if (!content || !conversationId) return;

      await getMessageSendQueue().add('automation-message', {
        accountId,
        conversationId,
        content,
        senderType: 'bot',
      });
      break;
    }

    case 'change_status': {
      const newStatus = action.params.status;
      if (!newStatus || !conversationId) return;

      await prisma.conversation.update({
        where: { id: conversationId },
        data: { status: newStatus },
      });

      io.to(`conversation:${conversationId}`).emit('conversation:status_changed', {
        conversationId,
        status: newStatus,
      });
      break;
    }

    case 'start_treeflow': {
      const treeFlowSlug = action.params.treeflow_slug;
      const contactId = eventData.contactId;
      if (!treeFlowSlug || !conversationId || !contactId) return;

      const treeFlow = await prisma.treeFlow.findUnique({
        where: { accountId_slug: { accountId, slug: treeFlowSlug } },
        include: { activeVersion: true },
      });

      if (!treeFlow || !treeFlow.activeVersion) return;

      // Import and call talks service to create the talk
      const { createTalk } = await import('../modules/talks/talks.service.js');
      await createTalk(accountId, {
        conversationId,
        treeFlowId: treeFlow.id,
        contactId,
      });

      io.to(`conversation:${conversationId}`).emit('talk:started', {
        conversationId,
        treeFlowName: treeFlow.name,
      });
      break;
    }

    case 'send_webhook': {
      const webhookUrl = action.params.url;
      if (!webhookUrl) return;

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      try {
        await fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            event: 'automation_triggered',
            accountId,
            data: eventData,
            timestamp: new Date().toISOString(),
          }),
          signal: controller.signal,
        });
      } catch (err) {
        console.error(`[automation] Failed to send webhook to ${webhookUrl}:`, err);
      } finally {
        clearTimeout(timeout);
      }
      break;
    }

    case 'mute_conversation': {
      if (!conversationId) return;
      const duration = action.params.duration_hours ?? 24;
      const snoozedUntil = new Date(Date.now() + duration * 60 * 60 * 1000);

      await prisma.conversation.update({
        where: { id: conversationId },
        data: { status: 'snoozed', snoozedUntil },
      });
      break;
    }

    default:
      console.warn(`[automation] Unknown action type: ${action.type}`);
  }
}
