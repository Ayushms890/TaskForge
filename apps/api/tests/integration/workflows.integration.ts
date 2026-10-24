import { randomUUID } from "node:crypto";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { app } from "../../src/app.js";
import { prisma } from "../../src/lib/prisma.js";

const origin = "http://localhost:3000";
const password = "Integration-only-password-42";
type Agent = ReturnType<typeof request.agent>;
type Row = { id: string; position: number };

async function account() {
  const agent = request.agent(app);
  const email = `${randomUUID()}@integration.example`;
  const response = await agent
    .post("/api/auth/register")
    .set("Origin", origin)
    .send({ name: "Integration User", email, password })
    .expect(201);
  expect(response.body.data.user).not.toHaveProperty("passwordHash");
  return { agent, email, id: response.body.data.user.id as string };
}

async function fixture() {
  const owner = await account();
  const member = await account();
  const response = await owner.agent
    .post("/api/workspaces")
    .set("Origin", origin)
    .send({
      name: "Integration workspace",
      slug: `integration-${randomUUID()}`,
    })
    .expect(201);
  const workspaceId = response.body.data.workspace.id as string;
  await owner.agent
    .post(`/api/workspaces/${workspaceId}/members`)
    .set("Origin", origin)
    .send({ email: member.email, role: "MEMBER" })
    .expect(200);
  const project = await owner.agent
    .post(`/api/workspaces/${workspaceId}/projects`)
    .set("Origin", origin)
    .send({ name: "Integration project", key: "INT" })
    .expect(201);
  return {
    owner,
    member,
    workspaceId,
    projectId: project.body.data.project.id as string,
  };
}

async function task(
  agent: Agent,
  projectId: string,
  title = "Integration task",
) {
  const response = await agent
    .post("/api/tasks")
    .set("Origin", origin)
    .send({ projectId, title })
    .expect(201);
  return response.body.data.task as { id: string; assigneeId: string | null };
}

async function sprint(agent: Agent, projectId: string, name: string) {
  const response = await agent
    .post(`/api/projects/${projectId}/sprints`)
    .set("Origin", origin)
    .send({
      name,
      startDate: "2026-10-01T00:00:00.000Z",
      endDate: "2026-10-15T00:00:00.000Z",
    })
    .expect(201);
  return response.body.data.sprint as { id: string };
}

beforeAll(async () => {
  const rows = await prisma.$queryRaw<
    { schema: string }[]
  >`SELECT current_schema() AS schema`;
  expect(rows[0].schema).toBe(process.env.TASKFORGE_TEST_SCHEMA);
});
afterAll(async () => {
  await prisma.$disconnect();
});

