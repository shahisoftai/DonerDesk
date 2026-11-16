import { attach } from "../lib.mjs";
import { readFileSync } from "node:fs";
const { page, shot, browser } = await attach("s9b");
page.setDefaultTimeout(15000);
const meta = JSON.parse(readFileSync(new URL("../inputs/meta.json", import.meta.url)));
const fs = page.locator("fieldset").filter({ has: page.locator("legend", { hasText: "Add a budget line" }) });
for (const [n, a] of meta.budget) {
  for (const [l, v] of [["Budget line", n], ["Amount", String(a)], ["Currency (three letters)", "USD"]]) { const b = fs.getByLabel(l, { exact: true }); await b.fill(v); await b.press("Tab"); await page.waitForTimeout(150); }
  await fs.getByRole("button", { name: "Add a budget line" }).click(); await page.waitForTimeout(2000);
}
const u = page.getByRole("button", { name: /Use USD/ }); if (await u.count()) await u.click(); await page.waitForTimeout(1500);
const t = await page.locator("main").innerText(); console.log(t.slice(t.indexOf("Budget\n"), t.indexOf("Budget\n") + 900)); console.log(t.slice(t.indexOf("Does it add up"), t.indexOf("Does it add up") + 400)); console.log(t.slice(t.indexOf("Still to answer")).slice(0, 300));
await shot("s9b"); await browser.close();
