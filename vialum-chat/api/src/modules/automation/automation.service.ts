import { getPrisma } from '../../config/database.js';

export interface CreateAutomationRuleInput {
  name: string;
  description?: string | null;
  eventName: string;
  conditions?: unknown[];
  actions?: unknown[];
  active?: boolean;
}

export interface UpdateAutomationRuleInput {
  name?: string;
  description?: string | null;
  eventName?: string;
  conditions?: unknown[];
  actions?: unknown[];
}

export async function create(accountId: string, data: CreateAutomationRuleInput) {
  const prisma = getPrisma();

  return prisma.automationRule.create({
    data: {
      accountId,
      name: data.name,
      description: data.description ?? null,
      eventName: data.eventName,
      conditions: (data.conditions ?? []) as any,
      actions: (data.actions ?? []) as any,
      active: data.active ?? true,
    },
  });
}

export async function findAll(accountId: string) {
  const prisma = getPrisma();

  return prisma.automationRule.findMany({
    where: { accountId },
    orderBy: { createdAt: 'desc' },
  });
}

export async function findById(accountId: string, ruleId: string) {
  const prisma = getPrisma();

  const rule = await prisma.automationRule.findFirst({
    where: { id: ruleId, accountId },
  });

  if (!rule) {
    throw { statusCode: 404, message: 'Automation rule not found', code: 'AUTOMATION_RULE_NOT_FOUND' };
  }

  return rule;
}

export async function update(accountId: string, ruleId: string, data: UpdateAutomationRuleInput) {
  const prisma = getPrisma();

  const existing = await prisma.automationRule.findFirst({
    where: { id: ruleId, accountId },
  });

  if (!existing) {
    throw { statusCode: 404, message: 'Automation rule not found', code: 'AUTOMATION_RULE_NOT_FOUND' };
  }

  return prisma.automationRule.update({
    where: { id: ruleId },
    data: {
      ...(data.name !== undefined && { name: data.name }),
      ...(data.description !== undefined && { description: data.description }),
      ...(data.eventName !== undefined && { eventName: data.eventName }),
      ...(data.conditions !== undefined && { conditions: data.conditions as any }),
      ...(data.actions !== undefined && { actions: data.actions as any }),
    },
  });
}

export async function toggleActive(accountId: string, ruleId: string) {
  const prisma = getPrisma();

  const existing = await prisma.automationRule.findFirst({
    where: { id: ruleId, accountId },
  });

  if (!existing) {
    throw { statusCode: 404, message: 'Automation rule not found', code: 'AUTOMATION_RULE_NOT_FOUND' };
  }

  return prisma.automationRule.update({
    where: { id: ruleId },
    data: { active: !existing.active },
  });
}

export async function remove(accountId: string, ruleId: string) {
  const prisma = getPrisma();

  const existing = await prisma.automationRule.findFirst({
    where: { id: ruleId, accountId },
  });

  if (!existing) {
    throw { statusCode: 404, message: 'Automation rule not found', code: 'AUTOMATION_RULE_NOT_FOUND' };
  }

  await prisma.automationRule.delete({ where: { id: ruleId } });
}