describe("real PostgreSQL API workflows", () => {
  it("registers, repeatedly reads the session, logs out and logs back in using cookies", async () => {
    const user = await account();
    for (let i = 0; i < 3; i++) {
      const response = await user.agent.get("/api/auth/me").expect(200);
      expect(response.body.data.user.id).toBe(user.id);
      expect(response.body.data.user).not.toHaveProperty("passwordHash");
    }
    await user.agent
      .post("/api/auth/logout")
      .set("Origin", "http://untrusted.example")
      .expect(403);
    await user.agent.get("/api/auth/me").expect(200);
    const logout = await user.agent
      .post("/api/auth/logout")
      .set("Origin", origin)
      .expect(200);
    expect(logout.headers["set-cookie"].join(";")).toContain("Max-Age=0");
    await user.agent.get("/api/auth/me").expect(401);
    const login = await user.agent
      .post("/api/auth/login")
      .set("Origin", origin)
      .send({ email: user.email, password })
      .expect(200);
    expect(login.headers["set-cookie"].join(";")).toContain("HttpOnly");
    expect(login.body.data).not.toHaveProperty("token");
    for (let i = 0; i < 3; i++) {
      expect(
        (await user.agent.get("/api/auth/me").expect(200)).body.data.user.id,
      ).toBe(user.id);
    }
    expect(await prisma.user.count({ where: { id: user.id } })).toBe(1);
    await user.agent.post("/api/auth/logout").set("Origin", origin).expect(200);
    await user.agent.get("/api/auth/me").expect(401);
  });

  it("persists owner/member roles and self-assignment, rejecting member reassignment and deletion", async () => {
    const { owner, member, workspaceId, projectId } = await fixture();
    const memberships = await prisma.workspaceMember.findMany({
      where: { workspaceId },
    });
    expect(memberships).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ userId: owner.id, role: "OWNER" }),
        expect.objectContaining({ userId: member.id, role: "MEMBER" }),
      ]),
    );
    await member.agent
      .post(`/api/workspaces/${workspaceId}/projects`)
      .set("Origin", origin)
      .send({ name: "Forbidden", key: "NO" })
      .expect(403);
    const ownTask = await task(member.agent, projectId);
    expect(ownTask.assigneeId).toBe(member.id);
    await member.agent
      .patch(`/api/tasks/${ownTask.id}`)
      .set("Origin", origin)
      .send({ title: "Member edit" })
      .expect(200);
    for (const assigneeId of [owner.id, null]) {
      await member.agent
        .patch(`/api/tasks/${ownTask.id}`)
        .set("Origin", origin)
        .send({ assigneeId })
        .expect(403);
    }
    await member.agent
      .delete(`/api/tasks/${ownTask.id}`)
      .set("Origin", origin)
      .expect(403);
    const saved = await owner.agent.get(`/api/tasks/${ownTask.id}`).expect(200);
    expect(saved.body.data.task).toMatchObject({
      title: "Member edit",
      assigneeId: member.id,
    });
    expect(
      await prisma.task.findUnique({ where: { id: ownTask.id } }),
    ).toMatchObject({ title: "Member edit", assigneeId: member.id });
    await member.agent
      .post("/api/tasks")
      .set("Origin", origin)
      .send({ projectId, title: "Forbidden assignment", assigneeId: owner.id })
      .expect(403);
    const ownerTask = await task(owner.agent, projectId);
    await member.agent
      .patch(`/api/tasks/${ownerTask.id}`)
      .set("Origin", origin)
      .send({ title: "Forbidden edit" })
      .expect(403);
    await owner.agent
      .patch(`/api/tasks/${ownerTask.id}`)
      .set("Origin", origin)
      .send({ assigneeId: member.id })
      .expect(200);
    expect(
      await prisma.task.findUnique({ where: { id: ownerTask.id } }),
    ).toMatchObject({ assigneeId: member.id });
    await owner.agent
      .delete(`/api/tasks/${ownerTask.id}`)
      .set("Origin", origin)
      .expect(200);
    expect(
      await prisma.task.findUnique({ where: { id: ownerTask.id } }),
    ).toBeNull();
  });

  it("persists cross-column moves and same-column ordering on independent board reads", async () => {
    const { owner, member, projectId } = await fixture();
    const first = await task(owner.agent, projectId, "First");
    const second = await task(owner.agent, projectId, "Second");
    const third = await task(owner.agent, projectId, "Third");
    await owner.agent
      .patch(`/api/tasks/${second.id}/position`)
      .set("Origin", origin)
      .send({ status: "IN_PROGRESS", position: 0 })
      .expect(200);
    await owner.agent
      .patch(`/api/tasks/${third.id}/position`)
      .set("Origin", origin)
      .send({ position: 0 })
      .expect(200);
    for (const reader of [owner.agent, member.agent]) {
      const board = (
        await reader.get(`/api/projects/${projectId}/board`).expect(200)
      ).body.data.columns;
      expect(board.TODO.map((row: Row) => row.id)).toEqual([
        third.id,
        first.id,
      ]);
      expect(board.TODO.map((row: Row) => row.position)).toEqual([0, 1]);
      expect(board.IN_PROGRESS.map((row: Row) => row.id)).toEqual([second.id]);
    }
    const stored = await prisma.task.findMany({
      where: { projectId, status: "TODO" },
      orderBy: { position: "asc" },
    });
    expect(stored.map((row) => row.id)).toEqual([third.id, first.id]);
    expect(
      await prisma.task.findUnique({ where: { id: second.id } }),
    ).toMatchObject({ status: "IN_PROGRESS", position: 0 });
  });

  it("enforces one active sprint, valid transitions and task sprint assignment", async () => {
    const { owner, member, projectId } = await fixture();
    const first = await sprint(owner.agent, projectId, "First sprint");
    const second = await sprint(owner.agent, projectId, "Second sprint");
    const item = await task(member.agent, projectId);
    await owner.agent
      .post(`/api/sprints/${first.id}/complete`)
      .set("Origin", origin)
      .expect(409);
    await member.agent
      .post(`/api/sprints/${first.id}/start`)
      .set("Origin", origin)
      .expect(403);
    await owner.agent
      .post(`/api/sprints/${first.id}/start`)
      .set("Origin", origin)
      .expect(200);
    await owner.agent
      .post(`/api/sprints/${second.id}/start`)
      .set("Origin", origin)
      .expect(409);
    expect(
      await prisma.sprint.count({ where: { projectId, status: "ACTIVE" } }),
    ).toBe(1);
    await member.agent
      .patch(`/api/tasks/${item.id}`)
      .set("Origin", origin)
      .send({ sprintId: first.id })
      .expect(403);
    await owner.agent
      .patch(`/api/tasks/${item.id}`)
      .set("Origin", origin)
      .send({ sprintId: first.id })
      .expect(200);
    expect(
      (await member.agent.get(`/api/tasks/${item.id}`).expect(200)).body.data
        .task.sprintId,
    ).toBe(first.id);
    expect(
      await prisma.task.findUnique({ where: { id: item.id } }),
    ).toMatchObject({ sprintId: first.id });
    await owner.agent
      .post(`/api/sprints/${first.id}/complete`)
      .set("Origin", origin)
      .expect(200);
    await owner.agent
      .post(`/api/sprints/${first.id}/start`)
      .set("Origin", origin)
      .expect(409);
    await owner.agent
      .patch(`/api/tasks/${item.id}`)
      .set("Origin", origin)
      .send({ sprintId: first.id })
      .expect(409);
    await owner.agent
      .post(`/api/sprints/${second.id}/start`)
      .set("Origin", origin)
      .expect(200);
    const listed = (
      await member.agent.get(`/api/projects/${projectId}/sprints`).expect(200)
    ).body.data.sprints;
    expect(listed).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: first.id, status: "COMPLETED" }),
        expect.objectContaining({ id: second.id, status: "ACTIVE" }),
      ]),
    );
    await owner.agent
      .patch(`/api/tasks/${item.id}`)
      .set("Origin", origin)
      .send({ sprintId: null })
      .expect(200);
    expect(
      await prisma.task.findUnique({ where: { id: item.id } }),
    ).toMatchObject({ sprintId: null });
  });

  it("persists comment edits/deletion and actor-attributed audit events", async () => {
    const { owner, member, projectId } = await fixture();
    const item = await task(owner.agent, projectId);
    const created = await member.agent
      .post(`/api/tasks/${item.id}/comments`)
      .set("Origin", origin)
      .send({ content: "Original comment" })
      .expect(201);
    const commentId = created.body.data.comment.id as string;
    await owner.agent
      .patch(`/api/comments/${commentId}`)
      .set("Origin", origin)
      .send({ content: "Not the author" })
      .expect(403);
    await member.agent
      .patch(`/api/comments/${commentId}`)
      .set("Origin", origin)
      .send({ content: "Edited comment" })
      .expect(200);
    const comments = (
      await owner.agent.get(`/api/tasks/${item.id}/comments`).expect(200)
    ).body.data.comments;
    expect(comments).toEqual([
      expect.objectContaining({ id: commentId, content: "Edited comment" }),
    ]);
    expect(
      await prisma.comment.findUnique({ where: { id: commentId } }),
    ).toMatchObject({ content: "Edited comment" });
    await owner.agent
      .delete(`/api/comments/${commentId}`)
      .set("Origin", origin)
      .expect(200);
    expect(
      await prisma.comment.findUnique({ where: { id: commentId } }),
    ).toBeNull();
    expect(
      (await member.agent.get(`/api/tasks/${item.id}/comments`).expect(200))
        .body.data.comments,
    ).toEqual([]);
    const expected = [
      expect.objectContaining({
        action: "COMMENT_ADDED",
        userId: member.id,
        metadata: { commentId },
      }),
      expect.objectContaining({
        action: "COMMENT_UPDATED",
        userId: member.id,
        metadata: { commentId },
      }),
      expect.objectContaining({
        action: "COMMENT_DELETED",
        userId: owner.id,
        metadata: { commentId },
      }),
    ];
    const activity = (
      await owner.agent.get(`/api/tasks/${item.id}/activities`).expect(200)
    ).body.data.activities;
    expect(activity).toEqual(expect.arrayContaining(expected));
    expect(
      await prisma.activity.findMany({ where: { taskId: item.id } }),
    ).toEqual(expect.arrayContaining(expected));
  });

  it("allows only owner workspace deletion and cascades its persisted dependent records", async () => {
    const { owner, member, workspaceId, projectId } = await fixture();
    const item = await task(owner.agent, projectId);
    const iteration = await sprint(owner.agent, projectId, "Cascade sprint");
    await owner.agent
      .patch(`/api/tasks/${item.id}`)
      .set("Origin", origin)
      .send({ sprintId: iteration.id })
      .expect(200);
    await member.agent
      .post(`/api/tasks/${item.id}/comments`)
      .set("Origin", origin)
      .send({ content: "Cascade comment" })
      .expect(201);
    expect(await prisma.comment.count({ where: { taskId: item.id } })).toBe(1);
    expect(
      await prisma.activity.count({ where: { taskId: item.id } }),
    ).toBeGreaterThan(0);
    await member.agent
      .delete(`/api/workspaces/${workspaceId}`)
      .set("Origin", origin)
      .expect(403);
    expect(
      await prisma.workspace.findUnique({ where: { id: workspaceId } }),
    ).not.toBeNull();
    await owner.agent
      .delete(`/api/workspaces/${workspaceId}`)
      .set("Origin", origin)
      .expect(200);
    expect(
      await prisma.workspace.findUnique({ where: { id: workspaceId } }),
    ).toBeNull();
    expect(await prisma.workspaceMember.count({ where: { workspaceId } })).toBe(
      0,
    );
    expect(await prisma.project.count({ where: { workspaceId } })).toBe(0);
    expect(await prisma.task.count({ where: { projectId } })).toBe(0);
    expect(await prisma.sprint.count({ where: { projectId } })).toBe(0);
    expect(await prisma.comment.count({ where: { taskId: item.id } })).toBe(0);
    expect(await prisma.activity.count({ where: { taskId: item.id } })).toBe(0);
    expect(
      await prisma.user.count({ where: { id: { in: [owner.id, member.id] } } }),
    ).toBe(2);
    await owner.agent.get(`/api/workspaces/${workspaceId}`).expect(404);
    await member.agent.get(`/api/tasks/${item.id}`).expect(404);
  });
});
