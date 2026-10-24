import type { RequestHandler } from "express";
import type { ZodType } from "zod";
import { HttpError } from "../utils/http-error.js";

export const validateBody =
  (schema: ZodType): RequestHandler =>
  (request, _response, next) => {
    const result = schema.safeParse(request.body);
    if (!result.success) {
      next(new HttpError(400, "VALIDATION_ERROR", "Request data is invalid."));
      return;
    }

    request.body = result.data;
    next();
  };

export const validateParams =
  (schema: ZodType): RequestHandler =>
  (request, _response, next) => {
    const result = schema.safeParse(request.params);
    if (!result.success) {
      next(new HttpError(400, "VALIDATION_ERROR", "Request data is invalid."));
      return;
    }
    request.params = result.data as typeof request.params;
    next();
  };

export const validateQuery =
  (schema: ZodType): RequestHandler =>
  (request, _response, next) => {
    const result = schema.safeParse(request.query);
    if (!result.success) {
      next(new HttpError(400, "VALIDATION_ERROR", "Request data is invalid."));
      return;
    }
    Object.defineProperty(request, "query", {
      configurable: true,
      enumerable: true,
      value: result.data,
      writable: true,
    });
    next();
  };
