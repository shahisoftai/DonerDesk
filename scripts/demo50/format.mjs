// Sets formatting through the Edit drawer's Format tab: opens a section and sets fields by their labels.
import fs from "node:fs";
import { attach } from "../demo-ui/lib.mjs";
const plan = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const { page, browser } = await attach("format");
const edit = page.locator("#edit-drawer-shell");
for (const b of plan) {
  const el = page.locator(`[data-block="${b.id}"]`).first(); await el.focus(); await el.press("Enter");
  await page.waitForTimeout(500);
  await edit.locator('button[data-tab="FORMAT"]').click();
  for (const s of b.sections) {
    const sec = edit.locator(`details[data-section="${s.cap}"]`);
    if ((await sec.getAttribute("open")) === null) await sec.locator("summary").click();
    for (const f of s.fields) {
      if (f.check !== undefined) { const c = sec.getByLabel(f.label, { exact: true }); if ((await c.isChecked()) !== f.check) await c.click(); }
      else if (f.select) await sec.getByLabel(f.label, { exact: true }).first().selectOption({ label: f.select });
      else if (f.slider !== undefined) await sec.getByLabel(f.label, { exact: true }).fill(String(f.slider));
      else if (f.hex) { const sel = sec.getByLabel(f.label, { exact: true }).first(); await sel.selectOption("custom"); await page.waitForTimeout(200); await sec.getByLabel("Custom colour").last().fill(f.hex); }
      await page.waitForTimeout(250);
    }
  }
  const msg = (await page.locator('p[role="alert"]').allTextContents()).join("/");
  console.log(b.id, "formatted", msg.slice(0, 160));
}
await browser.close(); process.exit(0);
