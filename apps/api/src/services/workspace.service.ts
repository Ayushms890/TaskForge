import type { WorkspaceRole } from "@prisma/client";
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from "../utils/http-error.js";
import type {
  AddMemberInput,
  CreateWorkspaceInput,
} from "../schemas/workspace.schemas.js";
import {
  workspaceRepository,
  type WorkspaceRepository,
  type WorkspaceWithMembers,
} from "../repositories/workspace.repository.js";

const isCode = (error: unknown, code: string) =>
  typeof error === "object" &&
  error !== null &&
  "code" in error &&
  error.code === code;
const publicMember = (member: WorkspaceWithMembers["members"][number]) => ({
  id: member.id,
  role: member.role,
  createdAt: member.createdAt,
  user: {
    id: member.user.id,
    name: member.user.name,
    email: member.user.email,
    avatarUrl: member.user.avatarUrl,
  },
});
const publicWorkspace = (workspace: WorkspaceWithMembers) => ({
  id: workspace.id,
  name: workspace.name,
  slug: workspace.slug,
  createdAt: workspace.createdAt,
  updatedAt: workspace.updatedAt,
  members: workspace.members.map(publicMember),
});

export interface WorkspaceService {
  create(
    userId: string,
    input: CreateWorkspaceInput,
  ): Promise<ReturnType<typeof publicWorkspace>>;
  list(userId: string): Promise<ReturnType<typeof publicWorkspace>[]>;
  get(
    userId: string,
    workspaceId: string,
  ): Promise<ReturnType<typeof publicWorkspace>>;
  addMember(
    userId: string,
    workspaceId: string,
    input: AddMemberInput,
  ): Promise<ReturnType<typeof publicMember>>;
  removeMember(
    userId: string,
    workspaceId: string,
    memberUserId: string,
  ): Promise<void>;
  delete(userId: string, workspaceId: string): Promise<void>;
}

export const createWorkspaceService = (
  repository: WorkspaceRepository,
): WorkspaceService => ({
  async create(userId, input) {
    try {
      return publicWorkspace(
        await repository.createWithOwner({ ...input, userId }),
      );
    } catch (error) {
      if (isCode(error, "P2002"))
        throw new ConflictError(
          "WORKSPACE_SLUG_ALREADY_EXISTS",
          "A workspace with this slug already exists.",
        );
      throw error;
    }
  },
  async list(userId) {
    return (await repository.listForUser(userId)).map(publicWorkspace);
  },
  async get(userId, workspaceId) {
    const workspace = await repository.findForUser(workspaceId, userId);
    if (!workspace)
      throw new NotFoundError("WORKSPACE_NOT_FOUND", "Workspace not found.");
    return publicWorkspace(workspace);
  },
  async addMember(userId, workspaceId, input) {
    const actor = await repository.findMember(workspaceId, userId);
    if (!actor)
      throw new NotFoundError("WORKSPACE_NOT_FOUND", "Workspace not found.");
    if (actor.role !== "OWNER" && actor.role !== "ADMIN")
      throw new ForbiddenError(
        "WORKSPACE_MEMBER_MANAGEMENT_FORBIDDEN",
        "You cannot manage workspace members.",
      );
    if (actor.role === "ADMIN" && input.role !== "MEMBER")
      throw new ForbiddenError(
        "WORKSPACE_ROLE_FORBIDDEN",
        "Admins may only add members.",
      );
    const target = await repository.findUserByEmail(input.email);
    if (!target) throw new NotFoundError("USER_NOT_FOUND", "User not found.");
    if (await repository.findMember(workspaceId, target.id))
      throw new ConflictError(
        "WORKSPACE_MEMBER_ALREADY_EXISTS",
        "That user is already a workspace member.",
      );
    try {
      return publicMember(
        await repository.addMember({
          workspaceId,
          userId: target.id,
          role: input.role as WorkspaceRole,
        }),
      );
    } catch (error) {
      if (isCode(error, "P2002"))
        throw new ConflictError(
          "WORKSPACE_MEMBER_ALREADY_EXISTS",
          "That user is already a workspace member.",
        );
      throw error;
    }
  },
  async removeMember(userId, workspaceId, memberUserId) {
    const actor = await repository.findMember(workspaceId, userId);
    if (!actor)
      throw new NotFoundError("WORKSPACE_NOT_FOUND", "Workspace not found.");
    if (actor.role !== "OWNER" && actor.role !== "ADMIN")
      throw new ForbiddenError(
        "WORKSPACE_MEMBER_MANAGEMENT_FORBIDDEN",
        "You cannot manage workspace members.",
      );
    const target = await repository.findMember(workspaceId, memberUserId);
    if (!target)
      throw new NotFoundError(
        "WORKSPACE_MEMBER_NOT_FOUND",
        "Workspace member not found.",
      );
    if (target.role === "OWNER")
      throw new ForbiddenError(
        "WORKSPACE_OWNER_PROTECTED",
        "The workspace owner cannot be removed.",
      );
    if (actor.role === "ADMIN" && target.role !== "MEMBER")
      throw new ForbiddenError(
        "WORKSPACE_ROLE_FORBIDDEN",
        "Admins may only remove members.",
      );
    await repository.removeMember(workspaceId, memberUserId);
  },
  async delete(userId, workspaceId) {
    const actor = await repository.findMember(workspaceId, userId);
    if (!actor)
      throw new NotFoundError("WORKSPACE_NOT_FOUND", "Workspace not found.");
    if (actor.role !== "OWNER")
      throw new ForbiddenError(
        "WORKSPACE_DELETE_FORBIDDEN",
        "Only the workspace owner can delete a workspace.",
      );
    try {
      await repository.delete(workspaceId);
    } catch (error) {
      if (isCode(error, "P2025"))
        throw new NotFoundError("WORKSPACE_NOT_FOUND", "Workspace not found.");
      throw error;
    }
  },
});

export const workspaceService = createWorkspaceService(workspaceRepository);
