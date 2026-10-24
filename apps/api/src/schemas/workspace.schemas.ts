import { z } from "zod";

export const workspaceNameSchema = z.string().trim().min(1).max(100);
const slugMax = 80;
export const workspaceSlugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(1)
  .max(slugMax)
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    "Slug must contain only letters, numbers and hyphens.",
  );
export const workspaceRoleSchema = z.enum(["OWNER", "ADMIN", "MEMBER"]);
export const createWorkspaceSchema = z.object({
  name: workspaceNameSchema,
  slug: workspaceSlugSchema,
});
export const addMemberSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  role: workspaceRoleSchema.default("MEMBER"),
});
export type CreateWorkspaceInput = z.infer<typeof createWorkspaceSchema>;
export type AddMemberInput = z.infer<typeof addMemberSchema>;
