import { expect, test } from "@playwright/test";

const FAKE_TOKEN = makeToken({ sub: "u1", tid: "t1", role: "ADMIN", name: "Ada", email: "ada@example.org" });

function makeToken(payload: unknown): string {
  const b64 = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `header.${b64}.signature`;
}

test.beforeEach(async ({ context }) => {
  await context.addCookies([
    { name: "dd_session", value: FAKE_TOKEN, domain: "127.0.0.1", path: "/", httpOnly: true, sameSite: "Lax" },
  ]);
});

test("authenticated shell renders skip link, nav, and main content", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page.getByRole("link", { name: "Skip to main content" })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Primary" })).toContainText("Home");
  await expect(page.getByRole("navigation", { name: "Primary" })).toContainText("Projects");
  await expect(page.getByRole("main")).toBeVisible();
});

test("skip link moves focus to main content", async ({ page }) => {
  await page.goto("/dashboard");
  await page.keyboard.press("Tab");
  const focused = page.locator(":focus");
  await expect(focused).toContainText("Skip to main content");
  await page.keyboard.press("Enter");
  await expect(page.locator("#main-content")).toBeFocused();
});
