import { randomUUID } from "node:crypto";
import request from "supertest";
import jwt from "jsonwebtoken";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { app } from "../../src/app.js";
import { prisma } from "../../src/lib/prisma.js";
import { env } from "../../src/config/env.js";

let projectId: string;
let foreignProjectId: string;
let siblingId: string;
let userId: string;
let sprintId: string;
let authorization: string;
type TaskRow = { id: string; number: number; status: string; position: number };
beforeAll(async () => {
  const user = await prisma.user.create({
    data: {
      name: "Search tester",
      email: `${randomUUID()}@integration.example`,
      passwordHash: "unused",
    },
  });
  userId = user.id;
  authorization = `Bearer ${jwt.sign({ email: user.email }, env.JWT_SECRET, { subject: user.id, issuer: env.JWT_ISSUER, audience: env.JWT_AUDIENCE, expiresIn: "15m" })}`;
  const workspace = await prisma.workspace.create({
    data: {
      name: "Search",
      slug: randomUUID(),
      members: { create: { userId, role: "OWNER" } },
    },
  });
  const project = await prisma.project.create({
    data: { workspaceId: workspace.id, name: "Search", key: "SEARCH-CORE" },
  });
  projectId = project.id;
  siblingId = (
    await prisma.project.create({
      data: { workspaceId: workspace.id, name: "Sibling", key: "OTHER" },
    })
  ).id;
  const foreign = await prisma.workspace.create({
    data: { name: "Private", slug: randomUUID() },
  });
  foreignProjectId = (
    await prisma.project.create({
      data: { workspaceId: foreign.id, name: "Private", key: "SEARCH-CORE" },
    })
  ).id;
  sprintId = (
    await prisma.sprint.create({
      data: {
        projectId,
        name: "Search sprint",
        startDate: new Date(),
        endDate: new Date(),
      },
    })
  ).id;
  await prisma.task.createMany({
    data: Array.from({ length: 7 }, (_, i) => ({
      projectId,
      number: i + 1,
      title: i === 0 ? "Needle Title" : `Task ${i + 1}`,
      description:
        i === 1
          ? "A NEEDLE in description"
          : i === 2
            ? "literal 50%_\\ value"
            : null,
      status:
        i < 3
          ? ("TODO" as const)
          : i < 5
            ? ("IN_PROGRESS" as const)
            : ("DONE" as const),
      position: 0,
      priority: i === 1 ? ("HIGH" as const) : ("MEDIUM" as const),
      type: i === 1 ? ("BUG" as const) : ("TASK" as const),
      assigneeId: i === 1 ? userId : null,
      sprintId: i === 1 ? sprintId : null,
      createdAt: new Date("2026-01-01T00:00:00Z"),
    })),
  });
  for (const id of [foreignProjectId, siblingId])
    await prisma.task.create({
      data: { projectId: id, number: 1, title: "Needle Title" },
    });
});
afterAll(async () => {
  await prisma.$disconnect();
});

const read = async (
  path: string,
  query: Record<string, string | number> = {},
) => {
  const response = await request(app)
    .get(path)
    .set("Authorization", authorization)
    .query({ projectId, ...query })
    .expect(200);
  const data = response.body.data;
  return {
    ...data,
    items: (data.tasks ?? Object.values(data.columns).flat()) as TaskRow[],
  };
};

describe("real project-scoped task search", () => {
  for (const endpoint of ["list", "search", "board"]) {
    const path = () =>
      endpoint === "board"
        ? `/api/projects/${projectId}/board`
        : `/api/tasks${endpoint === "search" ? "/search" : ""}`;
    it(`${endpoint}: finds title, description and exact hyphenated identifiers without leaking projects`, async () => {
      expect(
        (await read(path(), { q: "  nEeDlE  " })).items
          .map((t: TaskRow) => t.number)
          .sort(),
      ).toEqual([1, 2]);
      expect(
        (await read(path(), { q: "search-core-3" })).items.map(
          (t: TaskRow) => t.number,
        ),
      ).toEqual([3]);
      for (const q of [
        "other-3",
        "search-core-30",
        "search-core-9999999999999999999",
        "' OR 1=1 --",
      ]) {
        expect((await read(path(), { q })).pagination.total).toBe(0);
      }
      expect(
        (await read(path(), { q: "%_\\" })).items.map((t: TaskRow) => t.number),
      ).toEqual([3]);
      expect((await read(path(), { q: " " })).pagination.total).toBe(7);
    });
    it(`${endpoint}: ANDs all filters including literal nulls`, async () => {
      expect(
        (await read(path(), { assigneeId: "unassigned", sprintId: "backlog" }))
          .pagination.total,
      ).toBe(6);
      const query = {
        q: "needle",
        status: "TODO",
        priority: "HIGH",
        type: "BUG",
        assigneeId: userId,
        sprintId,
      };
      expect(
        (await read(path(), query)).items.map((t: TaskRow) => t.number),
      ).toEqual([2]);
      expect(
        (await read(path(), { ...query, sprintId: "backlog" })).pagination
          .total,
      ).toBe(0);
      expect(
        (await read(path(), { ...query, assigneeId: "unassigned" })).pagination
          .total,
      ).toBe(0);
      expect(
        (await read(path(), { ...query, status: "DONE" })).pagination.total,
      ).toBe(0);
    });
    it(`${endpoint}: pages tied rows deterministically with no duplicates`, async () => {
      const all: TaskRow[] = [];
      for (let page = 1; page <= 4; page++) {
        const result = await read(path(), { page, limit: 2 });
        expect(result.pagination).toEqual({
          page,
          limit: 2,
          total: 7,
          totalPages: 4,
        });
        expect((await read(path(), { page, limit: 2 })).items).toEqual(
          result.items,
        );
        all.push(...result.items);
      }
      expect(new Set(all.map((t) => t.id)).size).toBe(7);
      const expected = await prisma.task.findMany({
        where: { projectId },
        orderBy:
          endpoint === "board"
            ? [{ status: "asc" }, { position: "asc" }, { id: "asc" }]
            : [{ createdAt: "desc" }, { id: "desc" }],
      });
      expect(all.map((t) => t.id)).toEqual(expected.map((t) => t.id));
      expect((await read(path(), { page: 5, limit: 2 })).items).toEqual([]);
      expect((await read(path())).pagination).toEqual({
        page: 1,
        limit: 20,
        total: 7,
        totalPages: 1,
      });
    });
  }
  it("rejects unauthenticated and foreign-workspace reads for every endpoint", async () => {
    for (const path of [
      "/api/tasks",
      "/api/tasks/search",
      `/api/projects/${foreignProjectId}/board`,
    ]) {
      await request(app)
        .get(path)
        .query({ projectId: foreignProjectId })
        .expect(401);
      await request(app)
        .get(path)
        .set("Authorization", authorization)
        .query({ projectId: foreignProjectId, q: "needle" })
        .expect(404);
    }
  });
});
