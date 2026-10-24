import type { CommentInput, PageQuery } from "../schemas/comment.schemas.js";
import type { CommentRepository } from "../repositories/comment.repository.js";
import type { ActivityRepository } from "../repositories/activity.repository.js";
import type { ProjectRepository } from "../repositories/project.repository.js";
import type { WorkspaceRepository } from "../repositories/workspace.repository.js";
import { commentRepository } from "../repositories/comment.repository.js";
import { activityRepository } from "../repositories/activity.repository.js";
import { projectRepository } from "../repositories/project.repository.js";
import { workspaceRepository } from "../repositories/workspace.repository.js";
import { prisma } from "../lib/prisma.js";
import { ForbiddenError, NotFoundError } from "../utils/http-error.js";

export const createCommentService = (
  comments: CommentRepository,
  activities: ActivityRepository,
  projects: ProjectRepository,
  workspaces: WorkspaceRepository,
) => {
  const authorizeProject = async (userId: string, projectId: string) => {
    const project = await projects.findById(projectId);
    if (!project || !(await workspaces.findMember(project.workspaceId, userId)))
      throw new NotFoundError("TASK_NOT_FOUND", "Task not found.");
    return (await workspaces.findMember(project.workspaceId, userId))!;
  };
  const authorizeTask = async (userId: string, taskId: string) => {
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      select: { projectId: true },
    });
    if (!task) throw new NotFoundError("TASK_NOT_FOUND", "Task not found.");
    return authorizeProject(userId, task.projectId);
  };
  return {
    async listComments(userId: string, taskId: string, q: PageQuery) {
      await authorizeTask(userId, taskId);
      const r = await comments.list(taskId, q.page, q.limit);
      return {
        comments: r.items,
        pagination: {
          page: q.page,
          limit: q.limit,
          total: r.total,
          totalPages: Math.ceil(r.total / q.limit),
        },
      };
    },
    async create(userId: string, taskId: string, input: CommentInput) {
      await authorizeTask(userId, taskId);
      return comments.create(taskId, userId, input.content);
    },
    async update(userId: string, commentId: string, input: CommentInput) {
      const c = await comments.findById(commentId);
      if (!c)
        throw new NotFoundError("COMMENT_NOT_FOUND", "Comment not found.");
      const member = await authorizeProject(userId, c.task.projectId);
      if (c.authorId !== userId)
        throw new ForbiddenError(
          "COMMENT_EDIT_FORBIDDEN",
          "Only the comment author can edit it.",
        );
      void member;
      return comments.update(commentId, input.content, userId);
    },
    async remove(userId: string, commentId: string) {
      const c = await comments.findById(commentId);
      if (!c)
        throw new NotFoundError("COMMENT_NOT_FOUND", "Comment not found.");
      const member = await authorizeProject(userId, c.task.projectId);
      if (
        c.authorId !== userId &&
        member.role !== "OWNER" &&
        member.role !== "ADMIN"
      )
        throw new ForbiddenError(
          "COMMENT_DELETE_FORBIDDEN",
          "You cannot delete this comment.",
        );
      await comments.remove(commentId, userId);
    },
    async listActivities(userId: string, taskId: string, q: PageQuery) {
      await authorizeTask(userId, taskId);
      const r = await activities.list(taskId, q.page, q.limit);
      return {
        activities: r.items,
        pagination: {
          page: q.page,
          limit: q.limit,
          total: r.total,
          totalPages: Math.ceil(r.total / q.limit),
        },
      };
    },
  };
};
export const commentService = createCommentService(
  commentRepository,
  activityRepository,
  projectRepository,
  workspaceRepository,
);
