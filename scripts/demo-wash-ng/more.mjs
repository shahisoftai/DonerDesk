import { attach, BASE, dump } from "../demo-ui/lib.mjs"; import { readFileSync } from "node:fs";
const P = readFileSync("pid.txt","utf8").trim(); const per = readFileSync("periods.txt","utf8").trim().split("\n"); const { page, browser } = await attach("more");
await page.goto(`${BASE}/projects/${P}/reports/${per[Number(process.argv[2])]}`); await page.waitForLoadState("networkidle"); await page.waitForTimeout(2000);
const t = await page.locator("body").innerText(); console.log(t.slice(t.indexOf("Draft\nVersion"), t.indexOf("OUTLINE")).replace(/\n+/g," | "));
await page.getByRole("button", { name: "More actions" }).click(); await page.waitForTimeout(800);
console.log((await page.locator("[role=menu], [role=menuitem]").allInnerTexts()).join(" // "));
await browser.close(); process.exit(0);
