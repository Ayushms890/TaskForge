import { Router } from "express";
import rateLimit from "express-rate-limit";
import { env } from "../config/env.js";
import { login, logout, me, register } from "../controllers/auth.controller.js";
import { authenticateUser } from "../middleware/authenticate-user.js";
import { validateBody } from "../middleware/validate.js";
import { loginSchema, registerSchema } from "../schemas/auth.schemas.js";

const authRateLimit = rateLimit({
  windowMs: env.AUTH_RATE_LIMIT_WINDOW_MS,
  limit: env.AUTH_RATE_LIMIT_MAX,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      code: "AUTH_RATE_LIMITED",
      message: "Too many authentication attempts.",
    },
  },
});

export const authRouter = Router();
authRouter.use((_request, response, next) => {
  response.setHeader("Cache-Control", "no-store");
  next();
});
authRouter.post(
  "/register",
  authRateLimit,
  validateBody(registerSchema),
  register,
);
authRouter.post("/login", authRateLimit, validateBody(loginSchema), login);
authRouter.post("/logout", logout);
authRouter.get("/me", authenticateUser, me);
