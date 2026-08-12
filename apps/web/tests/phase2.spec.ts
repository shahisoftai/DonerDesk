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

test("forgot-password page gives honest support guidance and no simulated email form", async ({ page }) => {
  await page.goto("/forgot-password");
  await expect(page.getByRole("heading", { name: "Reset your password" })).toBeVisible();
  await expect(page.getByText(/Self-service reset is not available yet/)).toBeVisible();
  await expect(page.getByRole("link", { name: "Back to log in" })).toBeVisible();
});

test("project wizard guides through identity, geography, then reporting steps", async ({ page }) => {
  await page.goto("/projects/new");
  await expect(page.getByRole("heading", { name: "Create a project" })).toBeVisible();
  await page.getByLabel("Project title").fill("Community Nutrition Project");
  await page.getByLabel("Project code").fill("CNP-2026");
  await page.getByLabel("Donor name").fill("Example Donor");
  await page.getByLabel("Implementing organization").fill("Example Org");
  await page.getByRole("button", { name: "Next" }).click();
  await expect(page.getByLabel("Country")).toBeVisible();
  await page.getByLabel("Country").fill("Somalia");
  await page.getByLabel("Start date").fill("2026-01-01");
  await page.getByLabel("End date").fill("2027-12-31");
  await page.getByRole("button", { name: "Next" }).click();
  await expect(page.getByText("Review")).toBeVisible();
  await expect(page.getByRole("button", { name: "Back" })).toBeEnabled();
});

test("onboarding page renders a heading and handles data load gracefully", async ({ page }) => {
  await page.goto("/onboarding");
  await expect(page.getByRole("heading", { name: "Set up your workspace" })).toBeVisible();
});
