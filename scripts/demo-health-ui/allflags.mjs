import { attach, BASE } from "./lib.mjs"; import { readFileSync } from "node:fs";
const P = readFileSync("pid.txt","utf8").trim(); const per = readFileSync("periods.txt","utf8").trim().split("\n");
const { page, browser } = await attach();
await page.goto(`${BASE}/projects/${P}/reports/${per[Number(process.argv[2])]}`); await page.waitForLoadState("networkidle"); await page.waitForTimeout(3000);
const n = await page.locator("h2[id^=section-heading]").count();
for (let i = 0; i < n; i++) {
  const h = page.locator("h2[id^=section-heading]").nth(i); const title = (await h.innerText()).trim(); await h.scrollIntoViewIfNeeded(); await h.locator("button").click(); await page.waitForTimeout(900);
  const t = await page.locator("body").innerText(); const insp = t.slice(t.lastIndexOf("Section "));
  const blocks = insp.split("Needs a decision").slice(1).map(b => b.split(/Keep with a note|Leave out|Edit/)[0].trim().replace(/\n+/g, " ⏎ "));
  if (blocks.length) console.log("##", title, "\n  " + blocks.join("\n  ").slice(0, 1800));
}
await browser.close(); process.exit(0);
