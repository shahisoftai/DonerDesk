import { attach, BASE, dump } from "./lib.mjs"; import { readFileSync } from "node:fs";
const P = readFileSync("pid.txt", "utf8").trim(); const F = readFileSync("periods.txt","utf8").trim().split("\n")[5]; const { page, browser } = await attach();
await page.goto(`${BASE}/projects/${P}/reports/${F}`); await page.waitForLoadState("networkidle");
await page.getByRole("button", { name: "Generate report" }).click(); await page.waitForTimeout(3000);
console.log((await dump(page)).filter(l => /button/.test(l) && !/^a /.test(l)).map(l => l.split("|")[4]).join(", "));
const dlg = page.getByRole("dialog"); if (await dlg.count()) { console.log((await dlg.innerText()).slice(0, 600)); }
await page.screenshot({ path: "gen0.png" });
await browser.close(); process.exit(0);
