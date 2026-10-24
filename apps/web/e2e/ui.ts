import { expect, type Locator, type Page } from "@playwright/test";
import { apiURL } from "./urls";

export async function mutation(
  page: Page,
  method: string,
  path: string,
  action: () => Promise<unknown>,
  status = 200,
) {
  const [result] = await Promise.all([
    page.waitForResponse(
      (r) => r.url() === `${apiURL}${path}` && r.request().method() === method,
      { timeout: 10_000 },
    ),
    action(),
  ]);
  expect(result.status(), `${method} mutation status`).toBe(status);
  return result;
}

export function column(page: Page, name: string) {
  return page
    .locator("section")
    .filter({ has: page.getByRole("heading", { name, exact: true }) });
}

// dnd-kit uses PointerSensor, so exercise the actual task card with pointer events.
export async function dragTask(
  page: Page,
  task: { id: string; identifier: string },
  target: Locator,
) {
  const handle = page
    .locator("article")
    .filter({
      has: page.getByRole("link", {
        name: new RegExp(`^${task.identifier} `),
      }),
    })
    .first();
  await expect(handle).toHaveAttribute("aria-disabled", "false");
  await target.scrollIntoViewIfNeeded();
  await handle.scrollIntoViewIfNeeded();
  const source = await handle.boundingBox();
  const destination = await target.boundingBox();
  expect(source, "drag handle bounds").not.toBeNull();
  expect(destination, "drop target bounds").not.toBeNull();
  const x = source!.x + source!.width / 2;
  const y = source!.y + source!.height / 2;
  await mutation(page, "PATCH", `/tasks/${task.id}/position`, async () => {
    await page.mouse.move(x, y);
    await page.mouse.down();
    try {
      await page.mouse.move(x + 10, y, { steps: 3 });
      await page.mouse.move(
        destination!.x + destination!.width / 2,
        destination!.y + destination!.height / 2,
        { steps: 15 },
      );
    } finally {
      await page.mouse.up();
    }
  });
  // Cards stay enabled after the authoritative board refresh finishes.
  await expect(handle).toHaveAttribute("aria-disabled", "false");
  // Next.js adds an empty route-announcer alert outside main; only application
  // errors should fail a successful drag (the PATCH response is checked above).
  await expect(page.getByRole("main").getByRole("alert")).toHaveCount(0);
}
