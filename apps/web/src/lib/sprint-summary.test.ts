import { describe, expect, it } from "vitest";
import { completeTaskCounts } from "./sprint-summary";

describe("sprint assignment totals", () => {
  const tasks = [
    { id: "one", sprintId: "sprint" },
    { id: "two", sprintId: null },
  ];
  it("counts sprint and backlog assignments only for a proven complete response", () => {
    const counts = completeTaskCounts(tasks, {
      page: 1,
      total: 2,
      totalPages: 1,
    });
    expect(counts?.get("sprint")).toBe(1);
    expect(counts?.get("")).toBe(1);
    expect(
      completeTaskCounts([], { page: 1, total: 0, totalPages: 0 })?.size,
    ).toBe(0);
  });
  it("withholds misleading totals for partial, unknown, or duplicated results", () => {
    expect(completeTaskCounts(tasks)).toBeNull();
    expect(
      completeTaskCounts(tasks, { page: 1, total: 120, totalPages: 2 }),
    ).toBeNull();
    expect(
      completeTaskCounts(tasks, { page: 2, total: 2, totalPages: 1 }),
    ).toBeNull();
    expect(
      completeTaskCounts(tasks, { page: 1, total: 3, totalPages: 1 }),
    ).toBeNull();
    expect(
      completeTaskCounts([{ id: "one" }, { id: "one" }], {
        page: 1,
        total: 2,
        totalPages: 1,
      }),
    ).toBeNull();
  });
});
