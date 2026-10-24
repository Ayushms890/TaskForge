import { afterEach, expect, it, vi } from "vitest";
import { getNavigationContext } from "./navigation";

afterEach(() => vi.restoreAllMocks());

it("resolves task navigation from the actual task project and project workspace", async () => {
  const fetchMock = vi
    .spyOn(globalThis, "fetch")
    .mockResolvedValueOnce(
      new Response(
        JSON.stringify({ data: { task: { projectId: "real-project" } } }),
      ),
    )
    .mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          data: { project: { workspaceId: "real-workspace" } },
        }),
      ),
    );
  expect(await getNavigationContext("/tasks/task-123")).toEqual({
    projectId: "real-project",
    workspaceId: "real-workspace",
  });
  expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
    "http://localhost:4000/api/tasks/task-123",
    "http://localhost:4000/api/projects/real-project",
  ]);
});

it("does not invent a project destination when a task cannot be resolved", async () => {
  vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(JSON.stringify({ data: null })),
  );
  await expect(getNavigationContext("/tasks/missing")).rejects.toThrow(
    "Task navigation is unavailable.",
  );
});

it("uses the workspace route without fetching a placeholder resource", async () => {
  const fetchMock = vi.spyOn(globalThis, "fetch");
  expect(await getNavigationContext("/workspaces/w1")).toEqual({
    workspaceId: "w1",
  });
  expect(fetchMock).not.toHaveBeenCalled();
});
