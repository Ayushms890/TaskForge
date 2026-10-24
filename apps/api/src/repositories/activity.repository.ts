import type { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
type ActivityWithUser = Prisma.ActivityGetPayload<{
  include: { user: { select: { id: true; name: true } } };
}>;
export interface ActivityRepository {
  list(
    taskId: string,
    page: number,
    limit: number,
  ): Promise<{ items: ActivityWithUser[]; total: number }>;
}
export const activityRepository: ActivityRepository = {
  list: async (taskId, page, limit) => {
    const where = { taskId };
    const [items, total] = await prisma.$transaction([
      prisma.activity.findMany({
        where,
        include: { user: { select: { id: true, name: true } } },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.activity.count({ where }),
    ]);
    return { items, total };
  },
};
