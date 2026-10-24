import type { RequestHandler } from "express";
import { UnauthorizedError } from "../utils/http-error.js";
import { sprintService } from "../services/sprint.service.js";
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
    sprint: await sprintService.create(uid(r), param(r, "projectId"), r.body),
  }),
  201,
);
export const list = run(async (r) => ({
  sprints: await sprintService.list(uid(r), param(r, "projectId")),
}));
export const update = run(async (r) => ({
  sprint: await sprintService.update(uid(r), param(r, "sprintId"), r.body),
}));
export const start = run(async (r) => ({
  sprint: await sprintService.start(uid(r), param(r, "sprintId")),
}));
export const complete = run(async (r) => ({
  sprint: await sprintService.complete(uid(r), param(r, "sprintId")),
}));
