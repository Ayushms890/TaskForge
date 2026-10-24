import { apiRequest } from "../lib/api";
export type Status = "TODO" | "IN_PROGRESS" | "DONE";
export type BoardTask = {
  id: string;
  identifier: string;
  title: string;
  status: Status;
  priority: string;
  type: string;
  position: number;
  assigneeId?: string | null;
};
export type Board = {
  project: {
    name: string;
    key: string;
    workspaceId: string;
    description?: string | null;
  };
  columns: Record<Status, BoardTask[]>;
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};
export type BoardSprint = { id: string; name: string };
export async function fetchBoard(
  projectId: string,
  query: string,
  signal: AbortSignal,
) {
  const result = await apiRequest<Board>(
    `/projects/${projectId}/board?${query}`,
    { signal },
  );
  if (!result.success || !result.data) throw new Error("Could not load board.");
  return result.data;
}
export async function fetchBoardSprints(
  projectId: string,
  signal: AbortSignal,
) {
  const result = await apiRequest<{ sprints: BoardSprint[] }>(
    `/projects/${projectId}/sprints`,
    { signal },
  );
  if (!result.success || !result.data)
    throw new Error("Could not load sprint filters.");
  return result.data.sprints;
}
