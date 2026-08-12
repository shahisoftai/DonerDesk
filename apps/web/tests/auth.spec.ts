import { expect, test } from "@playwright/test";

test.describe("auth boundary", () => {
  test("unauthenticated visit to dashboard redirects to login", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByRole("heading", { name: "Log in" })).toBeVisible();
  });

  test("unauthenticated visit to a project route redirects to login", async ({ page }) => {
    await page.goto("/projects");
    await expect(page).toHaveURL(/\/login/);
  });
});
