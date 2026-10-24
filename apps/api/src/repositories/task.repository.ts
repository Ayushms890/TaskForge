import {
  Prisma,
  type Task,
  type TaskPriority,
  type TaskStatus,
  type TaskType,
} from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { taskPage, taskWhere } from "./task-query.js";

export type TaskFilters = {
  projectId: string;
  status?: TaskStatus | undefined;
  priority?: TaskPriority | undefined;
  type?: TaskType | undefined;
  assigneeId?: string | null | undefined;
  sprintId?: string | null | undefined;
  q?: string | undefined;
  order?: "board";
  page: number;
  limit: number;
};
export interface TaskRepository {
  createNext(data: {
    projectId: string;
    title: string;
    description?: string | undefined;
    status?: TaskStatus | undefined;
    priority?: TaskPriority | undefined;
    type?: TaskType | undefined;
    assigneeId?: string | null | undefined;
    reporterId?: string | null | undefined;
    sprintId?: string | null | undefined;
    actorId?: string;
  }): Promise<Task>;
  list(filters: TaskFilters): Promise<{ items: Task[]; total: number }>;
  findById(id: string): Promise<Task | null>;
  update(
    id: string,
    data: Prisma.TaskUpdateInput,
    actorId?: string,
  ): Promise<Task>;
  remove(id: string): Promise<void>;
  move(
    id: string,
    data: { status?: TaskStatus; position?: number },
    actorId?: string,
  ): Promise<Task>;
}
export const taskRepository: TaskRepository = {
  createNext: (data) =>
    prisma.$transaction(async (tx) => {
      const last = await tx.task.findFirst({
        where: { projectId: data.projectId },
        orderBy: { number: "desc" },
        select: { number: true },
      });
      const created = await tx.task.create({
        data: {
          projectId: data.projectId,
          title: data.title,
          description: data.description ?? null,
          status: data.status ?? "TODO",
          priority: data.priority ?? "MEDIUM",
          type: data.type ?? "TASK",
          assigneeId: data.assigneeId ?? null,
          reporterId: data.reporterId ?? null,
          sprintId: data.sprintId ?? null,
          position: await nextPosition(
            tx,
            data.projectId,
            data.status ?? "TODO",
          ),
          number: (last?.number ?? 0) + 1,
        },
      });
      if (data.actorId) {
        await tx.activity.create({
          data: {
            taskId: created.id,
            userId: data.actorId,
            action: "TASK_CREATED",
            metadata: { from: null, to: null },
          },
        });
        if (created.assigneeId)
          await tx.activity.create({
            data: {
              taskId: created.id,
              userId: data.actorId,
              action: "TASK_ASSIGNED",
              metadata: { from: null, to: created.assigneeId },
            },
          });
      }
      return created;
    }),
  list: async (filters) => {
    const where = taskWhere(filters);
    const [items, total] = await prisma.$transaction(
      [
        prisma.task.findMany({
          where,
          orderBy:
            filters.order === "board"
              ? [{ status: "asc" }, { position: "asc" }, { id: "asc" }]
              : [{ createdAt: "desc" }, { id: "desc" }],
          ...taskPage(filters),
        }),
        prisma.task.count({ where }),
      ],
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
    return { items, total };
  },
  findById: (id) => prisma.task.findUnique({ where: { id } }),
  update: (id, data, actorId) =>
    prisma.$transaction(async (tx) => {
      const before = await tx.task.findUnique({ where: { id } });
      if (!before)
        throw Object.assign(new Error("Task not found"), { code: "P2025" });
      const updated = await tx.task.update({ where: { id }, data });
      if (actorId) {
        const events: Array<{
          action:
            | "TASK_ASSIGNED"
            | "PRIORITY_CHANGED"
            | "SPRINT_CHANGED"
            | "STATUS_CHANGED";
          from: string | null;
          to: string | null;
        }> = [];
        if (before.assigneeId !== updated.assigneeId)
          events.push({
            action: "TASK_ASSIGNED",
            from: before.assigneeId,
            to: updated.assigneeId,
          });
        if (before.priority !== updated.priority)
          events.push({
            action: "PRIORITY_CHANGED",
            from: before.priority,
            to: updated.priority,
          });
        if (before.sprintId !== updated.sprintId)
          events.push({
            action: "SPRINT_CHANGED",
            from: before.sprintId,
            to: updated.sprintId,
          });
        if (before.status !== updated.status)
          events.push({
            action: "STATUS_CHANGED",
            from: before.status,
            to: updated.status,
          });
        for (const event of events)
          await tx.activity.create({
            data: {
              taskId: id,
              userId: actorId,
              action: event.action,
              metadata: { from: event.from, to: event.to },
            },
          });
      }
      return updated;
    }),
  remove: (id) => prisma.task.delete({ where: { id } }).then(() => undefined),
  move: async (id, data, actorId) => {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        return await prisma.$transaction(
          async (tx) => {
            const task = await tx.task.findUnique({ where: { id } });
            if (!task)
              throw Object.assign(new Error("Task not found"), {
                code: "P2025",
              });
            const status = data.status ?? task.status;
            const count = await tx.task.count({
              where: { projectId: task.projectId, status },
            });
            const target =
              data.position === undefined && status === task.status
                ? task.position
                : Math.max(
                    0,
                    Math.min(
                      data.position ?? count,
                      status === task.status ? Math.max(0, count - 1) : count,
                    ),
                  );

            if (status === task.status) {
              const old = task.position;
              if (target < old) {
                await tx.task.updateMany({
                  where: {
                    projectId: task.projectId,
                    status,
                    position: { gte: target, lt: old },
                    id: { not: id },
                  },
                  data: { position: { increment: 1 } },
                });
              } else if (target > old) {
                await tx.task.updateMany({
                  where: {
                    projectId: task.projectId,
                    status,
                    position: { gt: old, lte: target },
                    id: { not: id },
                  },
                  data: { position: { decrement: 1 } },
                });
              }
            } else {
              await tx.task.updateMany({
                where: {
                  projectId: task.projectId,
                  status: task.status,
                  position: { gt: task.position },
                },
                data: { position: { decrement: 1 } },
              });
              await tx.task.updateMany({
                where: {
                  projectId: task.projectId,
                  status,
                  position: { gte: target },
                },
                data: { position: { increment: 1 } },
              });
            }
            const updated = await tx.task.update({
              where: { id },
              data: { status, position: target },
            });
            if (actorId && task.status !== updated.status)
              await tx.activity.create({
                data: {
                  taskId: id,
                  userId: actorId,
                  action: "STATUS_CHANGED",
                  metadata: { from: task.status, to: updated.status },
                },
              });
            for (const column of [
              "TODO",
              "IN_PROGRESS",
              "DONE",
            ] as TaskStatus[]) {
              const items = await tx.task.findMany({
                where: { projectId: task.projectId, status: column },
                orderBy: [
                  { position: "asc" },
                  { createdAt: "asc" },
                  { id: "asc" },
                ],
              });
              await Promise.all(
                items.map((item, index) =>
                  tx.task.update({
                    where: { id: item.id },
                    data: { position: index },
                  }),
                ),
              );
            }
            return updated;
          },
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
        );
      } catch (error) {
        if (isSerializationConflict(error) && attempt < 2) continue;
        throw error;
      }
    }
    throw new Error("Could not move task safely.");
  },
};

const isSerializationConflict = (error: unknown) =>
  typeof error === "object" &&
  error !== null &&
  "code" in error &&
  (error.code === "P2034" || error.code === "P2028");

const nextPosition = async (
  tx: Prisma.TransactionClient,
  projectId: string,
  status: TaskStatus,
) => {
  const result = await tx.task.aggregate({
    where: { projectId, status },
    _max: { position: true },
  });
  return result._max.position === null ? 0 : result._max.position + 1;
};
