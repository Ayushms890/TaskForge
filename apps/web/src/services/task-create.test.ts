import { afterEach, describe, expect, it, vi } from "vitest";
import {
  canCreateTask,
  createTask,
  newTaskDraft,
  taskCreatePayload,
  type TaskCreateAccess,
} from "./task-create";

afterEach(() => vi.restoreAllMocks());
const members = [
  {
    role: "OWNER",
    user: { id: "owner", name: "Owner", email: "owner@example.com" },
  },
  {
    role: "ADMIN",
    user: { id: "admin", name: "Admin", email: "admin@example.com" },
  },
  {
    role: "MEMBER",
    user: { id: "member", name: "Member", email: "member@example.com" },
  },
];
const owner: TaskCreateAccess = { role: "OWNER", userId: "owner", members };
const draft = () => ({ ...newTaskDraft(), title: "  Fix checkout  " });

describe("task creation", () => {
  it("uses the default priority/type and omits an empty description", () => {
    expect(taskCreatePayload("p1", draft(), owner)).toEqual({
      projectId: "p1",
      title: "Fix checkout",
      priority: "MEDIUM",
      type: "TASK",
      assigneeId: null,
    });
  });
  it.each(["OWNER", "ADMIN"] as const)(
    "lets %s assign a workspace user",
    (role) => {
      expect(
        taskCreatePayload(
          "p1",
          { ...draft(), assigneeId: "member" },
          {
            ...owner,
            role,
            userId: role.toLowerCase(),
          },
        ).assigneeId,
      ).toBe("member");
    },
  );
  it("posts actual field values and preserves description formatting", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(
        new Response(
          JSON.stringify({ success: true, data: { task: { id: "t1" } } }),
          { status: 201 },
        ),
      );
    await createTask(
      "p1",
      {
        ...draft(),
        description: "Details\n\n  - Steps",
        priority: "CRITICAL",
        type: "BUG",
        assigneeId: "member",
      },
      owner,
    );
    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:4000/api/tasks",
      expect.objectContaining({
        method: "POST",
        credentials: "include",
        body: JSON.stringify({
          projectId: "p1",
          title: "Fix checkout",
          description: "Details\n\n  - Steps",
          priority: "CRITICAL",
          type: "BUG",
          assigneeId: "member",
        }),
      }),
    );
  });
  it.each(["", "member"])(
    "omits member assignment (%s) to use API auto-self assignment",
    (assigneeId) => {
      const payload = taskCreatePayload(
        "p1",
        { ...draft(), assigneeId },
        { ...owner, role: "MEMBER", userId: "member" },
      );
      expect(payload).not.toHaveProperty("assigneeId");
    },
  );
  it("blocks a member from selecting someone else", () => {
    expect(() =>
      taskCreatePayload(
        "p1",
        { ...draft(), assigneeId: "owner" },
        { ...owner, role: "MEMBER", userId: "member" },
      ),
    ).toThrow("themselves");
  });
  it("blocks assignees outside the workspace", () => {
    expect(() =>
      taskCreatePayload("p1", { ...draft(), assigneeId: "outsider" }, owner),
    ).toThrow("workspace");
  });
  it.each([
    { ...owner, role: undefined },
    { ...owner, userId: null },
    { ...owner, members: [] },
    { ...owner, userId: "outsider" },
    { ...owner, role: "ADMIN" as const },
  ])("fails closed for missing or mismatched access: %j", (access) => {
    expect(canCreateTask(access)).toBe(false);
    expect(() => taskCreatePayload("p1", draft(), access)).toThrow(
      "permissions",
    );
  });
  it("rejects blank and oversized titles and oversized descriptions", () => {
    for (const title of ["   ", "t".repeat(201)]) {
      expect(() =>
        taskCreatePayload("p1", { ...draft(), title }, owner),
      ).toThrow("title");
    }
    expect(() =>
      taskCreatePayload(
        "p1",
        { ...draft(), description: "x".repeat(10001) },
        owner,
      ),
    ).toThrow("10,000");
    expect(
      taskCreatePayload(
        "p1",
        {
          ...draft(),
          title: "t".repeat(200),
          description: "x".repeat(10000),
          priority: "LOW",
          type: "STORY",
        },
        owner,
      ),
    ).toMatchObject({ priority: "LOW", type: "STORY" });
  });
  it("omits whitespace-only optional descriptions", () => {
    expect(
      taskCreatePayload("p1", { ...draft(), description: " \n " }, owner),
    ).not.toHaveProperty("description");
  });
  it("never sends a request before permissions are available", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");
    await expect(
      createTask("p1", draft(), { ...owner, role: undefined }),
    ).rejects.toThrow("permissions");
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("surfaces failed saves without mutating the draft", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({ success: false, error: { message: "Save refused" } }),
        { status: 403 },
      ),
    );
    const input = {
      ...draft(),
      description: "Keep these details",
      priority: "HIGH" as const,
    };
    const before = { ...input };
    await expect(createTask("p1", input, owner)).rejects.toThrow(
      "Save refused",
    );
    expect(input).toEqual(before);
  });
});
