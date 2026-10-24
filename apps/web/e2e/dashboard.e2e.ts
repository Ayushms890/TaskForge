import type { Page } from "@playwright/test";
import { test, expect, data } from "./fixtures";
import { apiURL } from "./urls";
import type { Dashboard } from "../src/services/dashboard";

async function expectDashboard(page: Page, dashboard: Dashboard) {
  const summary = page.getByRole("region", {
    name: "Task summary",
    exact: true,
  });
  for (const [label, count] of [
    ["Total tasks", dashboard.summary.total],
    ["To do", dashboard.summary.todo],
    ["In progress", dashboard.summary.inProgress],
    ["Done", dashboard.summary.done],
  ] as const) {
    const metric = summary
      .locator("dl > div")
      .filter({ has: page.getByText(label, { exact: true }) });
    await expect(metric.locator("dd")).toHaveText(String(count));
  }
  const sprint = page.getByRole("region", {
    name: "Active sprint",
    exact: true,
  });
  if (dashboard.activeSprint) {
    await expect(
      sprint.getByRole("heading", {
        name: dashboard.activeSprint.name,
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      sprint.getByText(
        `${dashboard.activeSprint.doneTasks} of ${dashboard.activeSprint.totalTasks} tasks done`,
        { exact: true },
      ),
    ).toBeVisible();
    await expect(sprint.getByRole("progressbar")).toHaveAttribute(
      "aria-valuenow",
      String(dashboard.activeSprint.progressPercent),
    );
  } else {
    await expect(
      sprint.getByText("No active sprint", { exact: true }),
    ).toBeVisible();
    await expect(sprint.getByRole("progressbar")).toHaveCount(0);
  }
}

test("member dashboard shows real totals and sprint progress after task creation, updates and reload", async ({
  memberPage: page,
  seed,
}) => {
  const first = await seed.createTask("Dashboard delivery", seed.member.id);
  await seed.createTask("Dashboard backlog");
  const dashboardURL = `${apiURL}/projects/${seed.project.id}/dashboard`;
  const readDashboard = async () =>
    data<Dashboard>(await seed.ownerAPI.get(dashboardURL));
  await page.goto(`/projects/${seed.project.id}`);
  const navigation = page.getByRole("navigation", { name: "Project views" });
  await expect(
    navigation.getByRole("link", { name: "Board", exact: true }),
  ).toHaveAttribute("aria-current", "page");
  await navigation
    .getByRole("link", { name: "Dashboard", exact: true })
    .click();
  await expect(page).toHaveURL(
    new RegExp(`/projects/${seed.project.id}/dashboard$`),
  );
  await expect(
    navigation.getByRole("link", { name: "Dashboard", exact: true }),
  ).toHaveAttribute("aria-current", "page");
  const initial = await readDashboard();
  expect(initial.summary).toEqual({
    total: 2,
    todo: 2,
    inProgress: 0,
    done: 0,
  });
  expect(initial.activeSprint).toBeNull();
  await expectDashboard(page, initial);

  const start = new Date();
  const end = new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000);
  const { sprint } = await data<{ sprint: { id: string } }>(
    await seed.ownerAPI.post(`${apiURL}/projects/${seed.project.id}/sprints`, {
      data: {
        name: "Dashboard iteration",
        goal: "Ship real progress",
        startDate: start.toISOString(),
        endDate: end.toISOString(),
      },
    }),
    201,
  );
  await data(
    await seed.ownerAPI.patch(`${apiURL}/tasks/${first.id}`, {
      data: { sprintId: sprint.id, status: "DONE" },
    }),
  );
  const second = await seed.createTask(
    "Dashboard implementation",
    seed.member.id,
  );
  await data(
    await seed.ownerAPI.patch(`${apiURL}/tasks/${second.id}`, {
      data: { sprintId: sprint.id, status: "IN_PROGRESS" },
    }),
  );
  await data(await seed.ownerAPI.post(`${apiURL}/sprints/${sprint.id}/start`));
  await page.reload();
  const updated = await readDashboard();
  expect(updated.summary).toEqual({
    total: 3,
    todo: 1,
    inProgress: 1,
    done: 1,
  });
  expect(updated.activeSprint).toMatchObject({
    id: sprint.id,
    totalTasks: 2,
    doneTasks: 1,
    progressPercent: 50,
  });
  await expectDashboard(page, updated);
  const recent = page.getByRole("region", {
    name: "Recent tasks",
    exact: true,
  });
  await expect(
    recent.getByRole("link", {
      name: `${second.identifier} ${second.title}`,
      exact: true,
    }),
  ).toBeVisible();
  const activity = page.getByRole("region", {
    name: "Recent activity",
    exact: true,
  });
  await expect(activity).toContainText(
    "changed the status from To do to In progress",
  );
  await expect(activity).not.toContainText("[object Object]");
  await page.setViewportSize({ width: 390, height: 844 });
  await expectDashboard(page, updated);
  await recent
    .getByRole("link", {
      name: `${second.identifier} ${second.title}`,
      exact: true,
    })
    .click();
  await expect(page).toHaveURL(new RegExp(`/tasks/${second.id}$`));
  await expect(
    page.getByRole("heading", { name: second.title, exact: true }),
  ).toBeVisible();
});
