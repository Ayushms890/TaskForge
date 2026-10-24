import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchBoard, fetchBoardSprints } from "./board";

afterEach(() => vi.unstubAllGlobals());
describe("board service", () => {
  it("sends the real server query and abort signal without filtering its response", async () => {
    const board = {
      project: { name: "Demo" },
      columns: { TODO: [{ id: "server-selected" }], IN_PROGRESS: [], DONE: [] },
      pagination: { page: 2, limit: 2, total: 3, totalPages: 2 },
    };
    const fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: board }),
    });
    vi.stubGlobal("fetch", fetch);
    const signal = new AbortController().signal;
    expect(
      await fetchBoard(
        "project",
        "q=needle&assigneeId=unassigned&sprintId=backlog&page=2&limit=2",
        signal,
      ),
    ).toBe(board);
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining(
        "/projects/project/board?q=needle&assigneeId=unassigned&sprintId=backlog&page=2&limit=2",
      ),
      expect.objectContaining({ signal, credentials: "include" }),
    );
  });
  it("loads sprint options and exposes API failures rather than empty results", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            success: true,
            data: { sprints: [{ id: "s1", name: "Iteration" }] },
          }),
        })
        .mockResolvedValueOnce({
          ok: false,
          json: async () => ({ error: { message: "Unavailable" } }),
        }),
    );
    const signal = new AbortController().signal;
    expect(await fetchBoardSprints("project", signal)).toEqual([
      { id: "s1", name: "Iteration" },
    ]);
    await expect(
      fetchBoard("project", "page=1&limit=20", signal),
    ).rejects.toThrow("Unavailable");
  });
});
