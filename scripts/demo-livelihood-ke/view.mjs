import { attach, BASE } from "../demo-ui/lib.mjs"; import { readFileSync } from "node:fs";
const P = readFileSync("pid.txt","utf8").trim(); const { page, browser } = await attach("ke-view");
await page.goto(`${BASE}/projects/${P}${process.argv[2]}`); await page.waitForLoadState("networkidle"); await page.waitForTimeout(2500);
console.log((await page.locator("main").innerText()).replace(/\n+/g," | ").split("Settings |")[1]?.slice(0,+process.argv[3]||2000));
console.log(await page.getByRole("button").allInnerTexts().then(a=>a.filter(Boolean).slice(0,40)));
await browser.close(); process.exit(0);
