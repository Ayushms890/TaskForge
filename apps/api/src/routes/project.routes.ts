import { Router } from "express";
import { authenticateUser } from "../middleware/authenticate-user.js";
import {
  validateBody,
  validateParams,
  validateQuery,
} from "../middleware/validate.js";
import { boardQuerySchema } from "../schemas/task.schemas.js";
import {
  create,
  dashboard,
  get,
  list,
} from "../controllers/project.controller.js";
import { board } from "../controllers/project.controller.js";
import {
  createProjectSchema,
  projectIdParamsSchema,
  workspaceProjectParamsSchema,
} from "../schemas/project.schemas.js";
export const projectRouter = Router();
projectRouter.use(authenticateUser);
projectRouter.get(
  "/projects/:projectId/dashboard",
  validateParams(projectIdParamsSchema),
  dashboard,
);
projectRouter.post(
  "/workspaces/:workspaceId/projects",
  validateParams(workspaceProjectParamsSchema),
  validateBody(createProjectSchema),
  create,
);
projectRouter.get(
  "/workspaces/:workspaceId/projects",
  validateParams(workspaceProjectParamsSchema),
  list,
);
projectRouter.get(
  "/workspaces/:workspaceId/projects/:projectId",
  validateParams(workspaceProjectParamsSchema.merge(projectIdParamsSchema)),
  get,
);
projectRouter.get(
  "/projects/:projectId",
  validateParams(projectIdParamsSchema),
  get,
);
projectRouter.get(
  "/projects/:projectId/board",
  validateParams(projectIdParamsSchema),
  validateQuery(boardQuerySchema),
  board,
);
