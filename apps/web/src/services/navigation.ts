import { apiRequest } from "../lib/api";

export type NavigationContext = { projectId?: string; workspaceId?: string };

export async function getNavigationContext(
  pathname: string,
  signal?: AbortSignal,
): Promise<NavigationContext> {
  const workspaceId = pathname.match(/^\/workspaces\/([^/]+)(?:\/|$)/)?.[1];
  let projectId = pathname.match(/^\/projects\/([^/]+)(?:\/|$)/)?.[1];
  const taskId = pathname.match(/^\/tasks\/([^/]+)(?:\/|$)/)?.[1];
  if (taskId) {
    const result = await apiRequest<{ task: { projectId: string } }>(
      `/tasks/${taskId}`,
      signal ? { signal } : {},
    );
    projectId = result.data?.task?.projectId;
    if (!projectId) throw new Error("Task navigation is unavailable.");
  }
  if (!projectId) return workspaceId ? { workspaceId } : {};
  const result = await apiRequest<{ project: { workspaceId: string } }>(
    `/projects/${projectId}`,
    signal ? { signal } : {},
  );
  const parentId = result.data?.project?.workspaceId;
  if (!parentId) throw new Error("Project navigation is unavailable.");
  return { projectId, workspaceId: parentId };
}
