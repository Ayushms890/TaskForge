import { randomUUID } from "node:crypto";
import request from "supertest";
import jwt from "jsonwebtoken";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { app } from "../../src/app.js";
import { prisma } from "../../src/lib/prisma.js";
import { env } from "../../src/config/env.js";

let projectId: string;
let workspaceId: string;
let emptyProjectId: string;
let foreignProjectId: string;
let activeId: string;
let emptySprintId: string;
let authorization: string;
let outsiderAuthorization: string;
let userId: string;
let actorId: string;
const taskIds = Array.from({ length: 12 }, () => randomUUID()).sort();
const activityIds = Array.from({ length: 12 }, () => randomUUID()).sort();
const timestamp = new Date("2026-01-01T00:00:00Z");
const newest = new Date("2026-02-01T00:00:00Z");
const dates = { startDate: timestamp, endDate: newest };
const token = (user: { id: string; email: string }) =>
  `Bearer ${jwt.sign({ email: user.email }, env.JWT_SECRET, {
    subject: user.id,
    issuer: env.JWT_ISSUER,
    audience: env.JWT_AUDIENCE,
    expiresIn: "15m",
  })}`;

beforeAll(async () => {
  const user = await prisma.user.create({
    data: {
      name: "Dashboard member",
      email: `${randomUUID()}@integration.example`,
      passwordHash: "dashboard-secret-hash",
    },
  });
  const actor = await prisma.user.create({
    data: {
      name: "Activity actor",
      email: `${randomUUID()}@integration.example`,
      passwordHash: "actor-secret-hash",
    },
  });
  userId = user.id;
  actorId = actor.id;
  authorization = token(user);
  outsiderAuthorization = token(actor);
  workspaceId = (
    await prisma.workspace.create({
      data: {
        name: "Dashboard",
        slug: randomUUID(),
        members: { create: { userId, role: "MEMBER" } },
      },
    })
  ).id;
  projectId = (
    await prisma.project.create({
      data: {
        workspaceId,
        name: "Dashboard",
        key: "DASH-CORE",
        description: "Dashboard description",
      },
    })
  ).id;
  emptyProjectId = (
    await prisma.project.create({
      data: {
        workspaceId,
        name: "Empty",
        key: "EMPTY",
      },
    })
  ).id;
  const foreignWorkspace = await prisma.workspace.create({
    data: { name: "Private", slug: randomUUID() },
  });
  foreignProjectId = (
    await prisma.project.create({
      data: {
        workspaceId: foreignWorkspace.id,
        name: "Private",
        key: "PRIVATE",
      },
    })
  ).id;
  activeId = (
    await prisma.sprint.create({
      data: {
        projectId,
        name: "Active",
        goal: "Ship",
        status: "ACTIVE",
        ...dates,
      },
    })
  ).id;
  const inactiveSprintIds: string[] = [];
  for (const status of ["PLANNED", "COMPLETED"] as const) {
    const sprint = await prisma.sprint.create({
      data: {
        projectId,
        name: status,
        status,
        startDate: newest,
        endDate: newest,
      },
    });
    inactiveSprintIds.push(sprint.id);
  }
  emptySprintId = (
    await prisma.sprint.create({
      data: {
        projectId: emptyProjectId,
        name: "Empty sprint",
        status: "ACTIVE",
        ...dates,
      },
    })
  ).id;
  await prisma.task.createMany({
    data: taskIds.map((id, i) => ({
      id,
      projectId,
      number: i + 1,
      title: `Task ${i + 1}`,
      status: i < 5 ? "TODO" : i < 9 ? "IN_PROGRESS" : "DONE",
      priority: "HIGH",
      type: "BUG",
      assigneeId: i === 0 ? userId : null,
      sprintId: [0, 5, 9].includes(i)
        ? activeId
        : i === 10
          ? inactiveSprintIds[0]!
          : i === 11
            ? inactiveSprintIds[1]!
            : null,
      updatedAt: i === 0 ? newest : timestamp,
    })),
  });
  await prisma.activity.createMany({
    data: activityIds.map((id, i) => ({
      id,
      taskId: taskIds[i]!,
      userId: actorId,
      action: "STATUS_CHANGED",
      metadata: { from: "TODO", to: "IN_PROGRESS" },
      createdAt: i === 0 ? newest : timestamp,
    })),
  });
  // A sibling and an inaccessible project both have newer activity/tasks.
  const sibling = await prisma.project.create({
    data: { workspaceId, name: "Sibling", key: "SIBLING" },
  });
  for (const id of [sibling.id, foreignProjectId]) {
    const task = await prisma.task.create({
      data: { projectId: id, number: 1, title: "Do not leak", status: "DONE" },
    });
    await prisma.activity.create({
      data: { taskId: task.id, userId, action: "TASK_CREATED", metadata: {} },
    });
    await prisma.sprint.create({
      data: { projectId: id, name: "Other active", status: "ACTIVE", ...dates },
    });
  }
});
afterAll(async () => {
  await prisma.$disconnect();
});

