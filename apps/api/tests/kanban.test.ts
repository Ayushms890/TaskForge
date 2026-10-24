import { describe, expect, it, vi } from "vitest";
import { createTaskService } from "../src/services/task.service.js";
import {
  taskPositionSchema,
  taskStatusSchema,
  taskQuerySchema,
} from "../src/schemas/task.schemas.js";

const project = {
  id: "p1",
  workspaceId: "w1",
  name: "Core",
  key: "CORE",
  description: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};
const member = {
  id: "m1",
  workspaceId: "w1",
  userId: "u1",
  role: "MEMBER" as const,
  createdAt: new Date(),
};
const task = (
  id: string,
  status: "TODO" | "IN_PROGRESS" | "DONE",
  position: number,
) => ({
  id,
  projectId: "p1",
  number: position + 1,
  title: id,
  description: null,
  status,
  position,
  priority: "MEDIUM" as const,
  type: "TASK" as const,
  assigneeId: "u1",
  createdAt: new Date(),
  updatedAt: new Date(),
});

const setup = (overrides: Record<string, unknown> = {}) => {
  const tasks = {
    findById: vi.fn(),
    list: vi.fn(),
    move: vi.fn(),
    ...overrides,
  };
  const projects = { findById: vi.fn().mockResolvedValue(project) } as never;
  const workspaces = { findMember: vi.fn().mockResolvedValue(member) } as never;
  return {
    service: createTaskService(tasks as never, projects, workspaces),
    tasks,
    workspaces,
  };
};

describe("Kanban persistence service", () => {
  it("preserves nullable filters for programmatic callers", () => {
    expect(
      taskQuerySchema.parse({
        projectId: "p1",
        assigneeId: null,
        sprintId: null,
      }),
    ).toMatchObject({ assigneeId: null, sprintId: null, page: 1, limit: 20 });
  });
  it("groups board tasks in persisted position order and includes project metadata", async () => {
    const { service } = setup({
      list: vi.fn().mockResolvedValue({
        items: [
          task("b", "TODO", 1),
          task("a", "TODO", 0),
          task("c", "DONE", 0),
        ],
        total: 3,
      }),
    });
    await expect(service.board("u1", "p1")).resolves.toMatchObject({
      project: { id: "p1", key: "CORE" },
      columns: {
        TODO: [{ id: "b" }, { id: "a" }],
        IN_PROGRESS: [],
        DONE: [{ id: "c" }],
      },
    });
  });

  it("authorizes moves and delegates status and cross-column position atomically", async () => {
    const moved = task("a", "DONE", 1);
    const { service, tasks } = setup({
      findById: vi.fn().mockResolvedValue(task("a", "TODO", 0)),
      move: vi.fn().mockResolvedValue(moved),
    });
    await expect(
      service.changeStatus("u1", "a", { status: "DONE" }),
    ).resolves.toMatchObject({ id: "a", status: "DONE" });
    await expect(
      service.changePosition("u1", "a", { status: "DONE", position: 1 }),
    ).resolves.toMatchObject({ position: 1 });
    expect(tasks.move).toHaveBeenNthCalledWith(
      1,
      "a",
      { status: "DONE" },
      "u1",
    );
    expect(tasks.move).toHaveBeenNthCalledWith(
      2,
      "a",
      {
        status: "DONE",
        position: 1,
      },
      "u1",
    );
  });

  it("rejects nonmembers and unknown tasks, and validates move payloads", async () => {
    const { service, workspaces } = setup({
      findById: vi.fn().mockResolvedValue(task("a", "TODO", 0)),
    });
    (workspaces.findMember as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    await expect(
      service.changeStatus("u2", "a", { status: "DONE" }),
    ).rejects.toMatchObject({ code: "PROJECT_NOT_FOUND" });
    (workspaces.findMember as ReturnType<typeof vi.fn>).mockResolvedValue(
      member,
    );
    const unknown = setup();
    await expect(
      unknown.service.changeStatus("u1", "missing", { status: "DONE" }),
    ).rejects.toMatchObject({ code: "TASK_NOT_FOUND" });
    expect(taskStatusSchema.safeParse({ status: "BROKEN" }).success).toBe(
      false,
    );
    expect(taskPositionSchema.safeParse({ position: -1 }).success).toBe(false);
  });
});
