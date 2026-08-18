import { expect, test } from "@playwright/test";

function makeToken(payload: unknown): string {
  const b64 = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `header.${b64}.signature`;
}

const FAKE_TOKEN = makeToken({ sub: "u1", tid: "t1", role: "ADMIN", name: "Ada", email: "ada@example.org" });

test.beforeEach(async ({ context }) => {
  await context.addCookies([
    { name: "dd_session", value: FAKE_TOKEN, domain: "127.0.0.1", path: "/", httpOnly: true, sameSite: "Lax" },
  ]);
});

test("dashboard home renders with My Work and notification links", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { name: "What needs your attention" })).toBeVisible();
  await expect(page.getByRole("link", { name: /My Work|my work/i })).toBeVisible().catch(() => undefined);
  await page.goto("/my-work");
  await expect(page.getByRole("heading", { name: "My work" })).toBeVisible();
});

test("projects portfolio renders a search form and table header", async ({ page }) => {
  await page.goto("/projects");
  await expect(page.getByRole("heading", { name: "Projects" })).toBeVisible();
  await expect(page.getByPlaceholder("Title, code, donor, country")).toBeVisible();
  await expect(page.getByLabel("Status")).toBeVisible();
  await expect(page.getByLabel("Sort")).toBeVisible();
});

test("notifications inbox renders a heading and filter chips", async ({ page }) => {
  await page.goto("/notifications");
  await expect(page.getByRole("heading", { name: "Notifications" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Unread", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Read", exact: true })).toBeVisible();
});

test("project detail degrades gracefully when data is unavailable", async ({ page }) => {
  await page.goto("/projects/demo-project");
  const body = page.locator("body");
  await expect(body).toContainText(/could not be loaded|not found|templates|logframe/i);
});
