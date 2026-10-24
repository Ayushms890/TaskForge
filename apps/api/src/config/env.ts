import { config } from "dotenv";
import { fileURLToPath } from "node:url";
import { z } from "zod";

const booleanEnv = z
  .enum(["true", "false"])
  .transform((value) => value === "true");

// Both src/config and dist/config are four levels below the repository root.
config({
  path: fileURLToPath(new URL("../../../../.env", import.meta.url)),
  quiet: true,
});

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  PORT: z.coerce.number().int().positive().optional(),
  API_PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(32),
  JWT_EXPIRES_IN: z
    .string()
    .regex(/^[1-9]\d*(s|m|h|d)$/)
    .default("15m"),
  JWT_ISSUER: z.string().min(1).default("taskforge-api"),
  JWT_AUDIENCE: z.string().min(1).default("taskforge-web"),
  AUTH_RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(900000),
  AUTH_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(20),
  TRUST_PROXY: booleanEnv.default(false),
  WEB_ORIGIN: z
    .string()
    .url()
    .refine(
      (value) => new URL(value).origin === value,
      "WEB_ORIGIN must be an exact origin without a path",
    )
    .default("http://localhost:3000"),
});

export const env = envSchema.parse(process.env);
