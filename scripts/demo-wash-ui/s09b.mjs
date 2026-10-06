import { attach, BASE } from "./lib.mjs"; import { readFileSync } from "node:fs";
const P = readFileSync("pid.txt", "utf8").trim(); const { page, browser } = await attach();
for (const role of ["Project Manager", "M&E Officer"]) {
  await page.goto(`${BASE}/projects/${P}/team`); await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: "Assign member" }).click(); await page.waitForTimeout(600);
  await page.locator("#assign-user").selectOption({ index: 1 }); await page.locator("#assign-role").selectOption({ label: role });
  await page.getByRole("button", { name: "Assign", exact: true }).click(); await page.waitForTimeout(2500);
  console.log(role, "->", (await page.locator("main").innerText()).split("\n").filter(l=>/active member|already|error|Project Manager|M&E/i.test(l)).slice(0,4).join(" | "));
}
await browser.close(); process.exit(0);
