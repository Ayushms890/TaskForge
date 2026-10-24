export type WorkspaceRole = "OWNER" | "ADMIN" | "MEMBER";
export type Membership = { user: { id: string }; role: WorkspaceRole | string };

export function roleFor(
  members: Membership[] | undefined,
  userId?: string | null,
) {
  return members?.find((member) => member.user.id === userId)?.role as
    WorkspaceRole | undefined;
}
export function canManageWorkspace(role?: WorkspaceRole) {
  return role === "OWNER" || role === "ADMIN";
}
export function canDeleteWorkspace(role?: WorkspaceRole) {
  return role === "OWNER";
}
export function canRemoveMember(
  role: WorkspaceRole | undefined,
  targetRole: WorkspaceRole,
) {
  return (
    targetRole !== "OWNER" &&
    (role === "OWNER" || (role === "ADMIN" && targetRole === "MEMBER"))
  );
}
export function canAssignTasks(role?: WorkspaceRole) {
  return canManageWorkspace(role);
}
export function canDeleteTask(role?: WorkspaceRole) {
  return canManageWorkspace(role);
}
export function canManageSprints(role?: WorkspaceRole) {
  return canManageWorkspace(role);
}
export function canEditComment(
  commentAuthorId: string,
  userId?: string | null,
) {
  return commentAuthorId === userId;
}
export function canDeleteComment(
  commentAuthorId: string,
  userId?: string | null,
  role?: WorkspaceRole,
) {
  return canEditComment(commentAuthorId, userId) || canManageWorkspace(role);
}
