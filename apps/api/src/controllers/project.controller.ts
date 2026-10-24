import type { RequestHandler } from "express";
import { UnauthorizedError } from "../utils/http-error.js";
import { projectService } from "../services/project.service.js";
import { taskService } from "../services/task.service.js";
import { dashboardService } from "../services/dashboard.service.js";
const uid = (r: Parameters<RequestHandler>[0]) => {
  if (!r.user)
    throw new UnauthorizedError(
      "AUTHENTICATION_REQUIRED",
      "Authentication is required.",
    );
  return r.user.id;
};
const param = (r: Parameters<RequestHandler>[0], name: string) => {
  const value = r.params[name];
  if (typeof value !== "string")
    throw new Error(`Missing route parameter: ${name}`);
  return value;
};
const run =
  (
    fn: (r: Parameters<RequestHandler>[0]) => Promise<unknown>,
    status = 200,
  ): RequestHandler =>
  async (r, s, n) => {
    try {
      s.status(status).json({ success: true, data: await fn(r) });
    } catch (e) {
      n(e);
    }
  };
export const create = run(
  async (r) => ({
    project: await projectService.create(
      uid(r),
      param(r, "workspaceId"),
      r.body,
    ),
  }),
  201,
);
export const list = run(async (r) => ({
  projects: await projectService.list(uid(r), param(r, "workspaceId")),
}));
export const get = run(async (r) => ({
  project: await projectService.get(uid(r), param(r, "projectId")),
}));
export const dashboard = run((r) =>
  dashboardService.get(uid(r), param(r, "projectId")),
);
export const board = run(async (r) => {
  if (!r.user)
    throw new UnauthorizedError(
      "AUTHENTICATION_REQUIRED",
      "Authentication is required.",
    );
  return taskService.board(
    r.user.id,
    param(r, "projectId"),
    r.query as unknown as Parameters<typeof taskService.board>[2],
  );
});
