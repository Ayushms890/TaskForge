import { beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";

const repository = vi.hoisted(() => {
  process.env.NODE_ENV = "test";
  process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/test";
  process.env.JWT_SECRET = "test-only-secret-with-at-least-32-characters";
  process.env.JWT_ISSUER = "taskforge-api";
  process.env.JWT_AUDIENCE = "taskforge-web";
  process.env.WEB_ORIGIN = "http://localhost:3000";
  return {
    createWithOwner: vi.fn(),
    listForUser: vi.fn(),
    findForUser: vi.fn(),
    findMember: vi.fn(),
    findUserByEmail: vi.fn(),
    addMember: vi.fn(),
    findMemberByEmail: vi.fn(),
    removeMember: vi.fn(),
    delete: vi.fn(),
  };
});
vi.mock(
  "../src/repositories/workspace.repository.js",
  async (importOriginal) => ({
    ...(await importOriginal<
      typeof import("../src/repositories/workspace.repository.js")
    >()),
    workspaceRepository: repository,
  }),
);

import { app } from "../src/app.js";
import { env } from "../src/config/env.js";

const member = (userId: string, role: "OWNER" | "ADMIN" | "MEMBER") => ({
  id: `membership-${userId}`,
  role,
  createdAt: new Date(),
  user: {
    id: userId,
    name: userId,
    email: `${userId}@example.com`,
    avatarUrl: null,
  },
});
const workspace = (members = [member("owner", "OWNER")]) => ({
  id: "workspace-1",
  name: "Acme",
  slug: "acme",
  createdAt: new Date(),
  updatedAt: new Date(),
  members,
});
const token = (id: string) =>
  jwt.sign({ email: `${id}@example.com` }, env.JWT_SECRET, {
    algorithm: "HS256",
    subject: id,
    issuer: env.JWT_ISSUER,
    audience: env.JWT_AUDIENCE,
    expiresIn: "15m",
  });
const auth = (id: string) => ({ Authorization: `Bearer ${token(id)}` });

beforeEach(() => {
  vi.clearAllMocks();
  repository.createWithOwner.mockResolvedValue(workspace());
  repository.listForUser.mockResolvedValue([]);
  repository.findForUser.mockResolvedValue(workspace());
  repository.findMember.mockResolvedValue(member("owner", "OWNER"));
  repository.findUserByEmail.mockResolvedValue({
    id: "member",
    name: "Member",
    email: "member@example.com",
  });
  repository.addMember.mockResolvedValue(member("member", "MEMBER"));
  repository.removeMember.mockResolvedValue(undefined);
  repository.delete.mockResolvedValue(undefined);
});

describe("workspace HTTP flow", () => {
  it("requires authentication and creates an owner transactionally", async () => {
    await request(app)
      .post("/api/workspaces")
      .send({ name: "Acme", slug: "Acme" })
      .expect(401);
    const result = await request(app)
      .post("/api/workspaces")
      .set(auth("owner"))
      .send({ name: " Acme ", slug: " Acme " })
      .expect(201);
    expect(result.body.data.workspace.members[0].role).toBe("OWNER");
    expect(repository.createWithOwner).toHaveBeenCalledWith({
      name: "Acme",
      slug: "acme",
      userId: "owner",
    });
  });

  it("isolates lists and permits member reads", async () => {
    await request(app).get("/api/workspaces").set(auth("member")).expect(200);
    expect(repository.listForUser).toHaveBeenCalledWith("member");
    await request(app)
      .get("/api/workspaces/workspace-1/members")
      .set(auth("member"))
      .expect(200);
    expect(repository.findForUser).toHaveBeenCalledWith(
      "workspace-1",
      "member",
    );
  });

  it("enforces owner/admin/member management permissions", async () => {
    repository.findMember
      .mockResolvedValueOnce(member("owner", "OWNER"))
      .mockResolvedValueOnce(null);
    await request(app)
      .post("/api/workspaces/workspace-1/members")
      .set(auth("owner"))
      .send({ email: "member@example.com" })
      .expect(200);
    repository.findMember.mockResolvedValue(member("admin", "ADMIN"));
    await request(app)
      .post("/api/workspaces/workspace-1/members")
      .set(auth("admin"))
      .send({ email: "member@example.com", role: "ADMIN" })
      .expect(403);
    repository.findMember.mockResolvedValue(member("member", "MEMBER"));
    await request(app)
      .delete("/api/workspaces/workspace-1/members/other")
      .set(auth("member"))
      .expect(403);
    repository.findMember.mockResolvedValue(member("admin", "ADMIN"));
    repository.findMember
      .mockResolvedValueOnce(member("admin", "ADMIN"))
      .mockResolvedValueOnce(member("owner", "OWNER"));
    await request(app)
      .delete("/api/workspaces/workspace-1/members/owner")
      .set(auth("admin"))
      .expect(403);
  });

  it("deletes only for the owner and hides workspaces from outsiders", async () => {
    repository.findMember.mockResolvedValue(member("admin", "ADMIN"));
    await request(app)
      .delete("/api/workspaces/workspace-1")
      .set(auth("admin"))
      .expect(403);

    repository.findMember.mockResolvedValue(member("member", "MEMBER"));
    await request(app)
      .delete("/api/workspaces/workspace-1")
      .set(auth("member"))
      .expect(403);

    repository.findMember.mockResolvedValue(null);
    await request(app)
      .delete("/api/workspaces/workspace-1")
      .set(auth("outsider"))
      .expect(404);

    repository.findMember.mockResolvedValue(member("owner", "OWNER"));
    await request(app)
      .delete("/api/workspaces/workspace-1")
      .set(auth("owner"))
      .expect(200)
      .expect(({ body }) => {
        expect(body).toMatchObject({ success: true, data: null });
      });
    expect(repository.delete).toHaveBeenCalledWith("workspace-1");
  });
});
