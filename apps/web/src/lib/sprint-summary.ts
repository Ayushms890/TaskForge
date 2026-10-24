/** Only expose assignment totals when the response proves the list is complete. */
export function completeTaskCounts(
  tasks: { id: string; sprintId?: string | null }[],
  pagination?: { page: number; total: number; totalPages: number },
): Map<string, number> | null {
  if (
    !pagination ||
    pagination.page !== 1 ||
    pagination.totalPages > 1 ||
    pagination.total !== tasks.length ||
    new Set(tasks.map((task) => task.id)).size !== tasks.length
  )
    return null;
  const counts = new Map<string, number>();
  for (const task of tasks) {
    const key = task.sprintId ?? "";
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}
