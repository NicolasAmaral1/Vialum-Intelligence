import { getPrisma } from '../../config/database.js';

// ════════════════════════════════════════════════════════════
// Objections CRUD Service
// ════════════════════════════════════════════════════════════

export async function listObjections(accountId: string, opts?: {
  category?: string;
  limit?: number;
  offset?: number;
}) {
  const prisma = getPrisma();

  return prisma.objection.findMany({
    where: {
      accountId,
      ...(opts?.category ? { category: opts.category } : {}),
    },
    include: {
      treeFlows: {
        select: {
          treeFlowId: true,
          stepIds: true,
          priority: true,
          treeFlow: { select: { id: true, name: true, slug: true } },
        },
      },
    },
    orderBy: { updatedAt: 'desc' },
    take: opts?.limit ?? 100,
    skip: opts?.offset ?? 0,
  });
}

export async function getObjection(accountId: string, objectionId: string) {
  const prisma = getPrisma();

  const objection = await prisma.objection.findFirst({
    where: { id: objectionId, accountId },
    include: {
      treeFlows: {
        include: {
          treeFlow: { select: { id: true, name: true, slug: true } },
        },
      },
    },
  });

  if (!objection) {
    throw { statusCode: 404, message: 'Objection not found', code: 'OBJECTION_NOT_FOUND' };
  }

  return objection;
}

export async function createObjection(accountId: string, data: {
  name: string;
  category?: string;
  description?: string;
  detectionHints?: string[];
  rebuttalStrategy?: string;
  rebuttalExamples?: string[];
  severity?: string;
  treeFlowIds?: Array<{ treeFlowId: string; stepIds?: string[]; priority?: number }>;
}) {
  const prisma = getPrisma();

  // Check name uniqueness
  const existing = await prisma.objection.findUnique({
    where: { accountId_name: { accountId, name: data.name } },
  });

  if (existing) {
    throw { statusCode: 409, message: `Objection "${data.name}" already exists`, code: 'NAME_CONFLICT' };
  }

  return prisma.$transaction(async (tx) => {
    const objection = await tx.objection.create({
      data: {
        accountId,
        name: data.name,
        category: data.category ?? null,
        description: data.description ?? null,
        detectionHints: data.detectionHints ?? [],
        rebuttalStrategy: data.rebuttalStrategy ?? null,
        rebuttalExamples: data.rebuttalExamples ?? [],
        severity: data.severity ?? 'medium',
      },
    });

    // Link to tree flows if provided
    if (data.treeFlowIds && data.treeFlowIds.length > 0) {
      for (const tf of data.treeFlowIds) {
        // Verify tree flow belongs to account
        const treeFlow = await tx.treeFlow.findFirst({
          where: { id: tf.treeFlowId, accountId },
          select: { id: true },
        });

        if (!treeFlow) continue;

        await tx.treeFlowObjection.create({
          data: {
            treeFlowId: tf.treeFlowId,
            objectionId: objection.id,
            stepIds: tf.stepIds ?? [],
            priority: tf.priority ?? 0,
          },
        });
      }
    }

    return tx.objection.findFirst({
      where: { id: objection.id },
      include: {
        treeFlows: {
          include: { treeFlow: { select: { id: true, name: true, slug: true } } },
        },
      },
    });
  });
}

export async function updateObjection(accountId: string, objectionId: string, data: {
  name?: string;
  category?: string;
  description?: string;
  detectionHints?: string[];
  rebuttalStrategy?: string;
  rebuttalExamples?: string[];
  severity?: string;
  treeFlowIds?: Array<{ treeFlowId: string; stepIds?: string[]; priority?: number }>;
}) {
  const prisma = getPrisma();

  const objection = await prisma.objection.findFirst({
    where: { id: objectionId, accountId },
  });

  if (!objection) {
    throw { statusCode: 404, message: 'Objection not found', code: 'OBJECTION_NOT_FOUND' };
  }

  // Check name uniqueness if changing name
  if (data.name && data.name !== objection.name) {
    const nameConflict = await prisma.objection.findUnique({
      where: { accountId_name: { accountId, name: data.name } },
    });
    if (nameConflict) {
      throw { statusCode: 409, message: `Objection "${data.name}" already exists`, code: 'NAME_CONFLICT' };
    }
  }

  return prisma.$transaction(async (tx) => {
    const updateData: Record<string, unknown> = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.category !== undefined) updateData.category = data.category;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.detectionHints !== undefined) updateData.detectionHints = data.detectionHints;
    if (data.rebuttalStrategy !== undefined) updateData.rebuttalStrategy = data.rebuttalStrategy;
    if (data.rebuttalExamples !== undefined) updateData.rebuttalExamples = data.rebuttalExamples;
    if (data.severity !== undefined) updateData.severity = data.severity;

    await tx.objection.update({
      where: { id: objectionId },
      data: updateData,
    });

    // Replace tree flow associations if provided
    if (data.treeFlowIds !== undefined) {
      // Remove existing
      await tx.treeFlowObjection.deleteMany({
        where: { objectionId },
      });

      // Create new
      for (const tf of data.treeFlowIds) {
        const treeFlow = await tx.treeFlow.findFirst({
          where: { id: tf.treeFlowId, accountId },
          select: { id: true },
        });
        if (!treeFlow) continue;

        await tx.treeFlowObjection.create({
          data: {
            treeFlowId: tf.treeFlowId,
            objectionId,
            stepIds: tf.stepIds ?? [],
            priority: tf.priority ?? 0,
          },
        });
      }
    }

    return tx.objection.findFirst({
      where: { id: objectionId },
      include: {
        treeFlows: {
          include: { treeFlow: { select: { id: true, name: true, slug: true } } },
        },
      },
    });
  });
}

export async function deleteObjection(accountId: string, objectionId: string) {
  const prisma = getPrisma();

  const objection = await prisma.objection.findFirst({
    where: { id: objectionId, accountId },
  });

  if (!objection) {
    throw { statusCode: 404, message: 'Objection not found', code: 'OBJECTION_NOT_FOUND' };
  }

  await prisma.objection.delete({
    where: { id: objectionId },
  });

  return { deleted: true };
}
