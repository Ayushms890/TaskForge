import type { Comment, Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";

type CommentWithAuthor = Prisma.CommentGetPayload<{
  include: { author: { select: { id: true; name: true } } };
}>;
export interface CommentRepository {
  list(
    taskId: string,
    page: number,
    limit: number,
  ): Promise<{ items: CommentWithAuthor[]; total: number }>;
  create(
    taskId: string,
    authorId: string,
    content: string,
  ): Promise<CommentWithAuthor>;
  update(
    id: string,
    content: string,
    actorId: string,
  ): Promise<CommentWithAuthor>;
  remove(id: string, actorId: string): Promise<void>;
  findById(
    id: string,
  ): Promise<(Comment & { task: { projectId: string } }) | null>;
}
const include = { author: { select: { id: true, name: true } } } as const;
export const commentRepository: CommentRepository = {
  list: async (taskId, page, limit) => {
    const where = { taskId };
    const [items, total] = await prisma.$transaction([
      prisma.comment.findMany({
        where,
        include,
        orderBy: { createdAt: "asc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.comment.count({ where }),
    ]);
    return { items, total };
  },
  create: (taskId, authorId, content) =>
    prisma.$transaction(async (tx) => {
      const comment = await tx.comment.create({
        data: { taskId, authorId, content },
        include,
      });
      await tx.activity.create({
        data: {
          taskId,
          userId: authorId,
          action: "COMMENT_ADDED",
          metadata: { commentId: comment.id },
        },
      });
      return comment;
    }),
  update: (id, content, actorId) =>
    prisma.$transaction(async (tx) => {
      const comment = await tx.comment.update({
        where: { id },
        data: { content },
        include,
      });
      await tx.activity.create({
        data: {
          taskId: comment.taskId,
          userId: actorId,
          action: "COMMENT_UPDATED",
          metadata: { commentId: id },
        },
      });
      return comment;
    }),
  remove: (id, actorId) =>
    prisma.$transaction(async (tx) => {
      const comment = await tx.comment.delete({ where: { id } });
      await tx.activity.create({
        data: {
          taskId: comment.taskId,
          userId: actorId,
          action: "COMMENT_DELETED",
          metadata: { commentId: id },
        },
      });
    }),
  findById: (id) =>
    prisma.comment.findUnique({
      where: { id },
      include: { task: { select: { projectId: true } } },
    }),
};
