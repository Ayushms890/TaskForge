import { Router } from "express";
import { authenticateUser } from "../middleware/authenticate-user.js";
import { validateBody, validateParams } from "../middleware/validate.js";
import {
  create,
  list,
  update,
  start,
  complete,
} from "../controllers/sprint.controller.js";
import {
  createSprintSchema,
  updateSprintSchema,
  projectSprintParamsSchema,
  sprintIdParamsSchema,
} from "../schemas/sprint.schemas.js";
export const sprintRouter = Router();
sprintRouter.use(authenticateUser);
sprintRouter.post(
  "/projects/:projectId/sprints",
  validateParams(projectSprintParamsSchema),
  validateBody(createSprintSchema),
  create,
);
sprintRouter.get(
  "/projects/:projectId/sprints",
  validateParams(projectSprintParamsSchema),
  list,
);
sprintRouter.patch(
  "/sprints/:sprintId",
  validateParams(sprintIdParamsSchema),
  validateBody(updateSprintSchema),
  update,
);
sprintRouter.post(
  "/sprints/:sprintId/start",
  validateParams(sprintIdParamsSchema),
  start,
);
sprintRouter.post(
  "/sprints/:sprintId/complete",
  validateParams(sprintIdParamsSchema),
  complete,
);
