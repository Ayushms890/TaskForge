import { describe, expect, it, vi } from "vitest";
import { createProjectService } from "../src/services/project.service.js";
import { createTaskService } from "../src/services/task.service.js";

const project = {
  id: "p1",
  workspaceId: "w1",
  name: "Core",
  key: "CORE",
  description: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};
const task = {
  id: "t1",
  projectId: "p1",
  number: 7,
  title: "Fix",
  description: null,
  status: "TODO" as const,
  priority: "HIGH" as const,
  type: "BUG" as const,
  assigneeId: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};
const owner = {
  id: "m1",
  workspaceId: "w1",
  userId: "u1",
  role: "OWNER" as const,
  createdAt: new Date(),
};
const member = { ...owner, role: "MEMBER" as const };

describe("project and task service authorization", () => {
  it.each([{}, { assigneeId: null }, { assigneeId: "u1" }])(
    "member creation %j remains editable and uses authenticated audit identity",
    async (assignment) => {
      let saved = { ...task, assigneeId: null as string | null };
      const tasks = {
        createNext: vi.fn(async (data) => (saved = { ...saved, ...data })),
        findById: vi.fn(async () => saved),
        update: vi.fn(async (_id, data) => (saved = { ...saved, ...data })),
        move: vi.fn(async (_id, data) => (saved = { ...saved, ...data })),
        remove: vi.fn(),
      };
      const service = createTaskService(
        tasks as never,
        { findById: vi.fn().mockResolvedValue(project) } as never,
        { findMember: vi.fn().mockResolvedValue(member) } as never,
      );
      const input = {
        projectId: "p1",
        title: "New",
        ...assignment,
        reporterId: "spoof",
        actorId: "spoof",
      };
      await expect(service.create("u1", input)).resolves.toMatchObject({
        assigneeId: "u1",
        reporterId: "u1",
      });
      expect(tasks.createNext).toHaveBeenCalledWith(
        expect.objectContaining({ actorId: "u1" }),
      );
      const edit = { title: "Edited", reporterId: "spoof", actorId: "spoof" };
      await service.update("u1", "t1", edit);
      expect(tasks.update).toHaveBeenCalledWith(
        "t1",
        { title: "Edited" },
        "u1",
      );
      await service.changeStatus("u1", "t1", { status: "IN_PROGRESS" });
      await service.changePosition("u1", "t1", { position: 1, status: "DONE" });
      expect(tasks.move).toHaveBeenLastCalledWith(
        "t1",
        { position: 1, status: "DONE" },
        "u1",
      );
      for (const restricted of [
        { assigneeId: null },
        { assigneeId: "u1" },
        { sprintId: null },
      ]) {
        await expect(
          service.update("u1", "t1", restricted),
        ).rejects.toMatchObject({ code: "TASK_ASSIGNMENT_FORBIDDEN" });
      }
      await expect(service.remove("u1", "t1")).rejects.toMatchObject({
        code: "TASK_DELETE_FORBIDDEN",
      });
      for (const assigneeId of [null, "u2"]) {
        saved.assigneeId = assigneeId;
        await expect(
          service.update("u1", "t1", { title: "Forbidden" }),
        ).rejects.toMatchObject({ code: "TASK_UPDATE_FORBIDDEN" });
        await expect(
          service.changeStatus("u1", "t1", { status: "DONE" }),
        ).rejects.toMatchObject({ code: "TASK_UPDATE_FORBIDDEN" });
        await expect(
          service.changePosition("u1", "t1", { position: 0 }),
        ).rejects.toMatchObject({ code: "TASK_UPDATE_FORBIDDEN" });
      }
      expect(tasks.update).toHaveBeenCalledTimes(1);
      expect(tasks.move).toHaveBeenCalledTimes(2);
      expect(tasks.remove).not.toHaveBeenCalled();
    },
  );

  it.each([{ assigneeId: "u2" }, { sprintId: "s1" }])(
    "rejects member creation with %j",
    async (assignment) => {
      const tasks = { createNext: vi.fn() };
      const service = createTaskService(
        tasks as never,
        { findById: vi.fn().mockResolvedValue(project) } as never,
        { findMember: vi.fn().mockResolvedValue(member) } as never,
      );
      await expect(
        service.create("u1", { projectId: "p1", title: "New", ...assignment }),
      ).rejects.toMatchObject({ code: "TASK_ASSIGNMENT_FORBIDDEN" });
      expect(tasks.createNext).not.toHaveBeenCalled();
    },
  );

  it("restricts project creation and maps key conflicts", async () => {
    const workspaces = {
      findMember: vi.fn().mockResolvedValue(member),
    } as never;
    const projects = {
      create: vi.fn().mockRejectedValue({ code: "P2002" }),
    } as never;
    const service = createProjectService(projects, workspaces);
    await expect(
      service.create("u1", "w1", { name: "Core", key: "CORE" }),
    ).rejects.toMatchObject({ code: "PROJECT_CREATE_FORBIDDEN" });
    (workspaces.findMember as ReturnType<typeof vi.fn>).mockResolvedValue(
      owner,
    );
    await expect(
      service.create("u1", "w1", { name: "Core", key: "CORE" }),
    ).rejects.toMatchObject({ code: "PROJECT_KEY_ALREADY_EXISTS" });
  });

  it("creates numbered task identifiers and protects deletion", async () => {
    const workspaces = {
      findMember: vi.fn().mockResolvedValue(member),
    } as never;
    const projects = { findById: vi.fn().mockResolvedValue(project) } as never;
    const tasks = {
      createNext: vi.fn().mockResolvedValue(task),
      findById: vi.fn().mockResolvedValue(task),
      remove: vi.fn(),
    } as never;
    const service = createTaskService(tasks, projects, workspaces);
    await expect(
      service.create("u1", {
        projectId: "p1",
        title: "Fix",
        type: "BUG",
        priority: "HIGH",
      }),
    ).resolves.toMatchObject({ identifier: "CORE-7" });
    await expect(service.remove("u1", "t1")).rejects.toMatchObject({
      code: "TASK_DELETE_FORBIDDEN",
    });
    (workspaces.findMember as ReturnType<typeof vi.fn>).mockResolvedValue(
      owner,
    );
    await expect(service.remove("u1", "t1")).resolves.toBeUndefined();
  });

  it("requires assignees to belong to the project workspace and allows unassigning", async () => {
    const workspaces = {
      findMember: vi
        .fn()
        .mockResolvedValueOnce(owner)
        .mockResolvedValueOnce(null)
        .mockResolvedValue(owner),
    } as never;
    const projects = { findById: vi.fn().mockResolvedValue(project) } as never;
    const tasks = { createNext: vi.fn().mockResolvedValue(task) } as never;
    const service = createTaskService(tasks, projects, workspaces);
    await expect(
      service.create("u1", { projectId: "p1", title: "Fix", assigneeId: "u2" }),
    ).rejects.toMatchObject({ code: "TASK_ASSIGNEE_NOT_FOUND" });
    await expect(
      service.create("u1", { projectId: "p1", title: "Fix", assigneeId: null }),
    ).resolves.toBeDefined();
  });
});
