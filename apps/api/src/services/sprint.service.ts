import type { Prisma, Sprint } from "@prisma/client";
import type { ProjectRepository } from "../repositories/project.repository.js";
import type { SprintRepository } from "../repositories/sprint.repository.js";
import type { WorkspaceRepository } from "../repositories/workspace.repository.js";
import type {
  CreateSprintInput,
  UpdateSprintInput,
} from "../schemas/sprint.schemas.js";
import { sprintRepository } from "../repositories/sprint.repository.js";
import { projectRepository } from "../repositories/project.repository.js";
import { workspaceRepository } from "../repositories/workspace.repository.js";
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from "../utils/http-error.js";

const isCode = (e: unknown, code: string) =>
  typeof e === "object" && e !== null && "code" in e && e.code === code;
const output = (s: Sprint) => s;
export interface SprintService {
  create(
    userId: string,
    projectId: string,
    input: CreateSprintInput,
  ): Promise<Sprint>;
  list(userId: string, projectId: string): Promise<Sprint[]>;
  update(
    userId: string,
    sprintId: string,
    input: UpdateSprintInput,
  ): Promise<Sprint>;
  start(userId: string, sprintId: string): Promise<Sprint>;
  complete(userId: string, sprintId: string): Promise<Sprint>;
}
export const createSprintService = (
  sprints: SprintRepository,
  projects: ProjectRepository,
  workspaces: WorkspaceRepository,
): SprintService => {
  const authorize = async (
    userId: string,
    projectId: string,
    mutate = false,
  ) => {
    const project = await projects.findById(projectId);
    if (!project)
      throw new NotFoundError("PROJECT_NOT_FOUND", "Project not found.");
    const member = await workspaces.findMember(project.workspaceId, userId);
    if (!member)
      throw new NotFoundError("PROJECT_NOT_FOUND", "Project not found.");
    if (mutate && member.role !== "OWNER" && member.role !== "ADMIN")
      throw new ForbiddenError(
        "SPRINT_MANAGE_FORBIDDEN",
        "Only workspace owners and admins can manage sprints.",
      );
    return project;
  };
  const getAuthorized = async (
    userId: string,
    sprintId: string,
    mutate = false,
  ) => {
    const sprint = await sprints.findById(sprintId);
    if (!sprint)
      throw new NotFoundError("SPRINT_NOT_FOUND", "Sprint not found.");
    await authorize(userId, sprint.projectId, mutate);
    return sprint;
  };
  return {
    async create(userId, projectId, input) {
      await authorize(userId, projectId, true);
      try {
        return output(
          await sprints.create({
            projectId,
            name: input.name,
            goal: input.goal ?? null,
            startDate: new Date(input.startDate),
            endDate: new Date(input.endDate),
          }),
        );
      } catch (e) {
        if (isCode(e, "P2002"))
          throw new ConflictError(
            "ACTIVE_SPRINT_EXISTS",
            "The project already has an active sprint.",
          );
        throw e;
      }
    },
    async list(userId, projectId) {
      await authorize(userId, projectId);
      return (await sprints.listForProject(projectId)).map(output);
    },
    async update(userId, sprintId, input) {
      const sprint = await getAuthorized(userId, sprintId, true);
      if (sprint.status === "COMPLETED")
        throw new ConflictError(
          "SPRINT_COMPLETED",
          "Completed sprints cannot be modified.",
        );
      const data: Prisma.SprintUpdateInput = {};
      if (input.name !== undefined) data.name = input.name;
      if (input.goal !== undefined) data.goal = input.goal;
      if (input.startDate !== undefined)
        data.startDate = new Date(input.startDate);
      if (input.endDate !== undefined) data.endDate = new Date(input.endDate);
      if (
        input.startDate &&
        input.endDate &&
        new Date(input.endDate) < new Date(input.startDate)
      )
        throw new ConflictError(
          "INVALID_SPRINT_DATES",
          "endDate must be on or after startDate.",
        );
      if (
        input.startDate &&
        !input.endDate &&
        new Date(sprint.endDate) < new Date(input.startDate)
      )
        throw new ConflictError(
          "INVALID_SPRINT_DATES",
          "endDate must be on or after startDate.",
        );
      if (
        input.endDate &&
        !input.startDate &&
        new Date(input.endDate) < new Date(sprint.startDate)
      )
        throw new ConflictError(
          "INVALID_SPRINT_DATES",
          "endDate must be on or after startDate.",
        );
      return output(await sprints.update(sprintId, data));
    },
    async start(userId, sprintId) {
      const sprint = await getAuthorized(userId, sprintId, true);
      if (sprint.status !== "PLANNED")
        throw new ConflictError(
          "INVALID_SPRINT_TRANSITION",
          "Only planned sprints can start.",
        );
      try {
        return output(await sprints.start(sprintId));
      } catch (e) {
        if (isCode(e, "P2002"))
          throw new ConflictError(
            "ACTIVE_SPRINT_EXISTS",
            "The project already has an active sprint.",
          );
        throw e;
      }
    },
    async complete(userId, sprintId) {
      const sprint = await getAuthorized(userId, sprintId, true);
      if (sprint.status !== "ACTIVE")
        throw new ConflictError(
          "INVALID_SPRINT_TRANSITION",
          "Only active sprints can complete.",
        );
      return output(await sprints.complete(sprintId));
    },
  };
};
export const sprintService = createSprintService(
  sprintRepository,
  projectRepository,
  workspaceRepository,
);
