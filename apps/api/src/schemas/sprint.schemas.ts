import { z } from "zod";

const id = z.string().min(1);
const isoDate = z.string().datetime({ offset: true });
export const projectSprintParamsSchema = z.object({ projectId: id });
export const sprintIdParamsSchema = z.object({ sprintId: id });
const sprintFields = z.object({
  name: z.string().trim().min(1).max(120),
  goal: z.string().trim().min(1).max(2000).optional(),
  startDate: isoDate,
  endDate: isoDate,
});
const validateDates = (
  value: { startDate?: string | undefined; endDate?: string | undefined },
  ctx: z.RefinementCtx,
) => {
  if (
    value.startDate &&
    value.endDate &&
    new Date(value.endDate) < new Date(value.startDate)
  )
    ctx.addIssue({
      code: "custom",
      path: ["endDate"],
      message: "endDate must be on or after startDate.",
    });
};
export const createSprintSchema = sprintFields.superRefine((value, ctx) => {
  if (new Date(value.endDate) < new Date(value.startDate))
    ctx.addIssue({
      code: "custom",
      path: ["endDate"],
      message: "endDate must be on or after startDate.",
    });
});
export const updateSprintSchema = sprintFields
  .partial()
  .superRefine(validateDates);
export type CreateSprintInput = z.infer<typeof createSprintSchema>;
export type UpdateSprintInput = z.infer<typeof updateSprintSchema>;
