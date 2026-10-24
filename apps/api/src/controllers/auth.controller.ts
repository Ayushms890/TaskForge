import type { RequestHandler } from "express";
import { serialize } from "cookie";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { ACCESS_TOKEN_COOKIE } from "../middleware/authenticate-user.js";
import { authService } from "../services/auth.service.js";
import { UnauthorizedError } from "../utils/http-error.js";

const cookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: env.NODE_ENV === "production",
  path: "/",
};

const setAccessTokenCookie = (
  response: Parameters<RequestHandler>[1],
  token: string,
): void => {
  const payload = jwt.verify(token, env.JWT_SECRET, {
    algorithms: ["HS256"],
    issuer: env.JWT_ISSUER,
    audience: env.JWT_AUDIENCE,
  });
  if (
    typeof payload === "string" ||
    typeof payload.exp !== "number" ||
    !Number.isFinite(payload.exp)
  ) {
    throw new Error("Access token must have a valid expiry.");
  }

  response.setHeader(
    "Set-Cookie",
    serialize(ACCESS_TOKEN_COOKIE, token, {
      ...cookieOptions,
      maxAge: Math.max(0, Math.floor(payload.exp - Date.now() / 1000)),
    }),
  );
};

export const register: RequestHandler = async (request, response, next) => {
  try {
    const result = await authService.register(request.body);
    setAccessTokenCookie(response, result.token);
    response.status(201).json({
      success: true,
      data: { user: result.user },
      message: "Account created successfully.",
    });
  } catch (error) {
    next(error);
  }
};

export const login: RequestHandler = async (request, response, next) => {
  try {
    const result = await authService.login(request.body);
    setAccessTokenCookie(response, result.token);
    response.json({
      success: true,
      data: { user: result.user },
      message: "Signed in successfully.",
    });
  } catch (error) {
    next(error);
  }
};

export const logout: RequestHandler = (_request, response) => {
  response.setHeader(
    "Set-Cookie",
    serialize(ACCESS_TOKEN_COOKIE, "", { ...cookieOptions, maxAge: 0 }),
  );
  response.json({
    success: true,
    data: null,
    message: "Signed out successfully.",
  });
};

export const me: RequestHandler = async (request, response, next) => {
  try {
    if (!request.user) {
      throw new UnauthorizedError(
        "AUTHENTICATION_REQUIRED",
        "Authentication is required.",
      );
    }

    const user = await authService.getCurrentUser(request.user.id);
    response.json({
      success: true,
      data: { user },
      message: "Current user retrieved successfully.",
    });
  } catch (error) {
    next(error);
  }
};
