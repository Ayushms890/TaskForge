import { apiRequest } from "../lib/api";
import { canAssignTasks, type WorkspaceRole } from "../lib/permissions";

export type TaskCreateMember = {
  role: string;
  user: { id: string; name: string; email: string };
};
export const taskPriorities = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;
export const taskTypes = ["TASK", "BUG", "STORY"] as const;
export type TaskDraft = {
  title: string;
  description: string;
  priority: (typeof taskPriorities)[number];
  type: (typeof taskTypes)[number];
  assigneeId: string;
};
export type TaskCreateAccess = {
  role?: WorkspaceRole | undefined;
  userId: string | null;
  members: TaskCreateMember[];
};
export function newTaskDraft(): TaskDraft {
  return {
    title: "",
    description: "",
    priority: "MEDIUM",
    type: "TASK",
    assigneeId: "",
  };
}
export function canCreateTask({ role, userId, members }: TaskCreateAccess) {
  return (
    !!userId &&
    (role === "OWNER" || role === "ADMIN" || role === "MEMBER") &&
    members.some((member) => member.user.id === userId && member.role === role)
  );
}
export function taskCreatePayload(
  projectId: string,
  draft: TaskDraft,
  access: TaskCreateAccess,
) {
  if (!canCreateTask(access))
    throw new Error(
      "Workspace permissions are not available. Reload and try again.",
    );
  const title = draft.title.trim();
  if (!title || draft.title.length > 200)
    throw new Error("Enter a title of 1–200 characters.");
  if (draft.description.length > 10000)
    throw new Error("Description must be 10,000 characters or fewer.");
  if (
    !taskPriorities.includes(draft.priority) ||
    !taskTypes.includes(draft.type)
  ) {
    throw new Error("Choose a valid priority and task type.");
  }
  if (
    draft.assigneeId &&
    !access.members.some((member) => member.user.id === draft.assigneeId)
  ) {
    throw new Error("Choose an assignee from this workspace.");
  }
  if (
    !canAssignTasks(access.role) &&
    draft.assigneeId &&
    draft.assigneeId !== access.userId
  ) {
    throw new Error("Members can only create tasks assigned to themselves.");
  }
  return {
    projectId,
    title,
    ...(draft.description.trim() ? { description: draft.description } : {}),
    priority: draft.priority,
    type: draft.type,
    ...(canAssignTasks(access.role)
      ? { assigneeId: draft.assigneeId || null }
      : {}),
  };
}
export async function createTask(
  projectId: string,
  draft: TaskDraft,
  access: TaskCreateAccess,
) {
  const result = await apiRequest("/tasks", {
    method: "POST",
    body: JSON.stringify(taskCreatePayload(projectId, draft, access)),
  });
  if (!result.success)
    throw new Error(result.error?.message ?? "Could not create task.");
  return result;
}
