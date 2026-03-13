import { getPrisma } from '../../config/database.js';
import { TreeFlowDefinition, TreeFlowSettings, DEFAULT_TREEFLOW_SETTINGS } from './treeflow.types.js';

// ════════════════════════════════════════════════════════════
// TreeFlow CRUD + Version Management
// ════════════════════════════════════════════════════════════

export async function listTreeFlows(accountId: string, opts?: { includeArchived?: boolean }) {
  const prisma = getPrisma();

  return prisma.treeFlow.findMany({
    where: {
      accountId,
      ...(opts?.includeArchived ? {} : { isArchived: false }),
    },
    include: {
      activeVersion: {
        select: { id: true, versionNumber: true, status: true, publishedAt: true },
      },
      _count: { select: { versions: true, talks: true } },
    },
    orderBy: { updatedAt: 'desc' },
  });
}

export async function getTreeFlow(accountId: string, treeFlowId: string) {
  const prisma = getPrisma();

  const treeFlow = await prisma.treeFlow.findFirst({
    where: { id: treeFlowId, accountId },
    include: {
      activeVersion: true,
      versions: {
        orderBy: { versionNumber: 'desc' },
        take: 10,
        select: {
          id: true,
          versionNumber: true,
          status: true,
          notes: true,
          publishedAt: true,
          createdAt: true,
        },
      },
      objections: {
        include: {
          objection: {
            select: { id: true, name: true, category: true, severity: true },
          },
        },
      },
      _count: { select: { talks: true } },
    },
  });

  if (!treeFlow) {
    throw { statusCode: 404, message: 'TreeFlow not found', code: 'TREEFLOW_NOT_FOUND' };
  }

  return treeFlow;
}

export async function createTreeFlow(accountId: string, data: {
  name: string;
  slug: string;
  description?: string;
  category?: string;
  settings?: Partial<TreeFlowSettings>;
  definition?: TreeFlowDefinition;
}) {
  const prisma = getPrisma();

  // Check slug uniqueness within account
  const existing = await prisma.treeFlow.findUnique({
    where: { accountId_slug: { accountId, slug: data.slug } },
  });

  if (existing) {
    throw { statusCode: 409, message: `TreeFlow with slug "${data.slug}" already exists`, code: 'SLUG_CONFLICT' };
  }

  const settings: TreeFlowSettings = {
    ...DEFAULT_TREEFLOW_SETTINGS,
    ...data.settings,
  };

  // Create TreeFlow + initial draft version in a transaction
  const result = await prisma.$transaction(async (tx) => {
    const treeFlow = await tx.treeFlow.create({
      data: {
        accountId,
        name: data.name,
        slug: data.slug,
        description: data.description ?? null,
        category: data.category ?? null,
        settings: settings as any,
      },
    });

    // Create initial draft version if definition provided
    let version = null;
    if (data.definition) {
      version = await tx.treeFlowVersion.create({
        data: {
          treeFlowId: treeFlow.id,
          versionNumber: 1,
          status: 'draft',
          definition: data.definition as any,
        },
      });
    }

    return { treeFlow, version };
  });

  return result;
}

export async function updateTreeFlow(accountId: string, treeFlowId: string, data: {
  name?: string;
  description?: string;
  category?: string;
  settings?: Partial<TreeFlowSettings>;
  isArchived?: boolean;
}) {
  const prisma = getPrisma();

  const treeFlow = await prisma.treeFlow.findFirst({
    where: { id: treeFlowId, accountId },
  });

  if (!treeFlow) {
    throw { statusCode: 404, message: 'TreeFlow not found', code: 'TREEFLOW_NOT_FOUND' };
  }

  const updateData: Record<string, unknown> = {};

  if (data.name !== undefined) updateData.name = data.name;
  if (data.description !== undefined) updateData.description = data.description;
  if (data.category !== undefined) updateData.category = data.category;
  if (data.isArchived !== undefined) updateData.isArchived = data.isArchived;

  if (data.settings) {
    const currentSettings = (treeFlow.settings as Record<string, unknown>) ?? {};
    updateData.settings = { ...DEFAULT_TREEFLOW_SETTINGS, ...currentSettings, ...data.settings };
  }

  return prisma.treeFlow.update({
    where: { id: treeFlowId },
    data: updateData,
    include: {
      activeVersion: {
        select: { id: true, versionNumber: true, status: true },
      },
    },
  });
}

