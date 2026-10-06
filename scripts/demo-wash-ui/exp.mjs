import { attach, BASE } from "./lib.mjs"; import { readFileSync } from "node:fs";
const P = readFileSync("pid.txt", "utf8").trim(); const F = readFileSync("periods.txt","utf8").trim().split("\n")[5]; const { page, browser } = await attach();
for (const type of process.argv.slice(2)) {
  await page.goto(`${BASE}/projects/${P}/reports/${F}`); await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: "More actions" }).click(); await page.getByRole("menuitem", { name: /Download draft/ }).click(); await page.waitForTimeout(2500);
  const d = page.getByRole("dialog"); await d.getByRole("button", { name: "Download draft anyway" }).click(); await page.waitForTimeout(1500);
  await d.getByLabel("Export type").selectOption({ label: type }); await d.getByRole("button", { name: "Next: files" }).click(); await page.waitForTimeout(1500);
  await d.getByRole("button", { name: "Next: review" }).click(); await page.waitForTimeout(1500);
  await d.getByRole("button", { name: "Create export" }).click(); await d.getByRole("link", { name: "Download" }).waitFor({ timeout: 90000 });
  const dlP = page.waitForEvent("download", { timeout: 60000 }).catch(() => null); await d.getByRole("link", { name: "Download" }).click();
  const dl = await dlP; if (dl) { await dl.saveAs("out/" + dl.suggestedFilename()); console.log("saved", type, "->", dl.suggestedFilename()); } else console.log("no download for", type);
}
await browser.close(); process.exit(0);
