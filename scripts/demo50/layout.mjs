// Moves and sizes blocks in the editor, one at a time, through the Build tab's place and size fields.
import fs from "node:fs";
import { attach } from "../demo-ui/lib.mjs";
const plan = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const { page, browser } = await attach("layout");
if (await page.getByRole("button", { name: "Edit", exact: true }).count() && !(await page.locator("#edit-drawer-shell").count())) await page.getByRole("button", { name: "Edit", exact: true }).first().click();
await page.waitForTimeout(1500);
for (const b of plan) {
  { const el = page.locator(`[data-block="${b.id}"]`).first(); await el.focus(); await el.press("Enter"); }
  await page.waitForTimeout(600);
  const edit = page.locator("#edit-drawer-shell");
  await edit.locator('button[data-tab="BUILD"]').click().catch(() => {});
  for (const [k, lab] of [["w", "Width"], ["h", "Height"], ["x", "Column"], ["y", "Row"]]) { const i = edit.getByLabel(lab, { exact: true }); await i.fill(String(b[k])); await i.press("Tab"); await page.waitForTimeout(300); }
  console.log(b.id, "->", b.x, b.y, b.w, b.h);
}
await browser.close(); process.exit(0);
