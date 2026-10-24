import { Router } from "express";
import { authenticateUser } from "../middleware/authenticate-user.js";
import { validateBody } from "../middleware/validate.js";
import {
  addMember,
  create,
  getDetails,
  listMembers,
  listMine,
  removeMember,
  remove,
} from "../controllers/workspace.controller.js";
import {
  addMemberSchema,
  createWorkspaceSchema,
} from "../schemas/workspace.schemas.js";

export const workspaceRouter = Router();
workspaceRouter.use(authenticateUser);
workspaceRouter.post("/", validateBody(createWorkspaceSchema), create);
workspaceRouter.get("/", listMine);
workspaceRouter.get("/:workspaceId", getDetails);
workspaceRouter.delete("/:workspaceId", remove);
workspaceRouter.get("/:workspaceId/members", listMembers);
workspaceRouter.post(
  "/:workspaceId/members",
  validateBody(addMemberSchema),
  addMember,
);
workspaceRouter.delete("/:workspaceId/members/:userId", removeMember);
