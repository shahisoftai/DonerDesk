import { attach, BASE } from "./lib.mjs"; import { readFileSync } from "node:fs";
const P = readFileSync("pid.txt", "utf8").trim(); const per = readFileSync("periods.txt","utf8").trim().split("\n"); const { page, browser } = await attach();
for (const [i, id] of per.entries()) { if (process.argv[2] && Number(process.argv[2]) !== i) continue;
  await page.goto(`${BASE}/projects/${P}/reports/${id}/inputs`); await page.waitForLoadState("networkidle");
  const b = page.getByRole("button", { name: /^Verify all/ }); const label = await b.innerText();
  if (!/\(0\)/.test(label)) { await b.click(); await page.waitForTimeout(5000); }
  const t = await page.locator("main").innerText(); console.log("period", i + 1, label, "->", (t.match(/\d\/8 verified/)||[""])[0], t.split("\n").filter(l=>/failed|could not/i.test(l)).join("|"));
}
await browser.close(); process.exit(0);
