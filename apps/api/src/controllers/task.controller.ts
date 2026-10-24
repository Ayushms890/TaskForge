import type { RequestHandler } from "express";
import { UnauthorizedError } from "../utils/http-error.js";
import { taskService } from "../services/task.service.js";
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
  async (r) => ({ task: await taskService.create(uid(r), r.body) }),
  201,
);
export const list = run(async (r) =>
  taskService.list(
    uid(r),
    r.query as unknown as Parameters<typeof taskService.list>[1],
  ),
);
export const get = run(async (r) => ({
  task: await taskService.get(uid(r), param(r, "taskId")),
}));
export const update = run(async (r) => ({
  task: await taskService.update(uid(r), param(r, "taskId"), r.body),
}));
export const remove: RequestHandler = async (r, s, n) => {
  try {
    await taskService.remove(uid(r), param(r, "taskId"));
    s.json({ success: true, data: null });
  } catch (e) {
    n(e);
  }
};
export const status = run(async (r) => ({
  task: await taskService.changeStatus(uid(r), param(r, "taskId"), r.body),
}));
export const position = run(async (r) => ({
  task: await taskService.changePosition(uid(r), param(r, "taskId"), r.body),
}));
