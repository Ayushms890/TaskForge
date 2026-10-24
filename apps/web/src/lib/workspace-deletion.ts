import { canDeleteWorkspace, type WorkspaceRole } from "./permissions";

export function canConfirmWorkspaceDeletion({
  role,
  workspaceId,
  loadedWorkspaceId,
  name,
  confirmation,
  busy,
}: {
  role: WorkspaceRole | undefined;
  workspaceId: string;
  loadedWorkspaceId: string | undefined;
  name: string | undefined;
  confirmation: string;
  busy: boolean;
}) {
  return (
    canDeleteWorkspace(role) &&
    loadedWorkspaceId === workspaceId &&
    name !== undefined &&
    confirmation === name &&
    !busy
  );
}
