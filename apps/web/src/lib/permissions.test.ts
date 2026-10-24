import { describe, expect, it } from "vitest";
import {
  canAssignTasks,
  canDeleteComment,
  canDeleteTask,
  canEditComment,
  canRemoveMember,
  roleFor,
} from "./permissions";

const members = [
  { user: { id: "owner" }, role: "OWNER" },
  { user: { id: "member" }, role: "MEMBER" },
];
describe("permissions", () => {
  it("allows task deletion only for loaded owner or admin membership", () => {
    expect(canDeleteTask("OWNER")).toBe(true);
    expect(canDeleteTask("ADMIN")).toBe(true);
    expect(canDeleteTask("MEMBER")).toBe(false);
    expect(canDeleteTask()).toBe(false);
    expect(canDeleteTask(roleFor(undefined, "owner"))).toBe(false);
    expect(canDeleteTask(roleFor(members, "outsider"))).toBe(false);
  });
  it("reserves admin removal for owners and never allows owner removal", () => {
    expect(canRemoveMember("OWNER", "ADMIN")).toBe(true);
    expect(canRemoveMember("OWNER", "MEMBER")).toBe(true);
    expect(canRemoveMember("ADMIN", "MEMBER")).toBe(true);
    expect(canRemoveMember("ADMIN", "ADMIN")).toBe(false);
    expect(canRemoveMember("OWNER", "OWNER")).toBe(false);
    expect(canRemoveMember("MEMBER", "MEMBER")).toBe(false);
    expect(canRemoveMember(undefined, "MEMBER")).toBe(false);
  });
  it("maps the actual workspace membership", () => {
    expect(roleFor(members, "member")).toBe("MEMBER");
    expect(canAssignTasks(roleFor(members, "member"))).toBe(false);
    expect(canAssignTasks(roleFor(members, "owner"))).toBe(true);
  });
  it("allows members to edit their own comments and moderators to delete", () => {
    expect(canEditComment("member", "member")).toBe(true);
    expect(canEditComment("member", "owner")).toBe(false);
    expect(canDeleteComment("member", "owner", "ADMIN")).toBe(true);
  });
});
