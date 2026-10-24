import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import type { LoginInput, RegisterInput } from "../schemas/auth.schemas.js";
import { ConflictError, UnauthorizedError } from "../utils/http-error.js";
import {
  toPublicUser,
  userRepository,
  type PublicUser,
  type UserRepository,
} from "../repositories/user.repository.js";

export interface AuthService {
  register(input: RegisterInput): Promise<{ user: PublicUser; token: string }>;
  login(input: LoginInput): Promise<{ user: PublicUser; token: string }>;
  getCurrentUser(userId: string): Promise<PublicUser>;
}

const createToken = (user: { id: string; email: string }): string =>
  jwt.sign({ email: user.email }, env.JWT_SECRET, {
    algorithm: "HS256",
    issuer: env.JWT_ISSUER,
    audience: env.JWT_AUDIENCE,
    subject: user.id,
    expiresIn: env.JWT_EXPIRES_IN as NonNullable<jwt.SignOptions["expiresIn"]>,
  });

export const createAuthService = (repository: UserRepository): AuthService => ({
  async register(input) {
    const existingUser = await repository.findByEmail(input.email);
    if (existingUser) {
      throw new ConflictError(
        "EMAIL_ALREADY_REGISTERED",
        "An account with this email already exists.",
      );
    }

    const passwordHash = await bcrypt.hash(input.password, 12);
    const user = await repository
      .create({
        name: input.name,
        email: input.email,
        passwordHash,
      })
      .catch((error: unknown) => {
        if (
          typeof error === "object" &&
          error !== null &&
          "code" in error &&
          error.code === "P2002"
        ) {
          throw new ConflictError(
            "EMAIL_ALREADY_REGISTERED",
            "An account with this email already exists.",
          );
        }
        throw error;
      });

    return { user: toPublicUser(user), token: createToken(user) };
  },

  async login(input) {
    const user = await repository.findByEmail(input.email);
    const passwordMatches = user
      ? await bcrypt.compare(input.password, user.passwordHash)
      : false;
    if (!user || !passwordMatches) {
      throw new UnauthorizedError(
        "INVALID_CREDENTIALS",
        "Email or password is incorrect.",
      );
    }

    return { user: toPublicUser(user), token: createToken(user) };
  },

  async getCurrentUser(userId) {
    const user = await repository.findById(userId);
    if (!user) {
      throw new UnauthorizedError(
        "INVALID_SESSION",
        "Your session is no longer valid.",
      );
    }

    return toPublicUser(user);
  },
});

export const authService = createAuthService(userRepository);
