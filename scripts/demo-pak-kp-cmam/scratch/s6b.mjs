import { attach } from "../lib.mjs";
import { readFileSync } from "node:fs";
const { page, shot, browser } = await attach("s6b");
page.setDefaultTimeout(15000);
const rows = readFileSync(new URL("../inputs/workplan.csv", import.meta.url), "utf8").trim().split("\n").slice(1).map(l => (l.match(/("([^"]*)"|[^,]*)(,|$)/g) || []).map(x => x.replace(/,$/, "").replace(/^"|"$/g, "")));
const names = { "ayesha.khan": "Dr. Ayesha Khan", "imran.yousafzai": "Imran Yousafzai", "gul.rehman": "Gul Rehman", "nasreen.akhtar": "Nasreen Akhtar", "zahid.ali": "Zahid Ali", "farah.naz": "Farah Naz" };
const lead = page.getByLabel("Led by", { exact: true });
const where = page.locator("fieldset").filter({ has: page.locator("legend", { hasText: /^Where$/ }) });
const feeds = page.locator("fieldset").filter({ has: page.locator("legend", { hasText: /^Feeds indicators$/ }) });
const extra = (title) => /OTP treatment/.test(title) ? ["OC1-1","OC1-2","OC1-3","OC1-4"] : /SFP treatment of MAM/.test(title) ? ["OC1-5","OC1-6","OC1-7","OC1-8"] : /Stabilisation centre/.test(title) ? ["OC1-9","OC1-10","OC1-11"] : [];
for (let i = 0; i < rows.length; i++) {
  const [, title, , , email, loc] = rows[i];
  const opts = await lead.nth(i).locator("option").allInnerTexts();
  await lead.nth(i).selectOption({ label: opts.find(o => o.startsWith(names[email.split("@")[0]])) }); await page.waitForTimeout(200);
  const cb = where.nth(i).locator("label").filter({ hasText: new RegExp("^\\s*" + loc + "\\s*$") }).locator("input");
  if (!(await cb.isChecked())) { await cb.click(); await page.waitForTimeout(300); }
  for (const code of extra(title)) { const c = feeds.nth(i).locator("label").filter({ hasText: new RegExp("^\\s*" + code + " ·") }).locator("input"); if (!(await c.isChecked())) { await c.click(); await page.waitForTimeout(250); } }
  if (i % 5 == 4) console.log("done", i + 1);
}
const t = await page.locator("main").innerText(); console.log(t.slice(t.indexOf("Still to answer")).slice(0, 500));
await shot("s6b"); await browser.close();
