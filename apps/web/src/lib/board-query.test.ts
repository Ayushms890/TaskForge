import { describe, expect, it } from "vitest";
import {
  boardDragRestricted,
  changeBoardQuery,
  emptyBoardQuery,
  readBoardQuery,
  writeBoardQuery,
} from "./board-query";

describe("board URL query", () => {
  it("round trips search, filters, special choices and pagination", () => {
    const query = {
      ...emptyBoardQuery,
      q: "key & description",
      status: "TODO",
      priority: "HIGH",
      type: "BUG",
      assigneeId: "unassigned",
      sprintId: "backlog",
      page: 3,
      limit: 2,
    };
    expect(readBoardQuery(new URLSearchParams(writeBoardQuery(query)))).toEqual(
      query,
    );
  });
  it("bounds search and page size and rejects invalid pagination and enums", () => {
    const query = readBoardQuery(
      new URLSearchParams({
        q: "x".repeat(201),
        page: "-3",
        limit: "1000",
        status: "unknown",
        priority: "bad",
        type: "bad",
      }),
    );
    expect(query).toEqual({
      ...emptyBoardQuery,
      q: "x".repeat(200),
      limit: 100,
    });
    expect(readBoardQuery(new URLSearchParams("page=1.5&limit=NaN"))).toEqual(
      emptyBoardQuery,
    );
  });
  it("resets page on filters, search, limit and clear; retains explicit paging", () => {
    const query = { ...emptyBoardQuery, q: "bug", page: 8, limit: 2 };
    expect(changeBoardQuery(query, { status: "DONE" }).page).toBe(1);
    expect(changeBoardQuery(query, { q: "new" }).page).toBe(1);
    expect(changeBoardQuery(query, { limit: 50 }).page).toBe(1);
    expect(changeBoardQuery(query, { page: 2 }).page).toBe(2);
    expect(
      writeBoardQuery(
        { ...emptyBoardQuery, limit: 2 },
        "q=bug&page=8&other=kept",
      ),
    ).toBe("page=1&other=kept&limit=2");
  });
  it("only allows dragging complete unfiltered boards", () => {
    expect(boardDragRestricted(emptyBoardQuery, 3, 3)).toBe(false);
    expect(boardDragRestricted(emptyBoardQuery, 3, 2)).toBe(true);
    for (const key of [
      "q",
      "status",
      "priority",
      "type",
      "assigneeId",
      "sprintId",
    ])
      expect(
        boardDragRestricted({ ...emptyBoardQuery, [key]: "selected" }, 1, 1),
      ).toBe(true);
  });
});
