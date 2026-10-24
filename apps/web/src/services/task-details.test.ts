import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createComment,
  deleteTask,
  getTaskComments,
  updateTaskAssignee,
} from "./task-details";
import { logout } from "../lib/api";

afterEach(() => vi.restoreAllMocks());

describe("task detail service", () => {
  it("deletes a task with credentials and accepts the null data contract", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ success: true, data: null }), {
        status: 200,
      }),
    );
    expect(await deleteTask("t1")).toEqual({ success: true, data: null });
    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:4000/api/tasks/t1",
      expect.objectContaining({ method: "DELETE", credentials: "include" }),
    );
  });

  it.each([403, 404, 500])(
    "surfaces deletion errors (%s) instead of succeeding",
    async (status) => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(
          JSON.stringify({
            success: false,
            error: { message: "Deletion refused" },
          }),
          { status },
        ),
      );
      await expect(deleteTask("t1")).rejects.toThrow("Deletion refused");
    },
  );
  it("posts comment content through the API contract", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(
        new Response(
          JSON.stringify({ success: true, data: { comment: { id: "c1" } } }),
          { status: 200 },
        ),
      );
    await createComment("t1", "A plain text comment");
    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:4000/api/tasks/t1/comments",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ content: "A plain text comment" }),
      }),
    );
  });

  it("keeps malformed or missing pagination safe for the UI", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ success: true, data: { comments: [] } }), {
        status: 200,
      }),
    );
    const result = await getTaskComments("t1", 2);
    expect(result.comments).toEqual([]);
    expect(result.pagination).toEqual({
      page: 2,
      limit: 20,
      total: 0,
      totalPages: 0,
    });
  });

  it("uses the logout endpoint and credentials", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ success: true, data: null }), {
        status: 200,
      }),
    );
    await logout();
    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:4000/api/auth/logout",
      expect.objectContaining({ method: "POST", credentials: "include" }),
    );
  });

  it("sends only the selected assignee, including unassignment", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ success: true, data: { task: {} } }), {
        status: 200,
      }),
    );
    await updateTaskAssignee("t1", null);
    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:4000/api/tasks/t1",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ assigneeId: null }),
      }),
    );
  });
});
