import { beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const repository = vi.hoisted(() => {
  process.env.NODE_ENV = "test";
  process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/test";
  process.env.JWT_SECRET = "test-only-secret-with-at-least-32-characters";
  process.env.JWT_ISSUER = "taskforge-api";
  process.env.JWT_AUDIENCE = "taskforge-web";
  process.env.WEB_ORIGIN = "http://localhost:3000";
  process.env.AUTH_RATE_LIMIT_MAX = "1000";
  return { create: vi.fn(), findByEmail: vi.fn(), findById: vi.fn() };
});

// Repository-only mock: real Express middleware, JWT and bcrypt run in these tests.
// These are not PostgreSQL integration tests and never connect to a database.
vi.mock("../src/repositories/user.repository.js", async (importOriginal) => ({
  ...(await importOriginal<
    typeof import("../src/repositories/user.repository.js")
  >()),
  userRepository: repository,
}));

import { app } from "../src/app.js";
import { env } from "../src/config/env.js";
const credentials = { email: "ada@example.com", password: "correct-password" };
const user = {
  id: "user-1",
  name: "Ada",
  email: credentials.email,
  passwordHash: await bcrypt.hash(credentials.password, 4),
  avatarUrl: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};
const sign = (options: jwt.SignOptions = {}) =>
  jwt.sign({ email: user.email }, env.JWT_SECRET, {
    algorithm: "HS256",
    subject: user.id,
    issuer: env.JWT_ISSUER,
    audience: env.JWT_AUDIENCE,
    expiresIn: "15m",
    ...options,
  });

beforeEach(() => {
  vi.clearAllMocks();
  repository.findByEmail.mockResolvedValue(null);
  repository.findById.mockResolvedValue(user);
  repository.create.mockResolvedValue(user);
});

describe("authentication HTTP flow", () => {
  it("registers, hashes passwords, normalizes email, sets HttpOnly cookie and reads me", async () => {
    const agent = request.agent(app);
    const result = await agent
      .post("/api/auth/register")
      .set("Origin", env.WEB_ORIGIN)
      .send({
        name: " Ada ",
        email: " ADA@example.com ",
        password: credentials.password,
      })
      .expect(201);
    expect(result.body.data.user.email).toBe(credentials.email);
    expect(result.body.data.user).not.toHaveProperty("passwordHash");
    expect(result.body.data).not.toHaveProperty("token");
    const data = repository.create.mock.calls[0][0];
    expect(data.name).toBe("Ada");
    expect(data.email).toBe(credentials.email);
    expect(await bcrypt.compare(credentials.password, data.passwordHash)).toBe(
      true,
    );
    expect(result.headers["set-cookie"][0]).toMatch(/HttpOnly/);
    expect(result.headers["set-cookie"][0]).toMatch(/SameSite=Lax/);
    expect(result.headers["access-control-allow-credentials"]).toBe("true");
    expect(result.headers["access-control-allow-origin"]).toBe(env.WEB_ORIGIN);
    const token = result.headers["set-cookie"][0].split(";")[0].split("=")[1];
    const payload = jwt.verify(token, env.JWT_SECRET, {
      algorithms: ["HS256"],
      issuer: env.JWT_ISSUER,
      audience: env.JWT_AUDIENCE,
    });
    expect(payload).toMatchObject({ sub: user.id, exp: expect.any(Number) });
    const me = await agent.get("/api/auth/me").expect(200);
    expect(me.headers["cache-control"]).toBe("no-store");
    expect(me.body.data.user).not.toHaveProperty("passwordHash");
    const logout = await agent
      .post("/api/auth/logout")
      .set("Origin", env.WEB_ORIGIN)
      .expect(200);
    expect(logout.headers["set-cookie"][0]).toContain("Max-Age=0");
    await agent.get("/api/auth/me").expect(401);
  });

  it("logs in and rejects unknown users and incorrect passwords identically", async () => {
    const unknown = await request(app)
      .post("/api/auth/login")
      .send(credentials)
      .expect(401);
    repository.findByEmail.mockResolvedValue(user);
    const incorrect = await request(app)
      .post("/api/auth/login")
      .send({ ...credentials, password: "wrong" })
      .expect(401);
    expect(incorrect.body).toEqual(unknown.body);
    const login = await request(app)
      .post("/api/auth/login")
      .send(credentials)
      .expect(200);
    expect(login.headers["set-cookie"][0]).toContain("HttpOnly");
    expect(login.body.data.user).not.toHaveProperty("passwordHash");
  });

  it("rejects missing, malformed, expired and incorrectly scoped tokens", async () => {
    await request(app).get("/api/auth/me").expect(401);
    const tokens = [
      "garbage",
      sign({ expiresIn: -1 }),
      sign({ issuer: "other" }),
      sign({ audience: "other" }),
      sign({ algorithm: "HS384" }),
      jwt.sign(
        {
          email: user.email,
          sub: user.id,
          iss: env.JWT_ISSUER,
          aud: env.JWT_AUDIENCE,
        },
        env.JWT_SECRET,
      ),
    ];
    for (const token of tokens) {
      const result = await request(app)
        .get("/api/auth/me")
        .set("Cookie", `taskforge_access_token=${token}`)
        .expect(401);
      expect(result.body.error.code).toBe("INVALID_TOKEN");
    }
    expect(repository.findById).not.toHaveBeenCalled();
  });

  it("rejects sessions whose user no longer exists", async () => {
    repository.findById.mockResolvedValue(null);
    await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${sign()}`)
      .expect(401);
  });

  it("validates input and bcrypt UTF-8 byte limit for registration and login", async () => {
    for (const body of [
      {},
      { name: "Ada", ...credentials, email: "bad" },
      { name: "Ada", ...credentials, password: "short" },
      { name: "Ada", ...credentials, password: "é".repeat(37) },
    ]) {
      await request(app).post("/api/auth/register").send(body).expect(400);
    }
    await request(app)
      .post("/api/auth/login")
      .send({ ...credentials, password: "é".repeat(37) })
      .expect(400);
    expect(repository.create).not.toHaveBeenCalled();
    await request(app)
      .post("/api/auth/register")
      .send({ name: "Ada", ...credentials, password: "é".repeat(36) })
      .expect(201);
  });

  it("returns conflict for pre-existing users and concurrent unique constraint races", async () => {
    repository.findByEmail.mockResolvedValue(user);
    await request(app)
      .post("/api/auth/register")
      .send({ name: "Ada", ...credentials })
      .expect(409);
    expect(repository.create).not.toHaveBeenCalled();
    repository.findByEmail.mockResolvedValue(null);
    repository.create.mockRejectedValue({
      code: "P2002",
      meta: { target: ["email"] },
    });
    const result = await request(app)
      .post("/api/auth/register")
      .send({ name: "Ada", ...credentials })
      .expect(409);
    expect(result.body.error.code).toBe("EMAIL_ALREADY_REGISTERED");
  });

  it("blocks hostile origins and browser mutations without origin before writes", async () => {
    for (const endpoint of ["register", "login", "logout"]) {
      await request(app)
        .post(`/api/auth/${endpoint}`)
        .set("Origin", "https://evil.example")
        .send(credentials)
        .expect(403);
      await request(app)
        .post(`/api/auth/${endpoint}`)
        .set("Origin", "null")
        .send(credentials)
        .expect(403);
      await request(app)
        .post(`/api/auth/${endpoint}`)
        .set("Sec-Fetch-Site", "cross-site")
        .send(credentials)
        .expect(403);
    }
    expect(repository.findByEmail).not.toHaveBeenCalled();
    await request(app)
      .post("/api/auth/logout")
      .set("Cookie", `taskforge_access_token=${sign()}`)
      .expect(403);
    await request(app)
      .options("/api/auth/login")
      .set("Origin", env.WEB_ORIGIN)
      .set("Access-Control-Request-Method", "POST")
      .expect(204);
  });

  it("does not expose raw database/parser errors in responses or logs", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      repository.findByEmail.mockRejectedValue(
        new Error("database-password-secret"),
      );
      const result = await request(app)
        .post("/api/auth/login")
        .send(credentials)
        .expect(500);
      expect(JSON.stringify(result.body)).not.toContain(
        "database-password-secret",
      );
      expect(log).toHaveBeenCalledWith({
        event: "request_failed",
        code: "INTERNAL_SERVER_ERROR",
        statusCode: 500,
      });
      const malformed = await request(app)
        .post("/api/auth/login")
        .set("Content-Type", "application/json")
        .send('{"password":"secret"')
        .expect(400);
      expect(malformed.body.error.code).toBe("INVALID_JSON");
      expect(JSON.stringify(malformed.body)).not.toContain("secret");
    } finally {
      log.mockRestore();
    }
  });
});
