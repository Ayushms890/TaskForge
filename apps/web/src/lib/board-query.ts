export const boardStatuses = ["TODO", "IN_PROGRESS", "DONE"] as const;
export type BoardQuery = {
  q: string;
  status: string;
  priority: string;
  type: string;
  assigneeId: string;
  sprintId: string;
  page: number;
  limit: number;
};
export const emptyBoardQuery: BoardQuery = {
  q: "",
  status: "",
  priority: "",
  type: "",
  assigneeId: "",
  sprintId: "",
  page: 1,
  limit: 20,
};
export function readBoardQuery(params: URLSearchParams): BoardQuery {
  const integer = (key: string, fallback: number, max: number) => {
    const value = Number(params.get(key));
    return Number.isSafeInteger(value) && value > 0
      ? Math.min(value, max)
      : fallback;
  };
  const choice = (key: string, values: readonly string[]) => {
    const value = params.get(key) ?? "";
    return values.includes(value) ? value : "";
  };
  return {
    q: (params.get("q") ?? "").slice(0, 200),
    status: choice("status", boardStatuses),
    priority: choice("priority", ["LOW", "MEDIUM", "HIGH", "CRITICAL"]),
    type: choice("type", ["TASK", "BUG", "STORY"]),
    assigneeId: params.get("assigneeId") ?? "",
    sprintId: params.get("sprintId") ?? "",
    page: integer("page", 1, Number.MAX_SAFE_INTEGER),
    limit: integer("limit", 20, 100),
  };
}
export function writeBoardQuery(query: BoardQuery, existing = ""): string {
  const params = new URLSearchParams(existing);
  for (const [key, value] of Object.entries(query)) {
    if (value === "") params.delete(key);
    else params.set(key, String(value));
  }
  return params.toString();
}
export function hasBoardFilters(query: BoardQuery) {
  return !!(
    query.q.trim() ||
    query.status ||
    query.priority ||
    query.type ||
    query.assigneeId ||
    query.sprintId
  );
}
export function changeBoardQuery(
  query: BoardQuery,
  patch: Partial<BoardQuery>,
): BoardQuery {
  return { ...query, ...patch, page: patch.page ?? 1 };
}
export function boardDragRestricted(
  query: BoardQuery,
  total: number,
  loaded: number,
) {
  return hasBoardFilters(query) || total > loaded;
}
