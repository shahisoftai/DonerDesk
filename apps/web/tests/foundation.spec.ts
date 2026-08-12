import { expect, test } from "@playwright/test";

test("login foundation is accessible and keyboard-operable", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: "Log in" })).toBeVisible();
  await expect(page.getByLabel("Email")).toHaveAttribute("type", "email");
  await expect(page.getByLabel("Password")).toHaveAttribute("type", "password");
  await page.keyboard.press("Tab");
  await expect(page.locator(":focus")).toBeVisible();
});
