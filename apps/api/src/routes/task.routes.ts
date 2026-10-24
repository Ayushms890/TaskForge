import { Router } from "express";
import { authenticateUser } from "../middleware/authenticate-user.js";
import {
  validateBody,
  validateParams,
  validateQuery,
} from "../middleware/validate.js";
import {
  create,
  get,
  list,
  remove,
  update,
  status,
  position,
} from "../controllers/task.controller.js";
import {
  taskCreateSchema,
  taskIdParamsSchema,
  taskQuerySchema,
  taskUpdateSchema,
  taskStatusSchema,
  taskPositionSchema,
} from "../schemas/task.schemas.js";
export const taskRouter = Router();
taskRouter.use(authenticateUser);
taskRouter.post("/", validateBody(taskCreateSchema), create);
taskRouter.get("/", validateQuery(taskQuerySchema), list);
taskRouter.get("/search", validateQuery(taskQuerySchema), list);
taskRouter.get("/:taskId", validateParams(taskIdParamsSchema), get);
taskRouter.patch(
  "/:taskId/status",
  validateParams(taskIdParamsSchema),
  validateBody(taskStatusSchema),
  status,
);
taskRouter.patch(
  "/:taskId/position",
  validateParams(taskIdParamsSchema),
  validateBody(taskPositionSchema),
  position,
);
taskRouter.patch(
  "/:taskId",
  validateParams(taskIdParamsSchema),
  validateBody(taskUpdateSchema),
  update,
);
taskRouter.delete("/:taskId", validateParams(taskIdParamsSchema), remove);
