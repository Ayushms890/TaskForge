import type { RequestHandler } from "express";
import { UnauthorizedError } from "../utils/http-error.js";
import { commentService } from "../services/comment.service.js";
import type { PageQuery } from "../schemas/comment.schemas.js";
const uid = (r: Parameters<RequestHandler>[0]) => {
  if (!r.user)
    throw new UnauthorizedError(
      "AUTHENTICATION_REQUIRED",
      "Authentication is required.",
    );
  return r.user.id;
};
const param = (r: Parameters<RequestHandler>[0], name: string) =>
  String(r.params[name]);
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
export const listComments = run(async (r) => ({
  ...(await commentService.listComments(
    uid(r),
    param(r, "taskId"),
    r.query as unknown as PageQuery,
  )),
}));
export const listActivities = run(async (r) => ({
  ...(await commentService.listActivities(
    uid(r),
    param(r, "taskId"),
    r.query as unknown as PageQuery,
  )),
}));
export const create = run(
  async (r) => ({
    comment: await commentService.create(uid(r), param(r, "taskId"), r.body),
  }),
  201,
);
export const update = run(async (r) => ({
  comment: await commentService.update(uid(r), param(r, "commentId"), r.body),
}));
export const remove: RequestHandler = async (r, s, n) => {
  try {
    await commentService.remove(uid(r), param(r, "commentId"));
    s.json({ success: true, data: null });
  } catch (e) {
    n(e);
  }
};
