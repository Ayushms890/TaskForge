const labels: Record<string, string> = {
  TODO: "To do",
  IN_PROGRESS: "In progress",
  DONE: "Done",
  LOW: "Low",
  MEDIUM: "Medium",
  HIGH: "High",
  URGENT: "Urgent",
  TASK: "Task",
  BUG: "Bug",
  STORY: "Story",
  EPIC: "Epic",
};

export function dashboardLabel(value: string): string {
  return Object.hasOwn(labels, value) ? labels[value]! : "Unknown";
}

export function boundedPercent(value: number): number {
  return Number.isFinite(value) ? Math.min(100, Math.max(0, value)) : 0;
}

export function taskPercent(count: number, total: number): number {
  return total > 0 ? boundedPercent((count / total) * 100) : 0;
}

export function displayPercent(value: number): string {
  return `${Math.round(boundedPercent(value))}%`;
}

export function dashboardDate(value: string | null | undefined): string {
  if (!value || !Number.isFinite(Date.parse(value))) return "Date unavailable";
  return new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

// Only known enum transitions are displayed. IDs, arbitrary strings, and nested
// metadata are never serialized into the timeline.
export function activityDescription(action: string, metadata: unknown): string {
  const descriptions: Record<string, string> = {
    TASK_CREATED: "created the task",
    TASK_UPDATED: "updated the task",
    TASK_ASSIGNED: "changed the assignee",
    TASK_UNASSIGNED: "removed the assignee",
    STATUS_CHANGED: "changed the status",
    PRIORITY_CHANGED: "changed the priority",
    SPRINT_CHANGED: "changed the sprint",
    COMMENT_ADDED: "added a comment",
    COMMENT_UPDATED: "edited a comment",
    COMMENT_DELETED: "deleted a comment",
  };
  const description = Object.hasOwn(descriptions, action)
    ? descriptions[action]!
    : "updated the task";
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata))
    return description;
  const { from, to } = metadata as Record<string, unknown>;
  const allowed =
    action === "STATUS_CHANGED"
      ? ["TODO", "IN_PROGRESS", "DONE"]
      : action === "PRIORITY_CHANGED"
        ? ["LOW", "MEDIUM", "HIGH", "URGENT"]
        : [];
  if (typeof to !== "string" || !allowed.includes(to)) return description;
  return typeof from === "string" && allowed.includes(from)
    ? `${description} from ${dashboardLabel(from)} to ${dashboardLabel(to)}`
    : `${description} to ${dashboardLabel(to)}`;
}
