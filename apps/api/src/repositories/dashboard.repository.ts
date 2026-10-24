import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";

export const dashboardRepository = {
  readForUser(projectId: string, userId: string) {
    return prisma.$transaction(
      async (tx) => {
        const project = await tx.project.findFirst({
          where: {
            id: projectId,
            workspace: { members: { some: { userId } } },
          },
          select: {
            id: true,
            workspaceId: true,
            name: true,
            key: true,
            description: true,
          },
        });
        if (!project) return null;

        const counts = await tx.task.groupBy({
          by: ["status"],
          where: { projectId },
          _count: { _all: true },
        });
        const activeSprint = await tx.sprint.findFirst({
          where: { projectId, status: "ACTIVE" },
          orderBy: [{ startDate: "desc" }, { id: "desc" }],
          select: {
            id: true,
            name: true,
            goal: true,
            startDate: true,
            endDate: true,
          },
        });
        const sprintCounts = activeSprint
          ? await tx.task.groupBy({
              by: ["status"],
              where: { projectId, sprintId: activeSprint.id },
              _count: { _all: true },
            })
          : [];
        const recentTasks = await tx.task.findMany({
          where: { projectId },
          take: 8,
          orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
          select: {
            id: true,
            number: true,
            title: true,
            status: true,
            priority: true,
            type: true,
            updatedAt: true,
            assignee: { select: { id: true, name: true } },
          },
        });
        const recentActivity = await tx.activity.findMany({
          where: { task: { projectId } },
          take: 8,
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          select: {
            id: true,
            action: true,
            metadata: true,
            createdAt: true,
            user: { select: { id: true, name: true } },
            task: { select: { id: true, number: true, title: true } },
          },
        });
        return {
          project,
          counts,
          activeSprint,
          sprintCounts,
          recentTasks,
          recentActivity,
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  },
};

export type DashboardRepository = typeof dashboardRepository;
