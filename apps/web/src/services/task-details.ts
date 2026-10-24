import { apiRequest } from "../lib/api";

export type Task = {
  id: string;
  projectId: string;
  identifier: string;
  title: string;
  description?: string | null;
  status: string;
  priority: string;
  type: string;
  assigneeId?: string | null;
  reporterId?: string | null;
  sprintId?: string | null;
  createdAt: string;
  updatedAt: string;
};
export type User = { id: string; name: string };
export type Comment = {
  id: string;
  taskId: string;
  authorId: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  author?: User | null;
};
export type Activity = {
  id: string;
  taskId: string;
  userId: string;
  action: string;
  metadata: unknown;
  createdAt: string;
  user?: User | null;
};
export type Pagination = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};
export type Member = {
  id: string;
  role: string;
  user: User & { email?: string };
};

export async function getTaskDetails(taskId: string, signal?: AbortSignal) {
  const [task, me] = await Promise.all([
    apiRequest<{ task: Task }>(`/tasks/${taskId}`, signal ? { signal } : {}),
    apiRequest<{ user: User }>("/auth/me", signal ? { signal } : {}),
  ]);
  return { task: task.data?.task ?? null, currentUser: me.data?.user ?? null };
}

export async function getTaskPeople(task: Task, signal?: AbortSignal) {
  const project = await apiRequest<{ project: { workspaceId: string } }>(
    `/projects/${task.projectId}`,
    signal ? { signal } : {},
  );
  const workspaceId = project.data?.project?.workspaceId;
  if (!workspaceId) return [];
  const result = await apiRequest<{ members: Member[] }>(
    `/workspaces/${workspaceId}/members`,
    signal ? { signal } : {},
  );
  return result.data?.members ?? [];
}

export async function getTaskComments(
  taskId: string,
  page: number,
  signal?: AbortSignal,
) {
  const result = await apiRequest<{
    comments: Comment[];
    pagination: Pagination;
  }>(
    `/tasks/${taskId}/comments?page=${page}&limit=20`,
    signal ? { signal } : {},
  );
  return {
    comments: result.data?.comments ?? [],
    pagination: result.data?.pagination ?? {
      page,
      limit: 20,
      total: 0,
      totalPages: 0,
    },
  };
}

export async function getTaskActivities(
  taskId: string,
  page: number,
  signal?: AbortSignal,
) {
  const result = await apiRequest<{
    activities: Activity[];
    pagination: Pagination;
  }>(
    `/tasks/${taskId}/activities?page=${page}&limit=20`,
    signal ? { signal } : {},
  );
  return {
    activities: result.data?.activities ?? [],
    pagination: result.data?.pagination ?? {
      page,
      limit: 20,
      total: 0,
      totalPages: 0,
    },
  };
}

export function createComment(taskId: string, content: string) {
  return apiRequest<{ comment: Comment }>(`/tasks/${taskId}/comments`, {
    method: "POST",
    body: JSON.stringify({ content }),
  });
}
export function updateComment(commentId: string, content: string) {
  return apiRequest<{ comment: Comment }>(`/comments/${commentId}`, {
    method: "PATCH",
    body: JSON.stringify({ content }),
  });
}
export function deleteComment(commentId: string) {
  return apiRequest<null>(`/comments/${commentId}`, { method: "DELETE" });
}

export function deleteTask(taskId: string) {
  return apiRequest<null>(`/tasks/${taskId}`, { method: "DELETE" });
}

export function updateTaskAssignee(taskId: string, assigneeId: string | null) {
  return apiRequest<{ task: Task }>(`/tasks/${taskId}`, {
    method: "PATCH",
    body: JSON.stringify({ assigneeId }),
  });
}
