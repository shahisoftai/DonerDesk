import { attach, BASE } from "../demo-ui/lib.mjs"; import { readFileSync } from "node:fs";
const P = readFileSync("pid.txt","utf8").trim(); const per = readFileSync("periods.txt","utf8").trim().split("\n"); const id = per[Number(process.argv[2])]; const types = (process.argv[3] ?? "Word document").split(",");
const { page, browser } = await attach("exportfull");
for (const ty of types) {
  await page.goto(`${BASE}/projects/${P}/reports/${id}`); await page.waitForLoadState("networkidle"); await page.waitForTimeout(2000);
  await page.getByRole("button", { name: "Export report" }).first().click(); await page.waitForTimeout(3000);
  const d = page.locator("[role=dialog]").first();
  await d.getByLabel("Export type").selectOption({ label: ty }).catch(e => console.log("type?", ty, String(e).slice(0,60)));
  await d.getByRole("button", { name: /^Next/ }).first().click(); await page.waitForTimeout(1500);
  const sa = d.getByRole("button", { name: "Select all verified" }); if (await sa.count()) await sa.click();
  await d.getByRole("button", { name: /^Next/ }).first().click(); await page.waitForTimeout(1500);
  const warn = (await d.innerText()).replace(/\n+/g," | ").split("Report version")[1]?.slice(0,260);
  await d.getByRole("button", { name: /Create export/ }).click(); await page.waitForTimeout(9000);
  console.log(ty, "=>", (await d.innerText().catch(()=>"(gone)")).replace(/\n+/g," | ").split("Report version")[1]?.slice(0,260) ?? "?", "| PRE:", warn);
}
await browser.close(); process.exit(0);
