import { afterEach, expect, it, vi } from "vitest";
import { getDashboard } from "./dashboard";

afterEach(() => vi.restoreAllMocks());

it("reads the dedicated aggregate endpoint and preserves null sprint and real totals", async () => {
  const data = {
    project: {
      id: "p1",
      workspaceId: "w1",
      name: "Project",
      key: "PR",
      description: null,
    },
    summary: { total: 245, todo: 200, inProgress: 40, done: 5 },
    activeSprint: null,
    recentTasks: [],
    recentActivity: [],
  };
  const fetchMock = vi
    .spyOn(globalThis, "fetch")
    .mockResolvedValue(new Response(JSON.stringify({ success: true, data })));
  const controller = new AbortController();
  expect(await getDashboard("p1", controller.signal)).toEqual(data);
  expect(fetchMock).toHaveBeenCalledExactlyOnceWith(
    "http://localhost:4000/api/projects/p1/dashboard",
    expect.objectContaining({
      credentials: "include",
      signal: controller.signal,
    }),
  );
});

it("surfaces API errors instead of inventing empty dashboard data", async () => {
  vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(JSON.stringify({ error: { message: "Access denied" } }), {
      status: 403,
    }),
  );
  await expect(getDashboard("p1")).rejects.toThrow("Access denied");
});

it("rejects missing response data and propagates cancellation", async () => {
  const fetchMock = vi
    .spyOn(globalThis, "fetch")
    .mockResolvedValueOnce(new Response(JSON.stringify({ success: true })));
  await expect(getDashboard("p1")).rejects.toThrow(
    "Dashboard data is unavailable",
  );
  fetchMock.mockRejectedValueOnce(new DOMException("Aborted", "AbortError"));
  await expect(getDashboard("p1")).rejects.toMatchObject({
    name: "AbortError",
  });
});
