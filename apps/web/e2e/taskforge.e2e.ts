import { test, expect, data, type Task } from "./fixtures";
import { apiURL } from "./urls";
import { column, dragTask, mutation } from "./ui";

test("board search and combined filters preserve URL, reload and paginated navigation", async ({
  ownerPage: page,
  seed,
}) => {
  const first = await seed.createTask("Searchable alpha", seed.member.id);
  await data(
    await seed.ownerAPI.patch(`${apiURL}/tasks/${first.id}`, {
      data: {
        description: "unique-description-needle",
        priority: "HIGH",
        type: "BUG",
      },
    }),
  );
  await seed.createTask("Second searchable task");
  await seed.createTask("Third searchable task");
  await page.goto(`/projects/${seed.project.id}?limit=2`);
  const filters = page.getByRole("region", { name: "Board filters" });
  const search = filters.getByRole("searchbox", { name: "Search tasks" });
  const cards = page.locator("main article");
  await expect(cards).toHaveCount(2);
  await expect(
    page.locator("article").filter({
      has: page.getByRole("link", {
        name: `${first.identifier} Searchable alpha`,
        exact: true,
      }),
    }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Next page", exact: true }).click();
  await expect(page).toHaveURL(/page=2/);
  await expect(cards).toHaveCount(1);
  await page.reload();
  await expect(cards).toHaveCount(1);
  await page
    .getByRole("button", { name: "Previous page", exact: true })
    .click();
  await expect(cards).toHaveCount(2);
  await page.goBack();
  await expect(cards).toHaveCount(1);
  await page.goForward();
  await expect(cards).toHaveCount(2);
  const toggle = filters.getByRole("button", { name: /^Search & filters/ });
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await expect(search).toBeHidden();
  await toggle.click();
  await expect(search).toBeVisible();
  for (const term of [
    "Searchable alpha",
    "unique-description-needle",
    first.identifier,
  ]) {
    await search.fill(term);
    await filters.getByRole("button", { name: "Search", exact: true }).click();
    await expect(cards).toHaveCount(1);
    await expect(cards).toContainText(first.title);
    await expect(page).toHaveURL(/page=1/);
  }
  await filters
    .getByRole("combobox", { name: "Status", exact: true })
    .selectOption("TODO");
  await filters
    .getByRole("combobox", { name: "Priority", exact: true })
    .selectOption("HIGH");
  await filters
    .getByRole("combobox", { name: "Type", exact: true })
    .selectOption("BUG");
  await filters
    .getByRole("combobox", { name: "Assignee", exact: true })
    .selectOption(seed.member.id);
  await filters
    .getByRole("combobox", { name: "Sprint", exact: true })
    .selectOption("backlog");
  await expect(cards).toHaveCount(1);
  await page.reload();
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await expect(toggle).toContainText("6 active");
  await toggle.click();
  await expect(search).toHaveValue(first.identifier);
  await expect(
    filters.getByRole("combobox", { name: "Assignee", exact: true }),
  ).toHaveValue(seed.member.id);
  await expect(cards).toHaveCount(1);
  await filters
    .getByRole("combobox", { name: "Assignee", exact: true })
    .selectOption("unassigned");
  await expect(
    page.getByText("No tasks match your search and filters.", { exact: true }),
  ).toBeVisible();
  await expect(cards).toHaveCount(0);
  await filters.getByRole("button", { name: "Done", exact: true }).click();
  await expect(search).toBeHidden();
  await filters.getByRole("button", { name: "Clear filters" }).click();
  await expect(toggle).not.toContainText("active");
  await toggle.click();
  await expect(search).toHaveValue("");
  await search.press("Escape");
  await expect(toggle).toBeFocused();
  await expect(search).toBeHidden();
  await expect(cards).toHaveCount(2);
  const url = new URL(page.url());
  expect(url.searchParams.get("page")).toBe("1");
  expect(url.searchParams.get("limit")).toBe("2");
  for (const key of [
    "q",
    "status",
    "priority",
    "type",
    "assigneeId",
    "sprintId",
  ])
    expect(url.searchParams.has(key)).toBe(false);
  await page
    .getByRole("button", { name: "Show all tasks", exact: true })
    .click();
  await expect(cards).toHaveCount(3);
  await expect(
    page.locator("article").filter({
      has: page.getByRole("link", {
        name: `${first.identifier} Searchable alpha`,
        exact: true,
      }),
    }),
  ).toBeEnabled();
});

test("identity survives reload and project navigation; logout clears the session", async ({
  ownerPage: page,
  seed,
}) => {
  const identity = page.getByRole("button", {
    name: `${seed.owner.name} ${seed.owner.email}`,
    exact: true,
  });
  await page.reload();
  await expect(identity).toBeVisible();
  await page
    .getByRole("link")
    .filter({ has: page.getByText(seed.workspace.name, { exact: true }) })
    .click();
  await page.getByRole("link", { name: new RegExp(seed.project.name) }).click();
  await expect(
    page.getByRole("heading", { name: seed.project.name, exact: true }),
  ).toBeVisible();
  await page
    .getByRole("navigation", { name: "Project views" })
    .getByRole("link", { name: "Sprints", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Sprints", exact: true }),
  ).toBeVisible();
  await expect(identity).toBeVisible();
  await page.reload();
  await expect(identity).toBeVisible();
  await identity.click();
  await mutation(page, "POST", "/auth/logout", () =>
    page.getByRole("button", { name: "Log out", exact: true }).click(),
  );
  await expect(page).toHaveURL(/\/login$/);
  await page.reload();
  await expect(identity).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Sign in", exact: true }),
  ).toBeVisible();
  expect((await page.request.get(`${apiURL}/auth/me`)).status()).toBe(401);
});

test("board task creation saves description, priority, type, and assignee through the UI", async ({
  ownerPage: page,
  seed,
}) => {
  await page.goto(`/projects/${seed.project.id}`);
  await page
    .getByRole("button", { name: "+ Create task", exact: true })
    .click();
  const form = page.getByRole("form", { name: "Create task", exact: true });
  const title = "UI-created detailed task";
  const description =
    "Acceptance criteria:\nPreserve this description after a reload.";
  await form.getByLabel(/^Title/).fill(title);
  await form.getByLabel(/^Description/).fill(description);
  await form
    .getByRole("combobox", { name: "Priority", exact: true })
    .selectOption("HIGH");
  await form
    .getByRole("combobox", { name: "Type", exact: true })
    .selectOption("BUG");
  await form
    .getByRole("combobox", { name: "Assignee", exact: true })
    .selectOption(seed.member.id);
  const response = await mutation(
    page,
    "POST",
    "/tasks",
    () =>
      form.getByRole("button", { name: "Create task", exact: true }).click(),
    201,
  );
  const { task } = (await response.json()).data as { task: Task };
  await expect(form).toBeHidden();
  await column(page, "To do")
    .getByRole("link", { name: `${task.identifier} ${title}`, exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: title, exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("region", { name: "Description", exact: true }),
  ).toContainText(description);
  await expect(
    page.locator("main header").getByText("HIGH", { exact: true }),
  ).toBeVisible();
  await expect(
    page.locator("main header").getByText("BUG", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("combobox", { name: "Assignee", exact: true }),
  ).toHaveValue(seed.member.id);
});

test("pointer grips reorder tasks and move into empty columns, persisting after reload", async ({
  ownerPage: page,
  seed,
}) => {
  const first = await seed.createTask("First card");
  const second = await seed.createTask("Second card");
  const third = await seed.createTask("Third card");
  await page.goto(`/projects/${seed.project.id}`);
  const todo = column(page, "To do");
  const progress = column(page, "In progress");
  const done = column(page, "Done");
  await expect(todo.getByRole("link")).toHaveText([
    `${first.identifier}First card`,
    `${second.identifier}Second card`,
    `${third.identifier}Third card`,
  ]);
  await dragTask(
    page,
    third,
    todo.locator("article").filter({
      has: page.getByRole("link", {
        name: `${first.identifier} First card`,
        exact: true,
      }),
    }),
  );
  await expect(todo.getByRole("link")).toHaveText([
    `${third.identifier}Third card`,
    `${first.identifier}First card`,
    `${second.identifier}Second card`,
  ]);
  await page.reload();
  await expect(todo.getByRole("link")).toHaveText([
    `${third.identifier}Third card`,
    `${first.identifier}First card`,
    `${second.identifier}Second card`,
  ]);
  await dragTask(
    page,
    third,
    progress.getByText("Drop a task here", { exact: true }),
  );
  await expect(progress.getByRole("link")).toHaveCount(1);
  await expect(progress.getByRole("link")).toContainText(third.title);
  await page.reload();
  await expect(progress.getByRole("link")).toContainText(third.title);
  await dragTask(
    page,
    third,
    done.getByText("Drop a task here", { exact: true }),
  );
  await page.reload();
  await expect(done.getByRole("link")).toContainText(third.title);
  await expect(
    progress.getByText("Drop a task here", { exact: true }),
  ).toBeVisible();
  await expect(todo.getByRole("link")).toHaveText([
    `${first.identifier}First card`,
    `${second.identifier}Second card`,
  ]);
});

test("drag overlay preserves the point where the card was grabbed", async ({
  ownerPage: page,
  seed,
}) => {
  const task = await seed.createTask("Cursor alignment card");
  await page.goto(`/projects/${seed.project.id}`);
  const card = column(page, "To do")
    .locator("article")
    .filter({
      has: page.getByRole("link", {
        name: `${task.identifier} Cursor alignment card`,
        exact: true,
      }),
    })
    .first();
  await card.scrollIntoViewIfNeeded();
  const source = await card.boundingBox();
  expect(source, "source card bounds").not.toBeNull();
  const start = {
    x: source!.x + source!.width * 0.72,
    y: source!.y + source!.height * 0.82,
  };
  const moved = { x: start.x + 12, y: start.y + 12 };

  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  try {
    await page.mouse.move(moved.x, moved.y, { steps: 3 });
    const overlay = page.getByTestId("task-drag-overlay");
    await expect(overlay).toBeVisible();
    const overlayBox = await overlay.boundingBox();
    expect(overlayBox, "drag overlay bounds").not.toBeNull();

    expect(
      Math.abs(moved.x - overlayBox!.x - (start.x - source!.x)),
    ).toBeLessThan(8);
    expect(
      Math.abs(moved.y - overlayBox!.y - (start.y - source!.y)),
    ).toBeLessThan(8);
  } finally {
    await page.mouse.up();
  }
});

test("member has a separate session, self-assigns new tasks, and cannot delete or reassign", async ({
  ownerPage,
  memberPage: page,
  seed,
}) => {
  const ownersTask = await seed.createTask(
    "Owner-only assigned task",
    seed.owner.id,
  );
  await page.goto(`/projects/${seed.project.id}`);
  await page
    .getByRole("button", { name: "+ Create task", exact: true })
    .click();
  const form = page.getByRole("form", { name: "Create task", exact: true });
  await expect(
    form.getByText("New tasks are automatically assigned to you.", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    form.getByRole("combobox", { name: "Assignee", exact: true }),
  ).toHaveCount(0);
  await expect(
    form.getByRole("textbox", { name: /^Assignee/ }),
  ).toHaveAttribute("readonly", "");
  await form.getByLabel(/^Title/).fill("Member-created task");
  const response = await mutation(
    page,
    "POST",
    "/tasks",
    () =>
      form.getByRole("button", { name: "Create task", exact: true }).click(),
    201,
  );
  const { task } = (await response.json()).data as { task: Task };
  expect(task.assigneeId).toBe(seed.member.id);
  await expect(
    page.locator("article").filter({
      has: page.getByRole("link", {
        name: `${ownersTask.identifier} Owner-only assigned task`,
        exact: true,
      }),
    }),
  ).toBeDisabled();
  await expect(
    page.locator("article").filter({
      has: page.getByRole("link", {
        name: `${task.identifier} ${task.title}`,
        exact: true,
      }),
    }),
  ).toBeEnabled();
  await page
    .getByRole("link", {
      name: `${task.identifier} ${task.title}`,
      exact: true,
    })
    .click();
  await expect(
    page.getByRole("heading", { name: task.title, exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("combobox", { name: "Assignee", exact: true }),
  ).toHaveValue(seed.member.id);
  await expect(
    page.getByRole("combobox", { name: "Assignee", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Delete task…", exact: true }),
  ).toHaveCount(0);
  // Also prove the server rejects bypassing the disabled UI with the member cookie.
  const headers = { Origin: new URL(page.url()).origin };
  expect(
    (
      await page.request.patch(`${apiURL}/tasks/${task.id}`, {
        headers,
        data: { assigneeId: seed.owner.id },
      })
    ).status(),
  ).toBe(403);
  expect(
    (
      await page.request.delete(`${apiURL}/tasks/${task.id}`, { headers })
    ).status(),
  ).toBe(403);
  await page.goto(`/workspaces/${seed.workspace.id}`);
  await expect(
    page.getByRole("heading", { name: seed.workspace.name, exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Delete workspace…", exact: true }),
  ).toHaveCount(0);
  expect(
    (
      await page.request.delete(`${apiURL}/workspaces/${seed.workspace.id}`, {
        headers,
      })
    ).status(),
  ).toBe(403);
  const persisted = await data<{ task: Task }>(
    await seed.ownerAPI.get(`${apiURL}/tasks/${task.id}`),
  );
  expect(persisted.task.assigneeId).toBe(seed.member.id);
  await expect(
    ownerPage.getByRole("button", {
      name: `${seed.owner.name} ${seed.owner.email}`,
      exact: true,
    }),
  ).toBeVisible();
});

test("sprint creation, task assignment, start and completion survive reload", async ({
  ownerPage: page,
  seed,
}) => {
  const task = await seed.createTask("Sprint delivery");
  await page.goto(`/projects/${seed.project.id}/sprints`);
  await page.getByLabel("Name", { exact: true }).fill("E2E iteration");
  await page
    .getByLabel("Goal", { exact: true })
    .fill("Deliver the browser-tested flow");
  const start = new Date();
  start.setUTCDate(start.getUTCDate() + 1);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 7);
  await page
    .getByLabel("Start date", { exact: true })
    .fill(start.toISOString().slice(0, 16));
  await page
    .getByLabel("End date", { exact: true })
    .fill(end.toISOString().slice(0, 16));
  const response = await mutation(
    page,
    "POST",
    `/projects/${seed.project.id}/sprints`,
    () =>
      page.getByRole("button", { name: "Create sprint", exact: true }).click(),
    201,
  );
  const { sprint } = (await response.json()).data as { sprint: { id: string } };
  const card = page.getByRole("article").filter({
    has: page.getByRole("heading", { name: "E2E iteration", exact: true }),
  });
  await expect(card.getByText("Planned", { exact: true })).toBeVisible();
  await mutation(page, "PATCH", `/tasks/${task.id}`, () =>
    page
      .getByRole("combobox", {
        name: `Sprint for ${task.identifier}`,
        exact: true,
      })
      .selectOption(sprint.id),
  );
  await expect(
    card.getByText("1 assigned tasks", { exact: true }),
  ).toBeVisible();
  await mutation(page, "POST", `/sprints/${sprint.id}/start`, () =>
    card.getByRole("button", { name: "Start sprint", exact: true }).click(),
  );
  await expect(card.getByText("Active", { exact: true })).toBeVisible();
  await page.reload();
  await expect(card.getByText("Active", { exact: true })).toBeVisible();
  await mutation(page, "POST", `/sprints/${sprint.id}/complete`, () =>
    card.getByRole("button", { name: "Complete sprint", exact: true }).click(),
  );
  await expect(card.getByText("Completed", { exact: true })).toBeVisible();
  await page.reload();
  await expect(card.getByText("Completed", { exact: true })).toBeVisible();
  await expect(card.getByRole("button")).toHaveCount(0);
});

test("task and workspace deletion require exact confirmation and support cancellation", async ({
  ownerPage: page,
  seed,
}) => {
  const task = await seed.createTask("Delete only this test task");
  await page.goto(`/tasks/${task.id}`);
  const openTask = page.getByRole("button", {
    name: "Delete task…",
    exact: true,
  });
  await openTask.click();
  const taskConfirm = page.getByLabel(`Type ${task.identifier} to confirm`, {
    exact: true,
  });
  const deleteTask = page.getByRole("button", {
    name: "Permanently delete",
    exact: true,
  });
  await expect(taskConfirm).toBeFocused();
  await expect(deleteTask).toBeDisabled();
  await taskConfirm.fill("incorrect");
  await expect(deleteTask).toBeDisabled();
  await taskConfirm.fill(task.identifier);
  await expect(deleteTask).toBeEnabled();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(taskConfirm).toHaveCount(0);
  await expect(openTask).toBeFocused();
  await data(await seed.ownerAPI.get(`${apiURL}/tasks/${task.id}`));
  await openTask.click();
  await expect(taskConfirm).toHaveValue("");
  await taskConfirm.fill(task.identifier);
  await mutation(page, "DELETE", `/tasks/${task.id}`, () => deleteTask.click());
  await expect(page).toHaveURL(new RegExp(`/projects/${seed.project.id}$`));
  await page.reload();
  await expect(
    page.getByRole("heading", { name: seed.project.name, exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", {
      name: `${task.identifier} ${task.title}`,
      exact: true,
    }),
  ).toHaveCount(0);
  expect((await seed.ownerAPI.get(`${apiURL}/tasks/${task.id}`)).status()).toBe(
    404,
  );

  await page
    .getByRole("navigation", { name: "Project views" })
    .getByRole("link", { name: "Workspace", exact: true })
    .click();
  const openWorkspace = page.getByRole("button", {
    name: "Delete workspace…",
    exact: true,
  });
  await openWorkspace.click();
  const workspaceConfirm = page.getByLabel(
    `Type ${seed.workspace.name} exactly to confirm`,
    { exact: true },
  );
  const deleteWorkspace = page.getByRole("button", {
    name: "Permanently delete workspace",
    exact: true,
  });
  await expect(workspaceConfirm).toBeFocused();
  await expect(deleteWorkspace).toBeDisabled();
  await workspaceConfirm.fill(`${seed.workspace.name} wrong`);
  await expect(deleteWorkspace).toBeDisabled();
  await workspaceConfirm.fill(seed.workspace.name);
  await expect(deleteWorkspace).toBeEnabled();
  await workspaceConfirm.press("Escape");
  await expect(workspaceConfirm).toHaveCount(0);
  await expect(openWorkspace).toBeFocused();
  await data(
    await seed.ownerAPI.get(`${apiURL}/workspaces/${seed.workspace.id}`),
  );
  await openWorkspace.click();
  await expect(workspaceConfirm).toHaveValue("");
  await workspaceConfirm.fill(seed.workspace.name);
  await mutation(page, "DELETE", `/workspaces/${seed.workspace.id}`, () =>
    deleteWorkspace.click(),
  );
  await expect(page).toHaveURL(/\/workspaces$/);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "A place for your team", exact: true }),
  ).toBeVisible();
  await expect(
    page
      .getByRole("link")
      .filter({ has: page.getByText(seed.workspace.name, { exact: true }) }),
  ).toHaveCount(0);
  expect(
    (
      await seed.ownerAPI.get(`${apiURL}/workspaces/${seed.workspace.id}`)
    ).status(),
  ).toBe(404);
});
