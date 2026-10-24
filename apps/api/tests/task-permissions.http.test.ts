import { beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";

const repos = vi.hoisted(() => ({
  tasks: {
    createNext: vi.fn(),
    findById: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
    list: vi.fn(),
    move: vi.fn(),
  },
  projects: { findById: vi.fn() },
  workspaces: { findMember: vi.fn() },
  sprints: { findById: vi.fn() },
}));
vi.mock("../src/repositories/task.repository.js", async (original) => ({
  ...(await original<
    typeof import("../src/repositories/task.repository.js")
  >()),
  taskRepository: repos.tasks,
}));
vi.mock("../src/repositories/project.repository.js", async (original) => ({
  ...(await original<
    typeof import("../src/repositories/project.repository.js")
  >()),
  projectRepository: repos.projects,
}));
vi.mock("../src/repositories/workspace.repository.js", async (original) => ({
  ...(await original<
    typeof import("../src/repositories/workspace.repository.js")
  >()),
  workspaceRepository: repos.workspaces,
}));
vi.mock("../src/repositories/sprint.repository.js", async (original) => ({
  ...(await original<
    typeof import("../src/repositories/sprint.repository.js")
  >()),
  sprintRepository: repos.sprints,
}));

import { app } from "../src/app.js";
import { env } from "../src/config/env.js";

const project = {
  id: "p1",
  workspaceId: "w1",
  name: "Core",
  key: "CORE",
  description: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};
const task = (assigneeId: string | null = "member") => ({
  id: "t1",
  projectId: "p1",
  number: 1,
  title: "Task",
  description: null,
  status: "TODO" as const,
  priority: "MEDIUM" as const,
  type: "TASK" as const,
  assigneeId,
  sprintId: null,
  position: 0,
  createdAt: new Date(),
  updatedAt: new Date(),
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
  repos.projects.findById.mockResolvedValue(project);
  repos.sprints.findById.mockResolvedValue(null);
  repos.tasks.createNext.mockResolvedValue(task());
  repos.tasks.update.mockResolvedValue(task());
  repos.tasks.move.mockResolvedValue(task());
  repos.tasks.findById.mockResolvedValue(task());
  repos.tasks.list.mockResolvedValue({ items: [], total: 0 });
  repos.workspaces.findMember.mockImplementation(
    async (_workspace: string, userId: string) => ({
      role:
        userId === "owner" ? "OWNER" : userId === "admin" ? "ADMIN" : "MEMBER",
    }),
  );
});

describe("task permission HTTP boundaries", () => {
  const reads = ["/api/tasks", "/api/tasks/search", "/api/projects/p1/board"];
  it.each(reads)(
    "validates and forwards search filters at %s",
    async (path) => {
      const response = await request(app)
        .get(path)
        .set(auth("member"))
        .query({
          projectId: "p1",
          q: "  Fix  ",
          status: "TODO",
          priority: "HIGH",
          type: "BUG",
          assigneeId: "unassigned",
          sprintId: "backlog",
          page: "2",
          limit: "5",
        })
        .expect(200);
      expect(repos.tasks.list).toHaveBeenCalledWith(
        expect.objectContaining({
          projectId: "p1",
          q: "Fix",
          status: "TODO",
          priority: "HIGH",
          type: "BUG",
          assigneeId: null,
          sprintId: null,
          page: 2,
          limit: 5,
        }),
      );
      expect(response.body.data.pagination).toEqual({
        page: 2,
        limit: 5,
        total: 0,
        totalPages: 0,
      });
      expect(repos.tasks.findById).not.toHaveBeenCalled();
    },
  );
  it.each(reads)("defaults paging and forwards IDs at %s", async (path) => {
    await request(app)
      .get(path)
      .set(auth("member"))
      .query({ projectId: "p1", assigneeId: "u1", sprintId: "s1" })
      .expect(200);
    expect(repos.tasks.list).toHaveBeenCalledWith(
      expect.objectContaining({
        projectId: "p1",
        page: 1,
        limit: 20,
        assigneeId: "u1",
        sprintId: "s1",
      }),
    );
  });
  it.each(reads)("rejects invalid query values at %s", async (path) => {
    for (const query of [
      { q: "x".repeat(201) },
      { page: 100001 },
      { page: 0 },
      { page: 1.5 },
      { limit: 101 },
      { limit: 0 },
      { status: "invalid" },
      { priority: "invalid" },
      { type: "invalid" },
      { assigneeId: "" },
      { sprintId: "" },
      { q: ["one", "two"] },
    ]) {
      await request(app)
        .get(path)
        .set(auth("member"))
        .query({ projectId: "p1", ...query })
        .expect(400);
    }
    expect(repos.tasks.list).not.toHaveBeenCalled();
  });
  it.each(reads)("authorizes before searching at %s", async (path) => {
    await request(app).get(path).query({ projectId: "p1" }).expect(401);
    repos.workspaces.findMember.mockResolvedValue(null);
    await request(app)
      .get(path)
      .set(auth("member"))
      .query({ projectId: "p1", q: "Fix" })
      .expect(404);
    expect(repos.tasks.list).not.toHaveBeenCalled();
  });
  it.each(["/api/tasks", "/api/tasks/search"])(
    "requires projectId at %s",
    async (path) => {
      await request(app).get(path).set(auth("member")).expect(400);
      expect(repos.tasks.list).not.toHaveBeenCalled();
    },
  );
  it.each([{}, { assigneeId: null }, { assigneeId: "member" }])(
    "self-assigns member creation %j and permits subsequent edits and moves",
    async (assignment) => {
      repos.tasks.createNext.mockImplementation(async (data) => ({
        ...task(),
        ...data,
      }));
      const created = await request(app)
        .post("/api/tasks")
        .set(auth("member"))
        .send({
          projectId: "p1",
          title: "New",
          sprintId: null,
          ...assignment,
          reporterId: "owner",
          actorId: "owner",
        })
        .expect(201);
      expect(repos.tasks.createNext).toHaveBeenCalledWith(
        expect.objectContaining({
          assigneeId: "member",
          reporterId: "member",
          actorId: "member",
        }),
      );
      const saved = await repos.tasks.createNext.mock.results[0]!.value;
      repos.tasks.findById.mockResolvedValue(saved);
      expect(created.body.data.task).toMatchObject({
        id: "t1",
        assigneeId: "member",
        reporterId: "member",
      });
      await request(app)
        .patch("/api/tasks/t1")
        .set(auth("member"))
        .send({ title: "Edited", reporterId: "owner", actorId: "owner" })
        .expect(200);
      expect(repos.tasks.update).toHaveBeenCalledWith(
        "t1",
        { title: "Edited" },
        "member",
      );
      await request(app)
        .patch("/api/tasks/t1/status")
        .set(auth("member"))
        .send({ status: "IN_PROGRESS", actorId: "owner" })
        .expect(200);
      await request(app)
        .patch("/api/tasks/t1/position")
        .set(auth("member"))
        .send({ position: 1, status: "DONE", actorId: "owner" })
        .expect(200);
      expect(repos.tasks.move).toHaveBeenLastCalledWith(
        "t1",
        { position: 1, status: "DONE" },
        "member",
      );
      await request(app)
        .delete("/api/tasks/t1")
        .set(auth("member"))
        .expect(403);
      expect(repos.tasks.remove).not.toHaveBeenCalled();
    },
  );

  it.each(["owner", "admin"])(
    "preserves %s creation assignment options",
    async (userId) => {
      for (const assignment of [
        {},
        { assigneeId: null },
        { assigneeId: "other" },
      ]) {
        await request(app)
          .post("/api/tasks")
          .set(auth(userId))
          .send({ projectId: "p1", title: "New", ...assignment })
          .expect(201);
        expect(repos.tasks.createNext).toHaveBeenLastCalledWith(
          expect.objectContaining({
            assigneeId:
              "assigneeId" in assignment ? assignment.assigneeId : undefined,
            actorId: userId,
            reporterId: userId,
          }),
        );
      }
    },
  );

  it.each([null, "other"])(
    "blocks member edits and moves of tasks assigned to %s",
    async (assigneeId) => {
      repos.tasks.findById.mockResolvedValue(task(assigneeId));
      for (const [path, body] of [
        ["", { title: "Changed" }],
        ["/status", { status: "DONE" }],
        ["/position", { position: 1 }],
      ] as const) {
        await request(app)
          .patch(`/api/tasks/t1${path}`)
          .set(auth("member"))
          .send(body)
          .expect(403);
      }
      expect(repos.tasks.update).not.toHaveBeenCalled();
      expect(repos.tasks.move).not.toHaveBeenCalled();
    },
  );

  it("rejects member assignment on create and assignment fields alongside edits", async () => {
    await request(app)
      .post("/api/tasks")
      .set(auth("member"))
      .send({ projectId: "p1", title: "New", assigneeId: "other" })
      .expect(403);
    await request(app)
      .post("/api/tasks")
      .set(auth("member"))
      .send({ projectId: "p1", title: "New", sprintId: "s1" })
      .expect(403);
    expect(repos.tasks.createNext).not.toHaveBeenCalled();
    await request(app)
      .patch("/api/tasks/t1")
      .set(auth("member"))
      .send({ title: "Allowed", assigneeId: null })
      .expect(403);
    expect(repos.tasks.update).not.toHaveBeenCalled();
  });

  it("allows an assigned member to edit and move, but blocks an unassigned member", async () => {
    await request(app)
      .patch("/api/tasks/t1")
      .set(auth("member"))
      .send({ title: "Changed" })
      .expect(200);
    await request(app)
      .patch("/api/tasks/t1/status")
      .set(auth("member"))
      .send({ status: "DONE" })
      .expect(200);
    repos.tasks.findById.mockResolvedValue(task("other"));
    await request(app)
      .patch("/api/tasks/t1/position")
      .set(auth("member"))
      .send({ position: 0 })
      .expect(403);
  });

  it("keeps owner task management and board reads available", async () => {
    await request(app).delete("/api/tasks/t1").set(auth("owner")).expect(200);
    await request(app)
      .get("/api/projects/p1/board")
      .set(auth("member"))
      .expect(200);
    expect(repos.tasks.remove).toHaveBeenCalledWith("t1");
  });
});
