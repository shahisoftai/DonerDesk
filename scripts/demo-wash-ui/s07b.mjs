import { attach, BASE } from "./lib.mjs"; import { readFileSync } from "node:fs";
const P = readFileSync("pid.txt", "utf8").trim(); const { page, browser } = await attach();
for (const id of process.argv.slice(2)) {
  await page.goto(`${BASE}/projects/${P}/templates/${id}`); await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: /^▸Executive Summary/ }).click().catch(()=>{}); await page.waitForTimeout(800);
  await page.screenshot({ path: `tpl-${id.slice(0,4)}-open.png` });
  await page.getByRole("button", { name: "Accept all" }).click(); await page.waitForTimeout(1200);
  await page.getByRole("button", { name: "Save changes" }).click(); await page.waitForTimeout(2500);
  await page.getByRole("button", { name: "Approve template" }).click(); await page.waitForTimeout(3000);
  const ok = page.getByRole("button", { name: /^(Approve|Confirm)/ }); if (await ok.count() > 1) { await ok.last().click(); await page.waitForTimeout(2500); }
  const t = await page.locator("main").innerText(); console.log(id.slice(0,4), t.split("\n").filter(l=>/Approved|Needs review|reviewed|awaiting|Reviewed/.test(l)).slice(0,4).join(" | "));
}
await browser.close(); process.exit(0);
