import { describe, expect, it, vi } from "vitest";
import request from "supertest";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const repository = vi.hoisted(() => {
  process.env.NODE_ENV = "test";
  process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/test";
  process.env.JWT_SECRET = "test-only-secret-with-at-least-32-characters";
  process.env.JWT_ISSUER = "taskforge-api";
  process.env.JWT_AUDIENCE = "taskforge-web";
  process.env.JWT_EXPIRES_IN = "15m";
  process.env.WEB_ORIGIN = "http://localhost:3000";
  process.env.AUTH_RATE_LIMIT_MAX = "20";
  return { create: vi.fn(), findByEmail: vi.fn(), findById: vi.fn() };
});

// Exercise real HTTP middleware and token issuance with only persistence mocked.
vi.mock("../src/repositories/user.repository.js", async (importOriginal) => ({
  ...(await importOriginal<
    typeof import("../src/repositories/user.repository.js")
  >()),
  userRepository: repository,
}));

import { app } from "../src/app.js";
import { env } from "../src/config/env.js";

describe("authentication session lifetime and rate limits", () => {
  it("keeps session reads/logout available while limiting credential attempts", async () => {
    const credentials = {
      email: "ada@example.com",
      password: "correct-password",
    };
    const user = {
      id: "session-user",
      name: "Ada",
      email: credentials.email,
      passwordHash: await bcrypt.hash(credentials.password, 4),
      avatarUrl: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    repository.findByEmail.mockResolvedValue(null);
    repository.create.mockResolvedValue(user);
    repository.findById.mockResolvedValue(user);
    const agent = request.agent(app);
    const registered = await agent
      .post("/api/auth/register")
      .set("Origin", env.WEB_ORIGIN)
      .send({ name: user.name, ...credentials })
      .expect(201);
    repository.findByEmail.mockResolvedValue(user);
    const loggedIn = await agent
      .post("/api/auth/login")
      .set("Origin", env.WEB_ORIGIN)
      .send(credentials)
      .expect(200);

    for (const response of [registered, loggedIn]) {
      expect(response.headers["cache-control"]).toBe("no-store");
      expect(response.body.data).not.toHaveProperty("token");
      const cookie = response.headers["set-cookie"][0];
      const token = cookie.split(";")[0].split("=")[1];
      const payload = jwt.verify(token, env.JWT_SECRET, {
        algorithms: ["HS256"],
        issuer: env.JWT_ISSUER,
        audience: env.JWT_AUDIENCE,
      }) as jwt.JwtPayload;
      const maxAge = Number(/Max-Age=(\d+)/.exec(cookie)?.[1]);
      expect(Number.isFinite(maxAge)).toBe(true);
      expect(payload.exp! - payload.iat!).toBe(900);
      expect(maxAge).toBeGreaterThanOrEqual(
        payload.exp! - Math.floor(Date.now() / 1000) - 1,
      );
      expect(maxAge).toBeLessThanOrEqual(900);
      expect(cookie.includes("HttpOnly")).toBe(true);
      expect(cookie.includes("SameSite=Lax")).toBe(true);
      expect(cookie.includes("Path=/")).toBe(true);
    }

    for (let index = 0; index < env.AUTH_RATE_LIMIT_MAX + 5; index++) {
      await agent
        .get("/api/auth/me")
        .expect(200)
        .expect("Cache-Control", "no-store");
    }

    // Registration and login above consumed two attempts; reads consumed none.
    repository.findByEmail.mockResolvedValue(null);
    for (let index = 2; index < env.AUTH_RATE_LIMIT_MAX; index++) {
      await request(app).post("/api/auth/login").send(credentials).expect(401);
    }
    for (const endpoint of ["login", "register"]) {
      const limited = await request(app)
        .post(`/api/auth/${endpoint}`)
        .send({ name: user.name, ...credentials })
        .expect(429)
        .expect("Cache-Control", "no-store");
      expect(limited.body.error.code).toBe("AUTH_RATE_LIMITED");
    }
    await agent
      .get("/api/auth/me")
      .expect(200)
      .expect("Cache-Control", "no-store");
    const logout = await agent
      .post("/api/auth/logout")
      .set("Origin", env.WEB_ORIGIN)
      .expect(200)
      .expect("Cache-Control", "no-store");
    expect(logout.headers["set-cookie"][0]).toContain("Max-Age=0");
    await agent
      .get("/api/auth/me")
      .expect(401)
      .expect("Cache-Control", "no-store");
    const expired = jwt.sign({}, env.JWT_SECRET, {
      algorithm: "HS256",
      subject: user.id,
      issuer: env.JWT_ISSUER,
      audience: env.JWT_AUDIENCE,
      expiresIn: -1,
    });
    await request(app)
      .get("/api/auth/me")
      .set("Cookie", `taskforge_access_token=${expired}`)
      .expect(401)
      .expect("Cache-Control", "no-store");
  });
});
