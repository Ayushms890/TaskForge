import type { Prisma, WorkspaceMember, WorkspaceRole } from "@prisma/client";
import { prisma } from "../lib/prisma.js";

export type WorkspaceWithMembers = Prisma.WorkspaceGetPayload<{
  include: { members: { include: { user: true } } };
}>;
export type WorkspaceMemberWithUser = Prisma.WorkspaceMemberGetPayload<{
  include: { user: true };
}>;

export interface WorkspaceRepository {
  createWithOwner(data: {
    name: string;
    slug: string;
    userId: string;
  }): Promise<WorkspaceWithMembers>;
  listForUser(userId: string): Promise<WorkspaceWithMembers[]>;
  findForUser(
    workspaceId: string,
    userId: string,
  ): Promise<WorkspaceWithMembers | null>;
  findById(workspaceId: string): Promise<WorkspaceWithMembers | null>;
  findMember(
    workspaceId: string,
    userId: string,
  ): Promise<WorkspaceMember | null>;
  findMemberByEmail(
    workspaceId: string,
    email: string,
  ): Promise<WorkspaceMemberWithUser | null>;
  findUserByEmail(
    email: string,
  ): Promise<{ id: string; email: string; name: string } | null>;
  addMember(data: {
    workspaceId: string;
    userId: string;
    role: WorkspaceRole;
  }): Promise<WorkspaceMemberWithUser>;
  removeMember(workspaceId: string, userId: string): Promise<void>;
  delete(workspaceId: string): Promise<void>;
}

const include = { members: { include: { user: true } } } as const;
export const workspaceRepository: WorkspaceRepository = {
  createWithOwner: ({ name, slug, userId }) =>
    prisma.$transaction(async (tx) => {
      const workspace = await tx.workspace.create({ data: { name, slug } });
      await tx.workspaceMember.create({
        data: { workspaceId: workspace.id, userId, role: "OWNER" },
      });
      return tx.workspace.findUniqueOrThrow({
        where: { id: workspace.id },
        include,
      });
    }),
  listForUser: (userId) =>
    prisma.workspace.findMany({
      where: { members: { some: { userId } } },
      include,
      orderBy: { createdAt: "asc" },
    }),
  findForUser: (workspaceId, userId) =>
    prisma.workspace.findFirst({
      where: { id: workspaceId, members: { some: { userId } } },
      include,
    }),
  findById: (workspaceId) =>
    prisma.workspace.findUnique({ where: { id: workspaceId }, include }),
  findMember: (workspaceId, userId) =>
    prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId } },
    }),
  findMemberByEmail: (workspaceId, email) =>
    prisma.workspaceMember.findFirst({
      where: { workspaceId, user: { email } },
      include: { user: true },
    }),
  findUserByEmail: (email) =>
    prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true, name: true },
    }),
  addMember: (data) =>
    prisma.workspaceMember.create({ data, include: { user: true } }),
  removeMember: (workspaceId, userId) =>
    prisma.workspaceMember
      .delete({ where: { workspaceId_userId: { workspaceId, userId } } })
      .then(() => undefined),
  delete: (workspaceId) =>
    prisma.$transaction(async (tx) => {
      await tx.workspace.delete({ where: { id: workspaceId } });
    }),
};