// ── Version Management ──

export async function createVersion(accountId: string, treeFlowId: string, data: {
  definition: TreeFlowDefinition;
  notes?: string;
}) {
  const prisma = getPrisma();

  const treeFlow = await prisma.treeFlow.findFirst({
    where: { id: treeFlowId, accountId },
  });

  if (!treeFlow) {
    throw { statusCode: 404, message: 'TreeFlow not found', code: 'TREEFLOW_NOT_FOUND' };
  }

  // Get next version number
  const latestVersion = await prisma.treeFlowVersion.findFirst({
    where: { treeFlowId },
    orderBy: { versionNumber: 'desc' },
    select: { versionNumber: true },
  });

  const nextVersion = (latestVersion?.versionNumber ?? 0) + 1;

  // Validate definition structure
  validateDefinition(data.definition);

  return prisma.treeFlowVersion.create({
    data: {
      treeFlowId,
      versionNumber: nextVersion,
      status: 'draft',
      definition: data.definition as any,
      notes: data.notes ?? null,
    },
  });
}

export async function publishVersion(accountId: string, treeFlowId: string, versionId: string) {
  const prisma = getPrisma();

  const treeFlow = await prisma.treeFlow.findFirst({
    where: { id: treeFlowId, accountId },
  });

  if (!treeFlow) {
    throw { statusCode: 404, message: 'TreeFlow not found', code: 'TREEFLOW_NOT_FOUND' };
  }

  const version = await prisma.treeFlowVersion.findFirst({
    where: { id: versionId, treeFlowId },
  });

  if (!version) {
    throw { statusCode: 404, message: 'Version not found', code: 'VERSION_NOT_FOUND' };
  }

  if (version.status === 'published') {
    throw { statusCode: 400, message: 'Version is already published', code: 'ALREADY_PUBLISHED' };
  }

  // Validate definition before publishing
  validateDefinition(version.definition as unknown as TreeFlowDefinition);

  // Transaction: deprecate old active version, publish new, update treeflow pointer
  return prisma.$transaction(async (tx) => {
    // Deprecate currently active version if exists
    if (treeFlow.activeVersionId) {
      await tx.treeFlowVersion.update({
        where: { id: treeFlow.activeVersionId },
        data: { status: 'deprecated' },
      });
    }

    // Publish the new version
    const publishedVersion = await tx.treeFlowVersion.update({
      where: { id: versionId },
      data: {
        status: 'published',
        publishedAt: new Date(),
      },
    });

    // Update TreeFlow to point to new active version
    await tx.treeFlow.update({
      where: { id: treeFlowId },
      data: { activeVersionId: versionId },
    });

    return publishedVersion;
  });
}

// ── Validation ──

function validateDefinition(def: TreeFlowDefinition) {
  if (!def.initial_step_id) {
    throw { statusCode: 400, message: 'Definition must have an initial_step_id', code: 'INVALID_DEFINITION' };
  }

  if (!def.steps || def.steps.length === 0) {
    throw { statusCode: 400, message: 'Definition must have at least one step', code: 'INVALID_DEFINITION' };
  }

  const stepIds = new Set(def.steps.map((s) => s.id));

  if (!stepIds.has(def.initial_step_id)) {
    throw {
      statusCode: 400,
      message: `initial_step_id "${def.initial_step_id}" does not match any step`,
      code: 'INVALID_DEFINITION',
    };
  }

  // Validate all transition targets exist
  for (const step of def.steps) {
    for (const transition of step.transitions) {
      if (!stepIds.has(transition.target_step_id)) {
        throw {
          statusCode: 400,
          message: `Step "${step.id}" has transition to unknown step "${transition.target_step_id}"`,
          code: 'INVALID_DEFINITION',
        };
      }
    }
  }
}
