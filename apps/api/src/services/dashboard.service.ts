import {
  dashboardRepository,
  type DashboardRepository,
} from "../repositories/dashboard.repository.js";
import { NotFoundError } from "../utils/http-error.js";

export const createDashboardService = (repository: DashboardRepository) => ({
  async get(userId: string, projectId: string) {
    const snapshot = await repository.readForUser(projectId, userId);
    if (!snapshot)
      throw new NotFoundError("PROJECT_NOT_FOUND", "Project not found.");
    const {
      project,
      counts,
      activeSprint,
      sprintCounts,
      recentTasks,
      recentActivity,
    } = snapshot;
    const summary = { total: 0, todo: 0, inProgress: 0, done: 0 };
    for (const row of counts) {
      summary.total += row._count._all;
      if (row.status === "TODO") summary.todo = row._count._all;
      if (row.status === "IN_PROGRESS") summary.inProgress = row._count._all;
      if (row.status === "DONE") summary.done = row._count._all;
    }
    const totalTasks = sprintCounts.reduce(
      (total, row) => total + row._count._all,
      0,
    );
    const doneTasks =
      sprintCounts.find((row) => row.status === "DONE")?._count._all ?? 0;
    return {
      project,
      summary,
      activeSprint: activeSprint
        ? {
            ...activeSprint,
            totalTasks,
            doneTasks,
            progressPercent:
              totalTasks === 0 ? 0 : Math.round((doneTasks / totalTasks) * 100),
          }
        : null,
      recentTasks: recentTasks.map(({ number, ...task }) => ({
        ...task,
        identifier: `${project.key}-${number}`,
      })),
      recentActivity: recentActivity.map(
        ({ task: { number, ...task }, ...activity }) => ({
          ...activity,
          task: { ...task, identifier: `${project.key}-${number}` },
        }),
      ),
    };
  },
});

export const dashboardService = createDashboardService(dashboardRepository);
