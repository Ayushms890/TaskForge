export type MoveStatus = "TODO" | "IN_PROGRESS" | "DONE";
export type MoveTask = {
  id: string;
  status: MoveStatus;
  position: number;
  [key: string]: unknown;
};
export type TaskColumns = Record<MoveStatus, MoveTask[]>;
export function moveTask(
  columns: TaskColumns,
  taskId: string,
  targetStatus: MoveStatus,
  targetIndex: number,
): TaskColumns {
  const sourceStatus = (Object.keys(columns) as MoveStatus[]).find((status) =>
    columns[status].some((task) => task.id === taskId),
  );
  if (!sourceStatus) return columns;
  const source = columns[sourceStatus].find((task) => task.id === taskId)!;
  const next = {
    TODO: [...columns.TODO],
    IN_PROGRESS: [...columns.IN_PROGRESS],
    DONE: [...columns.DONE],
  };
  next[sourceStatus] = next[sourceStatus].filter((task) => task.id !== taskId);
  const index = Math.max(0, Math.min(targetIndex, next[targetStatus].length));
  next[targetStatus].splice(index, 0, {
    ...source,
    status: targetStatus,
    position: index,
  });
  (Object.keys(next) as MoveStatus[]).forEach(
    (status) =>
      (next[status] = next[status].map((task, position) => ({
        ...task,
        position,
      }))),
  );
  return next;
}
