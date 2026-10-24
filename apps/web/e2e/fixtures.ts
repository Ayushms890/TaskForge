import { randomUUID } from "node:crypto";
import {
  test as base,
  expect,
  type APIRequestContext,
  type APIResponse,
  type Page,
} from "@playwright/test";
import { apiURL } from "./urls";

export type Account = {
  id: string;
  name: string;
  email: string;
  password: string;
};
export type Task = {
  id: string;
  identifier: string;
  title: string;
  description?: string;
  priority: string;
  assigneeId: string | null;
};
type Workspace = { id: string; name: string; slug: string };
type Project = { id: string; name: string };
type Seed = {
  owner: Account;
  member: Account;
  workspace: Workspace;
  project: Project;
  ownerAPI: APIRequestContext;
  createTask: (title: string, assigneeId?: string) => Promise<Task>;
};

// Only status and success are printed on failure, never headers/cookies or auth bodies.
export async function data<T>(response: APIResponse, status = 200): Promise<T> {
  expect(response.status(), "REST response status").toBe(status);
  const body = await response.json();
  expect(body.success, "REST success envelope").toBe(true);
  return body.data as T;
}

async function register(
  api: APIRequestContext,
  label: string,
): Promise<Account> {
  const unique = randomUUID();
  const credentials = {
    name: `E2E ${label} ${unique.slice(0, 8)}`,
    email: `e2e-${label}-${unique}@example.test`,
    password: `E2e!${randomUUID()}Aa9`,
  };
  const result = await data<{ user: { id: string } }>(
    await api.post(`${apiURL}/auth/register`, { data: credentials }),
    201,
  );
  return { ...credentials, id: result.user.id };
}

export async function login(page: Page, account: Account) {
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(account.email);
  await page.getByLabel("Password", { exact: true }).fill(account.password);
  const [response] = await Promise.all([
    page.waitForResponse(
      (r) =>
        r.url() === `${apiURL}/auth/login` && r.request().method() === "POST",
      { timeout: 10_000 },
    ),
    page.getByRole("button", { name: "Sign in", exact: true }).click(),
  ]);
  expect(response.status(), "UI login status").toBe(200);
  await expect(page).toHaveURL(/\/workspaces$/);
  await expect(
    page.getByRole("button", {
      name: `${account.name} ${account.email}`,
      exact: true,
    }),
  ).toBeVisible();
}

export const test = base.extend<{
  seed: Seed;
  ownerPage: Page;
  memberPage: Page;
}>({
  seed: async ({ playwright, baseURL }, use) => {
    const options = {
      extraHTTPHeaders: { Origin: new URL(baseURL!).origin },
      timeout: 10_000,
    };
    const ownerAPI = await playwright.request.newContext(options);
    const memberAPI = await playwright.request.newContext(options);
    let workspace: Workspace | undefined;
    let owner: Account | undefined;
    try {
      owner = await register(ownerAPI, "owner");
      const member = await register(memberAPI, "member");
      const unique = randomUUID();
      workspace = (
        await data<{ workspace: Workspace }>(
          await ownerAPI.post(`${apiURL}/workspaces`, {
            data: { name: `E2E workspace ${unique}`, slug: `e2e-${unique}` },
          }),
          201,
        )
      ).workspace;
      await data(
        await ownerAPI.post(`${apiURL}/workspaces/${workspace.id}/members`, {
          data: { email: member.email, role: "MEMBER" },
        }),
      );
      const project = (
        await data<{ project: Project }>(
          await ownerAPI.post(`${apiURL}/workspaces/${workspace.id}/projects`, {
            data: {
              name: `E2E project ${unique.slice(0, 8)}`,
              key: `E${unique.replaceAll("-", "").slice(0, 8).toUpperCase()}`,
            },
          }),
          201,
        )
      ).project;
      await use({
        owner,
        member,
        workspace,
        project,
        ownerAPI,
        createTask: async (title, assigneeId) =>
          (
            await data<{ task: Task }>(
              await ownerAPI.post(`${apiURL}/tasks`, {
                data: {
                  projectId: project.id,
                  title,
                  ...(assigneeId ? { assigneeId } : {}),
                },
              }),
              201,
            )
          ).task,
      });
    } finally {
      try {
        if (workspace && owner) {
          // The only deletion target is the exact workspace created by this fixture.
          const existing = await ownerAPI.get(
            `${apiURL}/workspaces/${workspace.id}`,
          );
          if (existing.status() !== 404) {
            const current = (
              await data<{
                workspace: Workspace & {
                  members: { role: string; user: { id: string } }[];
                };
              }>(existing)
            ).workspace;
            expect(current.slug).toBe(workspace.slug);
            expect(
              current.members.some(
                (m) => m.role === "OWNER" && m.user.id === owner!.id,
              ),
            ).toBe(true);
            await data(
              await ownerAPI.delete(`${apiURL}/workspaces/${workspace.id}`),
            );
          }
        }
      } finally {
        await ownerAPI.dispose();
        await memberAPI.dispose();
      }
    }
  },
  ownerPage: async ({ page, seed }, use) => {
    await login(page, seed.owner);
    await use(page);
  },
  memberPage: async ({ browser, baseURL, seed }, use) => {
    if (!baseURL) throw new Error("Browser test base URL is required.");
    const context = await browser.newContext({
      baseURL,
      viewport: { width: 1440, height: 1000 },
    });
    context.setDefaultTimeout(10_000);
    context.setDefaultNavigationTimeout(20_000);
    try {
      const page = await context.newPage();
      await login(page, seed.member);
      await use(page);
    } finally {
      await context.close();
    }
  },
});

export { expect };
