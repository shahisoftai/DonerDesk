import { attach, BASE } from "./lib.mjs"; import { readFileSync } from "node:fs";
const P = readFileSync("pid.txt", "utf8").trim(); const { page, browser } = await attach();
const ids = []; const M = [["2026-03-01","2026-03-31","2026-04-10"],["2026-04-01","2026-04-30","2026-05-10"],["2026-05-01","2026-05-31","2026-06-10"],["2026-06-01","2026-06-30","2026-07-10"],["2026-07-01","2026-07-31","2026-08-10"]];
for (const [s, e, d] of M) {
  await page.goto(`${BASE}/projects/${P}/reports/new`); await page.waitForLoadState("networkidle");
  await page.getByLabel("Report type").selectOption({ label: "Monthly report" });
  await page.getByLabel("Donor template").selectOption({ label: "GWHF Monthly Progress Report" });
  await page.getByLabel("Start date").fill(s); await page.getByLabel("End date").fill(e); await page.getByLabel("Donor deadline").fill(d);
  await page.getByRole("button", { name: "Create period" }).click();
  await page.waitForTimeout(3500);
  ids.push(page.url().split("/").pop()); console.log(s, page.url().replace(BASE, ""), (await page.locator("main").innerText()).split("\n").filter(l=>/overlap|error|cannot|already|must/i.test(l)).slice(0,2).join(" | "));
}
(await import("node:fs")).writeFileSync("periods.txt", ids.join("\n")+"\n");
await page.goto(`${BASE}/projects/${P}/reports`); await page.waitForLoadState("networkidle");
console.log((await page.locator("main").innerText()).slice(0,1800));
await browser.close(); process.exit(0);
