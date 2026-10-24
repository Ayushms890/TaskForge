import { z } from "zod";

const id = z.string().min(1).max(100);
export const taskCommentsParamsSchema = z.object({ taskId: id });
export const commentIdParamsSchema = z.object({ commentId: id });
export const commentBodySchema = z.object({
  content: z.string().trim().min(1).max(10000),
});
export const pageQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(100000).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
export type CommentInput = z.infer<typeof commentBodySchema>;
export type PageQuery = z.infer<typeof pageQuerySchema>;
