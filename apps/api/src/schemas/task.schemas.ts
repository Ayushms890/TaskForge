import { z } from "zod";

const id = z.string().min(1);
export const taskIdParamsSchema = z.object({ taskId: id });
export const taskCreateSchema = z.object({
  projectId: id,
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(10000).optional(),
  status: z.enum(["TODO", "IN_PROGRESS", "DONE"]).optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).optional(),
  type: z.enum(["TASK", "BUG", "STORY"]).optional(),
  assigneeId: id.nullable().optional(),
  reporterId: id.nullable().optional(),
  sprintId: id.nullable().optional(),
});
export const taskUpdateSchema = taskCreateSchema
  .omit({ projectId: true, reporterId: true })
  .partial();
export const taskQuerySchema = z.object({
  projectId: id,
  page: z.coerce.number().int().min(1).max(100000).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(["TODO", "IN_PROGRESS", "DONE"]).optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).optional(),
  type: z.enum(["TASK", "BUG", "STORY"]).optional(),
  assigneeId: id
    .nullable()
    .transform((value) => (value === "unassigned" ? null : value))
    .optional(),
  sprintId: id
    .nullable()
    .transform((value) => (value === "backlog" ? null : value))
    .optional(),
  q: z.string().trim().max(200).optional(),
});
export const boardQuerySchema = taskQuerySchema.omit({ projectId: true });
export type BoardQuery = z.infer<typeof boardQuerySchema>;
export const taskStatusSchema = z.object({
  status: z.enum(["TODO", "IN_PROGRESS", "DONE"]),
});
export const taskPositionSchema = z.object({
  position: z.coerce.number().int().min(0),
  status: z.enum(["TODO", "IN_PROGRESS", "DONE"]).optional(),
});
export type CreateTaskInput = z.infer<typeof taskCreateSchema>;
export type UpdateTaskInput = z.infer<typeof taskUpdateSchema>;
export type TaskQuery = z.infer<typeof taskQuerySchema>;
export type TaskStatusInput = z.infer<typeof taskStatusSchema>;
export type TaskPositionInput = z.infer<typeof taskPositionSchema>;
