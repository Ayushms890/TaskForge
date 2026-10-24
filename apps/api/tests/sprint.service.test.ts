import { describe, expect, it, vi } from "vitest";
import { createSprintService } from "../src/services/sprint.service.js";

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
  role: "OWNER" as const,
  createdAt: new Date(),
};
const sprint = (status: "PLANNED" | "ACTIVE" | "COMPLETED" = "PLANNED") => ({
  id: "s1",
  projectId: "p1",
  name: "Sprint 1",
  goal: null,
  startDate: new Date("2026-01-01"),
  endDate: new Date("2026-01-14"),
  status,
  createdAt: new Date(),
  updatedAt: new Date(),
});

const setup = (current = sprint()) => {
  const sprints = {
    create: vi.fn().mockResolvedValue(current),
    listForProject: vi.fn().mockResolvedValue([current]),
    findById: vi.fn().mockResolvedValue(current),
    update: vi.fn().mockResolvedValue(current),
    start: vi.fn().mockResolvedValue({ ...current, status: "ACTIVE" }),
    complete: vi.fn().mockResolvedValue({ ...current, status: "COMPLETED" }),
  } as never;
  const projects = { findById: vi.fn().mockResolvedValue(project) } as never;
  const workspaces = { findMember: vi.fn().mockResolvedValue(member) } as never;
  return {
    service: createSprintService(sprints, projects, workspaces),
    sprints,
    workspaces,
  };
};

describe("sprint service", () => {
  it("creates and lists a project sprint with date conversion", async () => {
    const { service, sprints } = setup();
    await service.create("u1", "p1", {
      name: "Sprint 1",
      startDate: "2026-01-01T00:00:00Z",
      endDate: "2026-01-14T00:00:00Z",
    });
    expect(sprints.create).toHaveBeenCalledWith(
      expect.objectContaining({ projectId: "p1", startDate: expect.any(Date) }),
    );
    await expect(service.list("u1", "p1")).resolves.toHaveLength(1);
  });
  it("enforces transitions, one active conflict, and completed immutability", async () => {
    const setupActive = setup(sprint("ACTIVE"));
    await expect(setupActive.service.start("u1", "s1")).rejects.toMatchObject({
      code: "INVALID_SPRINT_TRANSITION",
    });
    await expect(
      setupActive.service.update("u1", "s1", { name: "new" }),
    ).resolves.toBeDefined();
    const completed = setup(sprint("COMPLETED"));
    await expect(
      completed.service.update("u1", "s1", { name: "new" }),
    ).rejects.toMatchObject({ code: "SPRINT_COMPLETED" });
    const planned = setup();
    (planned.sprints.start as ReturnType<typeof vi.fn>).mockRejectedValue({
      code: "P2002",
    });
    await expect(planned.service.start("u1", "s1")).rejects.toMatchObject({
      code: "ACTIVE_SPRINT_EXISTS",
    });
  });
  it("rejects nonmembers", async () => {
    const { service, workspaces } = setup();
    (workspaces.findMember as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    await expect(service.list("u1", "p1")).rejects.toMatchObject({
      code: "PROJECT_NOT_FOUND",
    });
  });
});
