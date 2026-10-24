import { apiRequest } from "../lib/api";

export type Dashboard = {
  project: {
    id: string;
    workspaceId: string;
    name: string;
    key: string;
    description: string | null;
  };
  summary: { total: number; todo: number; inProgress: number; done: number };
  activeSprint: null | {
    id: string;
    name: string;
    goal: string | null;
    startDate: string;
    endDate: string;
    totalTasks: number;
    doneTasks: number;
    progressPercent: number;
  };
  recentTasks: {
    id: string;
    identifier: string;
    title: string;
    status: string;
    priority: string;
    type: string;
    assignee: null | { id: string; name: string };
    updatedAt: string;
  }[];
  recentActivity: {
    id: string;
    action: string;
    metadata: unknown;
    createdAt: string;
    user: { id: string; name: string };
    task: { id: string; identifier: string; title: string };
  }[];
};

export async function getDashboard(
  projectId: string,
  signal?: AbortSignal,
): Promise<Dashboard> {
  const result = await apiRequest<Dashboard>(
    `/projects/${encodeURIComponent(projectId)}/dashboard`,
    signal ? { signal } : {},
  );
  if (!result.data)
    throw new Error("Dashboard data is unavailable. Please try again.");
  return result.data;
}
