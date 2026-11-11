// Adds one block through the editor's Add drawer, then sets its settings (Advanced JSON), place and size (Build tab), all as a person would.
import fs from "node:fs";
import { attach } from "../demo-ui/lib.mjs";
const spec = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const { page, browser } = await attach("addblock");
for (const b of spec) {
  const add = page.locator("#add-drawer-shell");
  if (!(await add.count())) await page.getByRole("button", { name: "Add", exact: true }).click();
  await add.locator(`button[data-kind="${b.kind}"]`).first().click();
  await page.waitForTimeout(800);
  const edit = page.locator("#edit-drawer-shell");
  await edit.locator('button[data-tab="BUILD"]').click().catch(() => {});
  const adv = edit.locator("details", { hasText: "Advanced: all settings as text" });
  await adv.locator("summary").click();
  await adv.getByLabel("All settings as text").fill(JSON.stringify(b.props));
  await page.waitForTimeout(400);
  for (const [k, lab] of [["x", "Column"], ["y", "Row"], ["w", "Width"], ["h", "Height"]]) if (b[k] !== undefined) { const i = edit.getByLabel(lab, { exact: true }); await i.fill(String(b[k])); await i.press("Tab"); await page.waitForTimeout(250); }
  const probs = await edit.locator('[role="status"]').allTextContents();
  console.log(b.kind, "added", probs.join(" | ").slice(0, 200));
  await adv.locator("summary").click().catch(() => {});
}
await browser.close(); process.exit(0);
