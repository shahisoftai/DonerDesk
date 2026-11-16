import { attach } from "../lib.mjs";
import { readFileSync } from "node:fs";
const { page, shot, browser } = await attach("s9");
page.setDefaultTimeout(15000);
const meta = JSON.parse(readFileSync(new URL("../inputs/meta.json", import.meta.url)));
const f = async (l, v, i = 0) => { const b = page.getByLabel(l, { exact: true }).nth(i); await b.fill(v); await b.press("Tab"); await page.waitForTimeout(150); };
while (await page.getByRole("button", { name: "Remove" }).count()) { await page.getByRole("button", { name: "Remove" }).first().click(); await page.waitForTimeout(1500); }
await f("From", "UNICEF"); await f("Amount", String(meta.total), 0); await f("Currency (three letters)", "USD", 0);
await page.getByRole("button", { name: "Add funding" }).click(); await page.waitForTimeout(2000);
for (const [n, a] of meta.budget) {
  await f("Budget line", n); await f("Amount", String(a), 1); await f("Currency (three letters)", "USD", 1);
  await page.getByRole("button", { name: "Add a budget line" }).click(); await page.waitForTimeout(1800);
}
const u = page.getByRole("button", { name: /Use USD/ }); if (await u.count()) await u.click(); await page.waitForTimeout(1500);
const t = await page.locator("main").innerText(); console.log(t.slice(t.indexOf("Funding"), t.indexOf("Funding") + 1500)); console.log(t.slice(t.indexOf("Still to answer")).slice(0, 300));
await shot("s9"); await browser.close();
