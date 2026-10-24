import type { Prisma } from "@prisma/client";
import type { TaskFilters } from "./task.repository.js";

// Keep every search alternative inside the project-scoped AND filters.
export const taskWhere = (filters: TaskFilters): Prisma.TaskWhereInput => {
  const { projectId, status, priority, type, assigneeId, sprintId } = filters;
  const where: Prisma.TaskWhereInput = {
    projectId,
    ...(status && { status }),
    ...(priority && { priority }),
    ...(type && { type }),
    ...(assigneeId !== undefined && { assigneeId }),
    ...(sprintId !== undefined && { sprintId }),
  };
  const q = filters.q?.trim();
  if (q) {
    // Existing project indexes bound the scope; substring ILIKE can still scan
    // that project's rows. Larger workloads may warrant measured trigram indexes.
    // Escape LIKE metacharacters so contains remains a literal substring search.
    const contains = q.replace(/[\\%_]/g, "\\$&");
    const alternatives: Prisma.TaskWhereInput[] = [
      { title: { contains, mode: "insensitive" } },
      { description: { contains, mode: "insensitive" } },
    ];
    const identifier = /^(.*)-([0-9]+)$/.exec(q);
    const number = identifier ? Number(identifier[2]) : NaN;
    if (
      identifier?.[1] &&
      number > 0 &&
      number <= 2147483647 &&
      Number.isInteger(number)
    ) {
      alternatives.push({
        number,
        project: { key: { equals: identifier[1], mode: "insensitive" } },
      });
    }
    where.OR = alternatives;
  }
  return where;
};

export const taskPage = ({ page, limit }: { page: number; limit: number }) => ({
  skip: (page - 1) * limit,
  take: limit,
});

export const taskPagination = (
  query: { page: number; limit: number },
  total: number,
) => ({
  page: query.page,
  limit: query.limit,
  total,
  totalPages: Math.ceil(total / query.limit),
});
