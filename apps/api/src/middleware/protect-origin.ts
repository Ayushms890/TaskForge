import type { RequestHandler } from "express";
import { env } from "../config/env.js";
import { HttpError } from "../utils/http-error.js";

export const protectOrigin: RequestHandler = (request, _response, next) => {
  if (["GET", "HEAD", "OPTIONS"].includes(request.method)) {
    next();
    return;
  }
  const origin = request.get("origin");
  // Browser mutations must come from the configured UI. Non-browser clients
  // without Origin/Fetch Metadata remain supported (e.g. CLI bearer clients).
  if (
    (origin !== undefined && origin !== env.WEB_ORIGIN) ||
    (origin === undefined &&
      (request.get("sec-fetch-site") !== undefined ||
        request.get("cookie") !== undefined))
  ) {
    next(
      new HttpError(403, "ORIGIN_FORBIDDEN", "Request origin is not allowed."),
    );
    return;
  }
  next();
};
