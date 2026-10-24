import type { ErrorRequestHandler } from "express";
import { HttpError } from "../utils/http-error.js";

export const errorHandler: ErrorRequestHandler = (
  error,
  _request,
  response,
  _next,
) => {
  void _next;
  const bodyError =
    typeof error === "object" && error !== null && "type" in error
      ? error.type
      : undefined;
  const knownError =
    error instanceof HttpError
      ? error
      : bodyError === "entity.parse.failed"
        ? new HttpError(400, "INVALID_JSON", "Request body must be valid JSON.")
        : bodyError === "entity.too.large"
          ? new HttpError(413, "BODY_TOO_LARGE", "Request body is too large.")
          : undefined;
  const statusCode = knownError?.statusCode ?? 500;
  const code = knownError?.code ?? "INTERNAL_SERVER_ERROR";

  if (statusCode >= 500) {
    // Never log raw errors: ORM/parser errors may contain credentials or bodies.
    console.error({ event: "request_failed", code, statusCode });
  }

  response.status(statusCode).json({
    success: false,
    error: {
      code,
      message: knownError?.message ?? "An unexpected error occurred.",
    },
  });
};