const read = async (id = projectId) =>
  (
    await request(app)
      .get(`/api/projects/${id}/dashboard`)
      .set("Authorization", authorization)
      .expect(200)
  ).body.data;

describe("project dashboard against PostgreSQL", () => {
  it("returns the exact contract, full counts and rounded active sprint progress", async () => {
    const data = await read();
    expect(Object.keys(data).sort()).toEqual([
      "activeSprint",
      "project",
      "recentActivity",
      "recentTasks",
      "summary",
    ]);
    expect(data.project).toEqual({
      id: projectId,
      workspaceId,
      name: "Dashboard",
      key: "DASH-CORE",
      description: "Dashboard description",
    });
    expect(data.summary).toEqual({
      total: 12,
      todo: 5,
      inProgress: 4,
      done: 3,
    });
    expect(data.activeSprint).toEqual({
      id: activeId,
      name: "Active",
      goal: "Ship",
      startDate: timestamp.toISOString(),
      endDate: newest.toISOString(),
      totalTasks: 3,
      doneTasks: 1,
      progressPercent: 33,
    });
  });

  it("caps both recent lists at eight with timestamp then id ordering and safe actor/task projections", async () => {
    const data = await read();
    const recentIndices = [0, 11, 10, 9, 8, 7, 6, 5];
    expect(data.recentTasks).toEqual(
      recentIndices.map((i) => ({
        id: taskIds[i],
        identifier: `DASH-CORE-${i + 1}`,
        title: `Task ${i + 1}`,
        status: i < 5 ? "TODO" : i < 9 ? "IN_PROGRESS" : "DONE",
        priority: "HIGH",
        type: "BUG",
        assignee: i === 0 ? { id: userId, name: "Dashboard member" } : null,
        updatedAt: (i === 0 ? newest : timestamp).toISOString(),
      })),
    );
    expect(data.recentActivity).toEqual(
      recentIndices.map((i) => ({
        id: activityIds[i],
        action: "STATUS_CHANGED",
        metadata: { from: "TODO", to: "IN_PROGRESS" },
        createdAt: (i === 0 ? newest : timestamp).toISOString(),
        user: { id: actorId, name: "Activity actor" },
        task: {
          id: taskIds[i],
          identifier: `DASH-CORE-${i + 1}`,
          title: `Task ${i + 1}`,
        },
      })),
    );
    expect(await read()).toEqual(data);
    const serialized = JSON.stringify(data);
    for (const forbidden of [
      "passwordHash",
      "secret-hash",
      "@integration.example",
      "Do not leak",
      "reporterId",
      "assigneeId",
    ])
      expect(serialized).not.toContain(forbidden);
  });

  it("handles an empty project and active sprint without division by zero", async () => {
    const data = await read(emptyProjectId);
    expect(data.summary).toEqual({ total: 0, todo: 0, inProgress: 0, done: 0 });
    expect(data.recentTasks).toEqual([]);
    expect(data.recentActivity).toEqual([]);
    expect(data.activeSprint).toEqual({
      id: emptySprintId,
      name: "Empty sprint",
      goal: null,
      startDate: timestamp.toISOString(),
      endDate: newest.toISOString(),
      totalTasks: 0,
      doneTasks: 0,
      progressPercent: 0,
    });
  });

  it("returns null when only planned/completed sprints exist or there are no sprints", async () => {
    const project = await prisma.project.create({
      data: { workspaceId, name: "No active", key: "NOACTIVE" },
    });
    expect((await read(project.id)).activeSprint).toBeNull();
    for (const status of ["PLANNED", "COMPLETED"] as const) {
      await prisma.sprint.create({
        data: { projectId: project.id, name: status, status, ...dates },
      });
      expect((await read(project.id)).activeSprint).toBeNull();
    }
  });

  it("requires login and hides inaccessible or nonexistent projects", async () => {
    await request(app).get(`/api/projects/${projectId}/dashboard`).expect(401);
    for (const id of [foreignProjectId, randomUUID()]) {
      const response = await request(app)
        .get(`/api/projects/${id}/dashboard`)
        .set("Authorization", authorization)
        .expect(404);
      expect(response.body.error.code).toBe("PROJECT_NOT_FOUND");
    }
    await request(app)
      .get(`/api/projects/${projectId}/dashboard`)
      .set("Authorization", outsiderAuthorization)
      .expect(404);
  });
});
