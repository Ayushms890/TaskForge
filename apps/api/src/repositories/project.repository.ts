import type { Prisma, Project } from "@prisma/client";
import { prisma } from "../lib/prisma.js";

export type ProjectWithTasks = Prisma.ProjectGetPayload<{
  include: { tasks: true };
}>;
export interface ProjectRepository {
  create(data: {
    workspaceId: string;
    name: string;
    key: string;
    description?: string | undefined;
  }): Promise<Project>;
  listForWorkspace(workspaceId: string): Promise<Project[]>;
  findById(id: string): Promise<Project | null>;
  findForUser(id: string, userId: string): Promise<Project | null>;
}
export const projectRepository: ProjectRepository = {
  create: (data) =>
    prisma.project.create({
      data: { ...data, description: data.description ?? null },
    }),
  listForWorkspace: (workspaceId) =>
    prisma.project.findMany({
      where: { workspaceId },
      orderBy: { createdAt: "asc" },
    }),
  findById: (id) => prisma.project.findUnique({ where: { id } }),
  findForUser: (id, userId) =>
    prisma.project.findFirst({
      where: { id, workspace: { members: { some: { userId } } } },
    }),
};
