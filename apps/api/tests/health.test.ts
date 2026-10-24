import { describe, expect, it, vi } from "vitest";
import request from "supertest";

const prisma = vi.hoisted(() => {
  Object.assign(process.env, {
    NODE_ENV: "test",
    DATABASE_URL: "postgresql://test:test@localhost:5432/test",
    JWT_SECRET: "test-only-secret-with-at-least-32-characters",
    WEB_ORIGIN: "http://localhost:3000",
  });
  return { $queryRaw: vi.fn() };
});

vi.mock("../src/lib/prisma.js", () => ({ prisma }));

import { app } from "../src/app.js";

describe("health endpoints", () => {
  it("reports liveness without requiring the database", async () => {
    await request(app)
      .get("/api/health")
      .expect(200)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          success: true,
          data: { status: "ok", service: "taskforge-api" },
        });
      });
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
  });

  it("reports readiness when the database responds", async () => {
    prisma.$queryRaw.mockResolvedValueOnce([{ result: 1 }]);

    await request(app)
      .get("/api/health/ready")
      .expect(200)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          success: true,
          data: { status: "ready", database: "ok" },
        });
      });
  });

  it("returns a safe 503 when the database is unavailable", async () => {
    prisma.$queryRaw.mockRejectedValueOnce(new Error("database details"));

    await request(app)
      .get("/api/health/ready")
      .expect(503)
      .expect(({ body }) => {
        expect(body).toEqual({
          success: false,
          error: {
            code: "SERVICE_NOT_READY",
            message: "The API dependencies are not ready.",
          },
        });
        expect(JSON.stringify(body)).not.toContain("database details");
      });
  });
});
