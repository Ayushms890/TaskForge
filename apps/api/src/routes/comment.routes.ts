import { Router } from "express";
import { authenticateUser } from "../middleware/authenticate-user.js";
import {
  validateBody,
  validateParams,
  validateQuery,
} from "../middleware/validate.js";
import {
  commentBodySchema,
  commentIdParamsSchema,
  pageQuerySchema,
  taskCommentsParamsSchema,
} from "../schemas/comment.schemas.js";
import {
  create,
  listActivities,
  listComments,
  remove,
  update,
} from "../controllers/comment.controller.js";
export const commentRouter = Router();
commentRouter.use(authenticateUser);
commentRouter.get(
  "/tasks/:taskId/comments",
  validateParams(taskCommentsParamsSchema),
  validateQuery(pageQuerySchema),
  listComments,
);
commentRouter.post(
  "/tasks/:taskId/comments",
  validateParams(taskCommentsParamsSchema),
  validateBody(commentBodySchema),
  create,
);
commentRouter.get(
  "/tasks/:taskId/activities",
  validateParams(taskCommentsParamsSchema),
  validateQuery(pageQuerySchema),
  listActivities,
);
commentRouter.patch(
  "/comments/:commentId",
  validateParams(commentIdParamsSchema),
  validateBody(commentBodySchema),
  update,
);
commentRouter.delete(
  "/comments/:commentId",
  validateParams(commentIdParamsSchema),
  remove,
);
