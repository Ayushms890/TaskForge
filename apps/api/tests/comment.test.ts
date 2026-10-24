import { beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";

const mocks = vi.hoisted(() => {
  process.env.NODE_ENV = "test";
  process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/test";
  process.env.JWT_SECRET = "test-only-secret-with-at-least-32-characters";
  process.env.JWT_ISSUER = "taskforge-api";
  process.env.JWT_AUDIENCE = "taskforge-web";
  process.env.WEB_ORIGIN = "http://localhost:3000";
  return {
    taskFindUnique: vi.fn(),
    comments: {
      list: vi.fn(),
      create: vi.fn(),
      findById: vi.fn(),
      update: vi.fn(),
      remove: vi.fn(),
    },
    activities: { list: vi.fn() },
    projects: { findById: vi.fn() },
    workspaces: { findMember: vi.fn() },
  };
});

vi.mock("../src/lib/prisma.js", () => ({
  prisma: { task: { findUnique: mocks.taskFindUnique } },
}));
vi.mock("../src/repositories/comment.repository.js", () => ({
  commentRepository: mocks.comments,
}));
vi.mock("../src/repositories/activity.repository.js", () => ({
  activityRepository: mocks.activities,
}));
vi.mock("../src/repositories/project.repository.js", () => ({
  projectRepository: mocks.projects,
}));
vi.mock("../src/repositories/workspace.repository.js", () => ({
  workspaceRepository: mocks.workspaces,
}));

import { app } from "../src/app.js";
import { env } from "../src/config/env.js";

const project = { id: "p1", workspaceId: "w1" };
const task = { projectId: "p1" };
const comment = (authorId = "member") => ({
  id: "c1",
  taskId: "t1",
  authorId,
  content: "A comment",
  task,
});
const member = (userId: string, role: "OWNER" | "ADMIN" | "MEMBER") => ({
  id: `membership-${userId}`,
  workspaceId: "w1",
  userId,
  role,
});
const token = (id: string) =>
  jwt.sign({ email: `${id}@example.com` }, env.JWT_SECRET, {
    algorithm: "HS256",
    subject: id,
    issuer: env.JWT_ISSUER,
    audience: env.JWT_AUDIENCE,
    expiresIn: "15m",
  });
const auth = (id: string) => ({ Authorization: `Bearer ${token(id)}` });

beforeEach(() => {
  vi.clearAllMocks();
  mocks.taskFindUnique.mockResolvedValue(task);
  mocks.projects.findById.mockResolvedValue(project);
  mocks.workspaces.findMember.mockResolvedValue(member("member", "MEMBER"));
  mocks.comments.list.mockResolvedValue({ items: [], total: 0 });
  mocks.activities.list.mockResolvedValue({ items: [], total: 0 });
  mocks.comments.create.mockResolvedValue({ id: "c1", content: "A comment" });
  mocks.comments.findById.mockResolvedValue(comment());
  mocks.comments.update.mockResolvedValue({ id: "c1", content: "Updated" });
  mocks.comments.remove.mockResolvedValue(undefined);
});

describe("comment API authorization and pagination", () => {
  it("validates non-empty comment content", async () => {
    await request(app)
      .post("/api/tasks/t1/comments")
      .set(auth("member"))
      .send({ content: "   " })
      .expect(400);
    expect(mocks.comments.create).not.toHaveBeenCalled();
  });

  it("lists comments with validated pagination for workspace members", async () => {
    await request(app)
      .get("/api/tasks/t1/comments?page=2&limit=5")
      .set(auth("member"))
      .expect(200);
    expect(mocks.comments.list).toHaveBeenCalledWith("t1", 2, 5);
  });

  it("returns 404 to an outsider and does not list task data", async () => {
    mocks.workspaces.findMember.mockResolvedValue(null);
    await request(app)
      .get("/api/tasks/t1/comments")
      .set(auth("outsider"))
      .expect(404);
    expect(mocks.comments.list).not.toHaveBeenCalled();
  });

  it("allows only the author to edit a comment", async () => {
    mocks.comments.findById.mockResolvedValue(comment("other"));
    await request(app)
      .patch("/api/comments/c1")
      .set(auth("member"))
      .send({ content: "Updated" })
      .expect(403);

    mocks.comments.findById.mockResolvedValue(comment("member"));
    await request(app)
      .patch("/api/comments/c1")
      .set(auth("member"))
      .send({ content: "Updated" })
      .expect(200);
    expect(mocks.comments.update).toHaveBeenCalledWith(
      "c1",
      "Updated",
      "member",
    );
  });

  it.each([
    ["OWNER", "owner"],
    ["ADMIN", "admin"],
  ] as const)("allows %s moderation deletion", async (role, userId) => {
    mocks.workspaces.findMember.mockResolvedValue(member(userId, role));
    mocks.comments.findById.mockResolvedValue(comment("other"));
    await request(app).delete("/api/comments/c1").set(auth(userId)).expect(200);
    expect(mocks.comments.remove).toHaveBeenCalledWith("c1", userId);
  });

  it("prevents a member from deleting another member's comment", async () => {
    mocks.comments.findById.mockResolvedValue(comment("other"));
    await request(app)
      .delete("/api/comments/c1")
      .set(auth("member"))
      .expect(403);
    expect(mocks.comments.remove).not.toHaveBeenCalled();
  });
});
