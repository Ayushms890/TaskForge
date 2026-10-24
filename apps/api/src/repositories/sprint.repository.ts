import { Prisma, type Sprint } from "@prisma/client";
import { prisma } from "../lib/prisma.js";

export interface SprintRepository {
  create(data: {
    projectId: string;
    name: string;
    goal?: string | null;
    startDate: Date;
    endDate: Date;
  }): Promise<Sprint>;
  listForProject(projectId: string): Promise<Sprint[]>;
  findById(id: string): Promise<Sprint | null>;
  update(id: string, data: Prisma.SprintUpdateInput): Promise<Sprint>;
  start(id: string): Promise<Sprint>;
  complete(id: string): Promise<Sprint>;
}
const transition = (
  id: string,
  from: "PLANNED" | "ACTIVE",
  to: "ACTIVE" | "COMPLETED",
) =>
  prisma.$transaction(
    async (tx) => {
      const sprint = await tx.sprint.findUnique({ where: { id } });
      if (!sprint)
        throw Object.assign(new Error("Sprint not found"), { code: "P2025" });
      if (sprint.status !== from)
        throw Object.assign(new Error("Invalid sprint transition"), {
          code: "INVALID_TRANSITION",
        });
      if (to === "ACTIVE") {
        const active = await tx.sprint.findFirst({
          where: {
            projectId: sprint.projectId,
            status: "ACTIVE",
            id: { not: id },
          },
          select: { id: true },
        });
        if (active)
          throw Object.assign(new Error("An active sprint already exists"), {
            code: "P2002",
          });
      }
      return tx.sprint.update({ where: { id }, data: { status: to } });
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
export const sprintRepository: SprintRepository = {
  create: (data) => prisma.sprint.create({ data }),
  listForProject: (projectId) =>
    prisma.sprint.findMany({
      where: { projectId },
      orderBy: { startDate: "asc" },
    }),
  findById: (id) => prisma.sprint.findUnique({ where: { id } }),
  update: (id, data) => prisma.sprint.update({ where: { id }, data }),
  start: (id) => transition(id, "PLANNED", "ACTIVE"),
  complete: (id) => transition(id, "ACTIVE", "COMPLETED"),
};
