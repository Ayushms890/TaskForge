import { beforeEach, describe, expect, it, vi } from "vitest";

const prisma = vi.hoisted(() => ({
  $transaction: vi.fn(),
}));

vi.mock("../src/lib/prisma.js", () => ({ prisma }));

import { commentRepository } from "../src/repositories/comment.repository.js";

const comment = { id: "c1", taskId: "t1", authorId: "u1", content: "text" };

beforeEach(() => vi.clearAllMocks());

describe("comment repository activity transactions", () => {
  it.each([
    ["create", "COMMENT_ADDED", "u1", "text"],
    ["update", "COMMENT_UPDATED", "u2", "updated"],
    ["remove", "COMMENT_DELETED", "u2", undefined],
  ] as const)(
    "records %s activity with action and comment metadata",
    async (operation, action, actorId, content) => {
      const tx = {
        comment: {
          create: vi.fn().mockResolvedValue(comment),
          update: vi.fn().mockResolvedValue({ ...comment, taskId: "t1" }),
          delete: vi.fn().mockResolvedValue(comment),
        },
        activity: { create: vi.fn().mockResolvedValue({}) },
      };
      prisma.$transaction.mockImplementation(
        async (callback: (transaction: typeof tx) => unknown) => callback(tx),
      );

      if (operation === "create")
        await commentRepository.create("t1", actorId, content);
      if (operation === "update")
        await commentRepository.update("c1", content, actorId);
      if (operation === "remove") await commentRepository.remove("c1", actorId);

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(tx.activity.create).toHaveBeenCalledWith({
        data: {
          taskId: "t1",
          userId: actorId,
          action,
          metadata: { commentId: "c1" },
        },
      });
    },
  );
});
