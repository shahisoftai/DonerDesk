import { attach, BASE } from "../demo-ui/lib.mjs"; import { readFileSync, writeFileSync } from "node:fs";
const P = readFileSync("pid.txt","utf8").trim(); const { page, browser } = await attach("leads");
await page.goto(`${BASE}/projects/${P}/activities?view=planned`); await page.waitForLoadState("networkidle");
await page.getByRole("button", { name: "Whole project" }).click(); await page.waitForTimeout(800);
await page.getByRole("button", { name: "List" }).click(); await page.waitForTimeout(2000);
const items = await page.locator("a[href*='/activities/plan/'][href*='-']").evaluateAll(as => as.map(a => [a.getAttribute("href"), a.innerText.split("\n")[0]]));
writeFileSync("plan-items.json", JSON.stringify(items, null, 1));
const WHO = { "Train health": "Anita", "Counsel caregivers": "Sunita", "Form and support": "Sunita", "Deliver therapeutic": "Bikash" };
let n = 0;
for (const [href, title] of items) {
  const who = Object.entries(WHO).find(([k]) => title.startsWith(k))?.[1]; if (!who) continue;
  await page.goto(BASE + href); await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: "Change lead" }).click();
  const sel = page.getByLabel("Lead"); const opts = await sel.locator("option").allInnerTexts();
  await sel.selectOption({ label: opts.find(o => o.includes(who)) });
  await page.getByRole("button", { name: "Save", exact: true }).click(); await page.waitForTimeout(1500); n++;
}
console.log("leads changed", n, "of", items.length);
await browser.close(); process.exit(0);
