// Phase 25 verification: the screens and flows this phase changed, on a labelled scratch project that is left in place
// (archive it from the project settings afterwards). Needs the browser from `scripts/demo-ui/README.md` already logged in.
//   node scripts/demo-ui/phase25-check.mjs
import { attach, BASE, step, text, waitForUi } from "./lib.mjs";
import assert from "node:assert/strict";

const { page, browser } = await attach("phase25-check");
const results = [];
const run = (name, work) => step(name, work, { results });
const stamp = Date.now().toString(36);

try {
  await run("billing page loads (D5-5)", async () => {
    await page.goto(`${BASE}/settings/billing`, { waitUntil: "networkidle" });
    assert.match(await text(page), /Current plan/);
  });
  await run("AI usage lists section runs", async () => {
    await page.goto(`${BASE}/settings/ai-usage`, { waitUntil: "networkidle" });
    assert.match(await text(page), /The last \d+ sections/);
  });

  let projectUrl;
  await run("create a project with a double click: one project", async () => {
    await page.goto(`${BASE}/projects/new`, { waitUntil: "networkidle" });
    await page.getByLabel("Project title").fill(`[P25-CHECK ${stamp}] scratch`);
    await page.getByLabel("Project code").fill(`P25-${stamp}`.slice(0, 20));
    await page.getByLabel("Donor name").fill("Check Donor");
    await page.getByLabel("Implementing organization").fill("Check Org");
    await page.getByRole("button", { name: "Next" }).click();
    await page.getByLabel("Country").fill("Kenya");
    await page.getByLabel("Sector").selectOption({ label: "Health" });
    await page.getByLabel("Start date").fill("2026-01-01");
    await page.getByLabel("End date").fill("2026-12-31");
    await page.getByRole("button", { name: "Next" }).click();
    await page.getByLabel("Reporting frequency").selectOption({ label: "Monthly" });
    await page.getByRole("button", { name: "Create project" }).dblclick();
    await page.waitForURL(/\/projects\/[0-9a-f-]+\/setup/, { timeout: 60000 });
    projectUrl = page.url().replace(/\/setup.*/, "");
    await page.goto(`${BASE}/projects?search=P25-CHECK%20${stamp}`, { waitUntil: "networkidle" });
    const hrefs = new Set(await page.locator("a", { hasText: `[P25-CHECK ${stamp}]` }).evaluateAll((a) => a.map((x) => x.getAttribute("href"))));
    assert.equal(hrefs.size, 1);
  });

  await run("labels: every select on the evidence upload form has an accessible name", async () => {
    await page.goto(`${projectUrl}/evidence/new`, { waitUntil: "networkidle" });
    const unlabeled = await page.locator("main select").evaluateAll((els) => els.filter((e) => !(e.labels?.length || e.getAttribute("aria-label"))).length);
    assert.equal(unlabeled, 0);
  });

  await run("templates page: per-type defaults render", async () => {
    await page.goto(`${projectUrl}/templates`, { waitUntil: "networkidle" });
    assert.match(await text(page), /Donor templates/);
  });
  console.log(`\n${results.filter((r) => r.ok).length}/${results.length} steps passed. Scratch project: ${projectUrl}`);
} catch {
  process.exitCode = 1;
} finally {
  await browser.close();
}
