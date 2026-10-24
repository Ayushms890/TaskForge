import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from "../utils/http-error.js";
import type { CreateProjectInput } from "../schemas/project.schemas.js";
import type { ProjectRepository } from "../repositories/project.repository.js";
import type { WorkspaceRepository } from "../repositories/workspace.repository.js";
import { projectRepository } from "../repositories/project.repository.js";
import { workspaceRepository } from "../repositories/workspace.repository.js";

const isCode = (e: unknown, code: string) =>
  typeof e === "object" && e !== null && "code" in e && e.code === code;
import type { Project } from "@prisma/client";
const publicProject = (p: Project) => ({
  id: p.id,
  workspaceId: p.workspaceId,
  name: p.name,
  key: p.key,
  description: p.description,
  createdAt: p.createdAt,
  updatedAt: p.updatedAt,
});
export interface ProjectService {
  create(
    userId: string,
    workspaceId: string,
    input: CreateProjectInput,
  ): Promise<ReturnType<typeof publicProject>>;
  list(
    userId: string,
    workspaceId: string,
  ): Promise<ReturnType<typeof publicProject>[]>;
  get(
    userId: string,
    projectId: string,
  ): Promise<ReturnType<typeof publicProject>>;
}
export const createProjectService = (
  projects: ProjectRepository,
  workspaces: WorkspaceRepository,
): ProjectService => ({
  async create(userId, workspaceId, input) {
    const member = await workspaces.findMember(workspaceId, userId);
    if (!member)
      throw new NotFoundError("WORKSPACE_NOT_FOUND", "Workspace not found.");
    if (member.role !== "OWNER" && member.role !== "ADMIN")
      throw new ForbiddenError(
        "PROJECT_CREATE_FORBIDDEN",
        "You cannot create projects.",
      );
    try {
      return publicProject(await projects.create({ workspaceId, ...input }));
    } catch (e) {
      if (isCode(e, "P2002"))
        throw new ConflictError(
          "PROJECT_KEY_ALREADY_EXISTS",
          "A project with this key already exists in the workspace.",
        );
      throw e;
    }
  },
  async list(userId, workspaceId) {
    if (!(await workspaces.findMember(workspaceId, userId)))
      throw new NotFoundError("WORKSPACE_NOT_FOUND", "Workspace not found.");
    return (await projects.listForWorkspace(workspaceId)).map(publicProject);
  },
  async get(userId, projectId) {
    const project = await projects.findForUser(projectId, userId);
    if (!project)
      throw new NotFoundError("PROJECT_NOT_FOUND", "Project not found.");
    return publicProject(project);
  },
});
export const projectService = createProjectService(
  projectRepository,
  workspaceRepository,
);
