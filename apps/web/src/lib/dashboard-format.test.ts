import { describe, expect, it } from "vitest";
import {
  activityDescription,
  boundedPercent,
  dashboardDate,
  dashboardLabel,
  displayPercent,
  taskPercent,
} from "./dashboard-format";

describe("dashboard percentages", () => {
  it("uses complete totals, rounds for display, and handles empty or invalid totals", () => {
    expect(displayPercent(taskPercent(1, 3))).toBe("33%");
    expect(taskPercent(2, 4)).toBe(50);
    expect(taskPercent(0, 0)).toBe(0);
    expect(taskPercent(3, -1)).toBe(0);
    expect(boundedPercent(Infinity)).toBe(0);
    expect(boundedPercent(NaN)).toBe(0);
    expect(displayPercent(130)).toBe("100%");
    expect(displayPercent(-4)).toBe("0%");
  });
});

describe("dashboard activity formatting", () => {
  it("formats known structured transitions with friendly labels", () => {
    expect(
      activityDescription("STATUS_CHANGED", {
        from: "TODO",
        to: "IN_PROGRESS",
      }),
    ).toBe("changed the status from To do to In progress");
    expect(
      activityDescription("PRIORITY_CHANGED", { from: null, to: "HIGH" }),
    ).toBe("changed the priority to High");
    expect(
      activityDescription("COMMENT_ADDED", { commentId: "private-id" }),
    ).toBe("added a comment");
  });
  it("never renders arbitrary metadata, IDs, malformed values, or unknown actions", () => {
    for (const metadata of [
      null,
      undefined,
      3,
      "raw metadata",
      [],
      { from: {}, to: ["DONE"] },
      { to: "<script>bad</script>" },
    ]) {
      expect(activityDescription("STATUS_CHANGED", metadata)).toBe(
        "changed the status",
      );
    }
    expect(
      activityDescription("TASK_ASSIGNED", { from: "user-id", to: "other-id" }),
    ).toBe("changed the assignee");
    expect(
      activityDescription("RAW_UNKNOWN_ACTION", { secret: "hidden" }),
    ).toBe("updated the task");
    expect(activityDescription("STATUS_CHANGED", { to: "HIGH" })).toBe(
      "changed the status",
    );
  });
  it("handles missing dates and unknown enum values", () => {
    expect(dashboardDate(null)).toBe("Date unavailable");
    expect(dashboardDate("bad-date")).toBe("Date unavailable");
    expect(dashboardDate("2026-10-10T12:00:00Z")).not.toBe("Date unavailable");
    expect(dashboardLabel("IN_PROGRESS")).toBe("In progress");
    expect(dashboardLabel("arbitrary value")).toBe("Unknown");
    expect(dashboardLabel("__proto__")).toBe("Unknown");
    expect(activityDescription("constructor", null)).toBe("updated the task");
  });
});
