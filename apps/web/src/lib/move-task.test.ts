import { describe, expect, it } from "vitest";
import { moveTask } from "./move-task";

const board = {
  TODO: [
    { id: "a", status: "TODO" as const, position: 0 },
    { id: "b", status: "TODO" as const, position: 1 },
  ],
  IN_PROGRESS: [],
  DONE: [],
};
describe("moveTask", () => {
  it("moves upward within a column and retains task metadata", () => {
    const input = {
      ...board,
      TODO: [
        ...board.TODO,
        { id: "c", status: "TODO" as const, position: 2, title: "Keep me" },
      ],
    };
    const before = structuredClone(input);
    const next = moveTask(input, "c", "TODO", 0);
    expect(next.TODO.map(({ id, position }) => [id, position])).toEqual([
      ["c", 0],
      ["a", 1],
      ["b", 2],
    ]);
    expect(next.TODO[0]).toMatchObject({ title: "Keep me" });
    expect(input).toEqual(before);
  });
  it("inserts into an occupied column and normalizes both columns", () => {
    const input = {
      ...board,
      DONE: [{ id: "c", status: "DONE" as const, position: 0 }],
    };
    const before = structuredClone(input);
    const next = moveTask(input, "a", "DONE", 0);
    expect(
      next.DONE.map(({ id, status, position }) => [id, status, position]),
    ).toEqual([
      ["a", "DONE", 0],
      ["c", "DONE", 1],
    ]);
    expect(next.TODO).toEqual([{ id: "b", status: "TODO", position: 0 }]);
    expect(input).toEqual(before);
  });
  it("clamps drops past the end after removing the source", () => {
    expect(
      moveTask(board, "a", "TODO", 99).TODO.map((task) => task.id),
    ).toEqual(["b", "a"]);
    expect(
      moveTask(board, "b", "TODO", -1).TODO.map((task) => task.id),
    ).toEqual(["b", "a"]);
  });
  it("ignores a task that no longer exists", () => {
    expect(moveTask(board, "missing", "DONE", 0)).toBe(board);
  });
  it("moves down within a column without mutating input", () => {
    const next = moveTask(board, "a", "TODO", 1);
    expect(next.TODO.map((task) => task.id)).toEqual(["b", "a"]);
    expect(board.TODO[0]!.id).toBe("a");
  });
  it("supports a pre-removal target index when dropping downward", () => {
    const input = {
      ...board,
      TODO: [...board.TODO, { id: "c", status: "TODO" as const, position: 2 }],
    };
    const sourceIndex = input.TODO.findIndex((task) => task.id === "a");
    const targetIndex = input.TODO.findIndex((task) => task.id === "c");
    const adjustedIndex =
      sourceIndex < targetIndex ? targetIndex - 1 : targetIndex;
    expect(
      moveTask(input, "a", "TODO", adjustedIndex).TODO.map((task) => task.id),
    ).toEqual(["b", "a", "c"]);
  });
  it("moves into an empty column and normalizes positions", () => {
    const next = moveTask(board, "b", "DONE", 0);
    expect(next.DONE[0]).toMatchObject({
      id: "b",
      status: "DONE",
      position: 0,
    });
    expect(next.TODO[0]).toMatchObject({ id: "a", position: 0 });
  });
});
