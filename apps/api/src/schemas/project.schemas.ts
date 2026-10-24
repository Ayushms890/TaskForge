import { z } from "zod";

export const projectIdParamsSchema = z.object({
  projectId: z.string().uuid().or(z.string().min(1)),
});
export const workspaceProjectParamsSchema = z.object({
  workspaceId: z.string().min(1),
});
export const createProjectSchema = z.object({
  name: z.string().trim().min(1).max(120),
  key: z
    .string()
    .trim()
    .toUpperCase()
    .min(1)
    .max(10)
    .regex(/^[A-Z][A-Z0-9_-]*$/),
  description: z.string().trim().max(2000).optional(),
});
export type CreateProjectInput = z.infer<typeof createProjectSchema>;
