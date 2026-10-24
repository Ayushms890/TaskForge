import type {
  Task,
  TaskPriority,
  TaskStatus,
  TaskType,
  Prisma,
} from "@prisma/client";
import type {
  CreateTaskInput,
  TaskQuery,
  UpdateTaskInput,
  TaskPositionInput,
  TaskStatusInput,
  BoardQuery,
} from "../schemas/task.schemas.js";
import type { TaskRepository } from "../repositories/task.repository.js";
import { taskUpdateSchema } from "../schemas/task.schemas.js";
import type { ProjectRepository } from "../repositories/project.repository.js";
import type { WorkspaceRepository } from "../repositories/workspace.repository.js";
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from "../utils/http-error.js";
import { taskRepository } from "../repositories/task.repository.js";
import { projectRepository } from "../repositories/project.repository.js";
import { workspaceRepository } from "../repositories/workspace.repository.js";
import type { SprintRepository } from "../repositories/sprint.repository.js";
import { sprintRepository } from "../repositories/sprint.repository.js";
import { taskPagination } from "../repositories/task-query.js";

const isCode = (e: unknown, code: string) =>
  typeof e === "object" && e !== null && "code" in e && e.code === code;
const output = (task: Task, key?: string) => ({
  ...task,
  identifier: key ? `${key}-${task.number}` : undefined,
});
export interface TaskService {
  create(userId: string, input: CreateTaskInput): Promise<unknown>;
  list(userId: string, query: TaskQuery): Promise<unknown>;
  get(userId: string, taskId: string): Promise<unknown>;
  update(
    userId: string,
    taskId: string,
    input: UpdateTaskInput,
  ): Promise<unknown>;
  remove(userId: string, taskId: string): Promise<void>;
  board(
    userId: string,
    projectId: string,
    query?: BoardQuery,
  ): Promise<unknown>;
  changeStatus(
    userId: string,
    taskId: string,
    input: TaskStatusInput,
  ): Promise<unknown>;
  changePosition(
    userId: string,
    taskId: string,
    input: TaskPositionInput,
  ): Promise<unknown>;
}
export const createTaskService = (
  tasks: TaskRepository,
  projects: ProjectRepository,
  workspaces: WorkspaceRepository,
  sprints: SprintRepository = sprintRepository,
): TaskService => {
  const authorize = async (userId: string, projectId: string) => {
    const project = await projects.findById(projectId);
    if (!project)
      throw new NotFoundError("PROJECT_NOT_FOUND", "Project not found.");
    const member = await workspaces.findMember(project.workspaceId, userId);
    if (!member)
      throw new NotFoundError("PROJECT_NOT_FOUND", "Project not found.");
    return { project, member };
  };
  const validateAssignment = async (
    workspaceId: string,
    assigneeId: string | null | undefined,
  ) => {
    if (assigneeId === undefined || assigneeId === null) return;
    if (!(await workspaces.findMember(workspaceId, assigneeId)))
      throw new NotFoundError(
        "TASK_ASSIGNEE_NOT_FOUND",
        "Assignee must be a member of the task workspace.",
      );
  };
  const validateSprint = async (
    projectId: string,
    sprintId: string | null | undefined,
  ) => {
    if (sprintId === undefined || sprintId === null) return;
    const sprint = await sprints.findById(sprintId);
    if (!sprint || sprint.projectId !== projectId)
      throw new NotFoundError(
        "SPRINT_NOT_FOUND",
        "Sprint not found in this project.",
      );
    if (sprint.status === "COMPLETED")
      throw new ConflictError(
        "SPRINT_COMPLETED",
        "Tasks cannot be assigned to a completed sprint.",
      );
  };
  return {
    async create(userId, input) {
      const { project, member } = await authorize(userId, input.projectId);
      if (
        member.role === "MEMBER" &&
        ((input.assigneeId != null && input.assigneeId !== userId) ||
          (input.sprintId !== undefined && input.sprintId !== null))
      )
        throw new ForbiddenError(
          "TASK_ASSIGNMENT_FORBIDDEN",
          "Members may only create tasks assigned to themselves without a sprint.",
        );
      await validateAssignment(project.workspaceId, input.assigneeId);
      await validateSprint(project.id, input.sprintId);
      const assigneeId = member.role === "MEMBER" ? userId : input.assigneeId;
      try {
        return output(
          await tasks.createNext({
            ...input,
            assigneeId,
            reporterId: userId,
            status: input.status as TaskStatus,
            priority: input.priority as TaskPriority,
            type: input.type as TaskType,
            actorId: userId,
          }),
          project.key,
        );
      } catch (e) {
        if (isCode(e, "P2002"))
          throw new ConflictError(
            "TASK_NUMBER_CONFLICT",
            "Could not allocate a task number.",
          );
        throw e;
      }
    },
    async list(userId, query) {
      const { project } = await authorize(userId, query.projectId);
      const result = await tasks.list({
        ...query,
        status: query.status as TaskStatus,
        priority: query.priority as TaskPriority,
        type: query.type as TaskType,
      });
      return {
        tasks: result.items.map((t) => output(t, project.key)),
        pagination: taskPagination(query, result.total),
      };
    },
    async get(userId, taskId) {
      const task = await tasks.findById(taskId);
      if (!task) throw new NotFoundError("TASK_NOT_FOUND", "Task not found.");
      const { project } = await authorize(userId, task.projectId);
      return output(task, project.key);
    },
    async update(userId, taskId, input) {
      input = taskUpdateSchema.parse(input);
      const task = await tasks.findById(taskId);
      if (!task) throw new NotFoundError("TASK_NOT_FOUND", "Task not found.");
      const { project, member } = await authorize(userId, task.projectId);
      if (member.role === "MEMBER") {
        if (
          Object.prototype.hasOwnProperty.call(input, "assigneeId") ||
          Object.prototype.hasOwnProperty.call(input, "sprintId")
        )
          throw new ForbiddenError(
            "TASK_ASSIGNMENT_FORBIDDEN",
            "Members cannot change task assignment or sprint.",
          );
        if (task.assigneeId !== userId)
          throw new ForbiddenError(
            "TASK_UPDATE_FORBIDDEN",
            "Members may only update tasks assigned to themselves.",
          );
      }
      if (input.sprintId !== undefined && input.sprintId !== null) {
        await validateSprint(task.projectId, input.sprintId);
      }
      await validateAssignment(project.workspaceId, input.assigneeId);
      try {
        const saved = await tasks.update(
          taskId,
          input as Prisma.TaskUpdateInput,
          userId,
        );
        return output(saved, project.key);
      } catch (e) {
        if (isCode(e, "P2025"))
          throw new NotFoundError("TASK_NOT_FOUND", "Task not found.");
        throw e;
      }
    },
    async remove(userId, taskId) {
      const task = await tasks.findById(taskId);
      if (!task) throw new NotFoundError("TASK_NOT_FOUND", "Task not found.");
      const { member } = await authorize(userId, task.projectId);
      if (member.role !== "OWNER" && member.role !== "ADMIN")
        throw new ForbiddenError(
          "TASK_DELETE_FORBIDDEN",
          "Only workspace owners and admins can delete tasks.",
        );
      await tasks.remove(taskId);
    },
    async board(userId, projectId, query = { page: 1, limit: 20 }) {
      const { project } = await authorize(userId, projectId);
      const { items, total } = await tasks.list({
        ...query,
        projectId,
        order: "board",
      });
      return {
        pagination: taskPagination(query, total),
        project: {
          id: project.id,
          workspaceId: project.workspaceId,
          name: project.name,
          key: project.key,
          description: project.description,
          createdAt: project.createdAt,
          updatedAt: project.updatedAt,
        },
        columns: Object.fromEntries(
          (["TODO", "IN_PROGRESS", "DONE"] as const).map((status) => [
            status,
            items
              .filter((task) => task.status === status)
              .map((task) => output(task, project.key)),
          ]),
        ),
      };
    },
    async changeStatus(userId, taskId, input) {
      const task = await tasks.findById(taskId);
      if (!task) throw new NotFoundError("TASK_NOT_FOUND", "Task not found.");
      const { project, member } = await authorize(userId, task.projectId);
      if (member.role === "MEMBER" && task.assigneeId !== userId)
        throw new ForbiddenError(
          "TASK_UPDATE_FORBIDDEN",
          "Members may only move tasks assigned to themselves.",
        );
      try {
        return output(
          await tasks.move(
            taskId,
            { status: input.status as TaskStatus },
            userId,
          ),
          project.key,
        );
      } catch (e) {
        if (isCode(e, "P2025"))
          throw new NotFoundError("TASK_NOT_FOUND", "Task not found.");
        throw e;
      }
    },
    async changePosition(userId, taskId, input) {
      const task = await tasks.findById(taskId);
      if (!task) throw new NotFoundError("TASK_NOT_FOUND", "Task not found.");
      const { project, member } = await authorize(userId, task.projectId);
      if (member.role === "MEMBER" && task.assigneeId !== userId)
        throw new ForbiddenError(
          "TASK_UPDATE_FORBIDDEN",
          "Members may only move tasks assigned to themselves.",
        );
      try {
        const move: { status?: TaskStatus; position: number } = {
          position: input.position,
        };
        if (input.status) move.status = input.status as TaskStatus;
        return output(await tasks.move(taskId, move, userId), project.key);
      } catch (e) {
        if (isCode(e, "P2025"))
          throw new NotFoundError("TASK_NOT_FOUND", "Task not found.");
        throw e;
      }
    },
  };
};
export const taskService = createTaskService(
  taskRepository,
  projectRepository,
  workspaceRepository,
);
