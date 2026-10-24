import type { RequestHandler } from "express";
import jwt from "jsonwebtoken";
import { parse } from "cookie";
import { env } from "../config/env.js";
import { UnauthorizedError } from "../utils/http-error.js";

export const ACCESS_TOKEN_COOKIE = "taskforge_access_token";

const getToken = (
  request: Parameters<RequestHandler>[0],
): string | undefined => {
  const authorization = request.header("authorization");
  if (authorization?.startsWith("Bearer ")) {
    return authorization.slice("Bearer ".length);
  }

  const cookieHeader = request.header("cookie");
  return cookieHeader ? parse(cookieHeader)[ACCESS_TOKEN_COOKIE] : undefined;
};

export const authenticateUser: RequestHandler = (request, _response, next) => {
  const token = getToken(request);
  if (!token) {
    next(
      new UnauthorizedError(
        "AUTHENTICATION_REQUIRED",
        "Authentication is required.",
      ),
    );
    return;
  }

  try {
    const decoded = jwt.verify(token, env.JWT_SECRET, {
      algorithms: ["HS256"],
      issuer: env.JWT_ISSUER,
      audience: env.JWT_AUDIENCE,
    });
    if (
      typeof decoded === "string" ||
      typeof decoded.sub !== "string" ||
      decoded.sub.length === 0 ||
      typeof decoded.exp !== "number" ||
      typeof decoded.email !== "string"
    ) {
      throw new Error("Invalid token payload");
    }

    request.user = { id: decoded.sub, email: decoded.email };
    next();
  } catch {
    next(
      new UnauthorizedError(
        "INVALID_TOKEN",
        "The authentication token is invalid or expired.",
      ),
    );
  }
};
