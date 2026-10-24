import { describe, expect, it } from "vitest";
import { canConfirmWorkspaceDeletion } from "./workspace-deletion";

const confirmation = {
  role: "OWNER" as const,
  workspaceId: "workspace-1",
  loadedWorkspaceId: "workspace-1",
  name: "Launch Team",
  confirmation: "Launch Team",
  busy: false,
};

describe("workspace deletion confirmation", () => {
  it("allows an idle owner with an exact name", () => {
    expect(canConfirmWorkspaceDeletion(confirmation)).toBe(true);
  });

  it.each(["ADMIN", "MEMBER", undefined] as const)(
    "rejects role %s",
    (role) => {
      expect(canConfirmWorkspaceDeletion({ ...confirmation, role })).toBe(
        false,
      );
    },
  );

  it.each(["", "launch team", " Launch Team", "Launch Team ", "Launch Team\n"])(
    "rejects non-exact confirmation %j",
    (name) => {
      expect(
        canConfirmWorkspaceDeletion({ ...confirmation, confirmation: name }),
      ).toBe(false);
    },
  );

  it("requires literal whitespace when it belongs to the workspace name", () => {
    expect(
      canConfirmWorkspaceDeletion({
        ...confirmation,
        name: " Team ",
        confirmation: " Team ",
      }),
    ).toBe(true);
    expect(
      canConfirmWorkspaceDeletion({
        ...confirmation,
        name: " Team ",
        confirmation: "Team",
      }),
    ).toBe(false);
  });

  it("blocks pending membership mutations and deletion", () => {
    expect(canConfirmWorkspaceDeletion({ ...confirmation, busy: true })).toBe(
      false,
    );
  });

  it("rejects stale ownership from another route and missing workspace data", () => {
    expect(
      canConfirmWorkspaceDeletion({
        ...confirmation,
        workspaceId: "workspace-2",
      }),
    ).toBe(false);
    expect(
      canConfirmWorkspaceDeletion({
        ...confirmation,
        loadedWorkspaceId: undefined,
      }),
    ).toBe(false);
    expect(
      canConfirmWorkspaceDeletion({ ...confirmation, name: undefined }),
    ).toBe(false);
  });
});
