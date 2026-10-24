import type { RequestHandler } from "express";
import { UnauthorizedError } from "../utils/http-error.js";
import { workspaceService } from "../services/workspace.service.js";

const userId = (request: Parameters<RequestHandler>[0]) => {
  if (!request.user)
    throw new UnauthorizedError(
      "AUTHENTICATION_REQUIRED",
      "Authentication is required.",
    );
  return request.user.id;
};
const param = (
  request: Parameters<RequestHandler>[0],
  name: string,
): string => {
  const value = request.params[name];
  if (typeof value !== "string")
    throw new Error(`Missing route parameter: ${name}`);
  return value;
};
const run =
  (
    handler: (request: Parameters<RequestHandler>[0]) => Promise<unknown>,
    status = 200,
  ): RequestHandler =>
  async (request, response, next) => {
    try {
      response
        .status(status)
        .json({ success: true, data: await handler(request) });
    } catch (error) {
      next(error);
    }
  };

export const create = run(
  async (request) => ({
    workspace: await workspaceService.create(userId(request), request.body),
  }),
  201,
);
export const listMine = run(async (request) => ({
  workspaces: await workspaceService.list(userId(request)),
}));
export const getDetails = run(async (request) => ({
  workspace: await workspaceService.get(
    userId(request),
    param(request, "workspaceId"),
  ),
}));
export const listMembers = run(async (request) => {
  const workspace = await workspaceService.get(
    userId(request),
    param(request, "workspaceId"),
  );
  return { members: workspace.members };
});
export const addMember = run(async (request) => ({
  member: await workspaceService.addMember(
    userId(request),
    param(request, "workspaceId"),
    request.body,
  ),
}));
export const removeMember: RequestHandler = async (request, response, next) => {
  try {
    await workspaceService.removeMember(
      userId(request),
      param(request, "workspaceId"),
      param(request, "userId"),
    );
    response.json({
      success: true,
      data: null,
      message: "Workspace member removed successfully.",
    });
  } catch (error) {
    next(error);
  }
};
export const remove: RequestHandler = async (request, response, next) => {
  try {
    await workspaceService.delete(
      userId(request),
      param(request, "workspaceId"),
    );
    response.json({
      success: true,
      data: null,
      message: "Workspace deleted successfully.",
    });
  } catch (error) {
    next(error);
  }
};
