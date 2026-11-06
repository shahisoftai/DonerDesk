import { attach, BASE } from "../demo-ui/lib.mjs"; import { readFileSync } from "node:fs";
const P = readFileSync("pid.txt","utf8").trim(); const { page, browser } = await attach("ke-map");
await page.goto(`${BASE}/projects/${P}/maps`); await page.waitForLoadState("networkidle"); await page.waitForTimeout(7000);
const u=await page.locator("main").innerText();
console.log(u.match(/\d+ of \d+ places have a figure\./)?.[0], "|", u.match(/\d+ of \d+ photos[^\n]*/)?.[0]);
console.log(await page.getByRole("button").allInnerTexts().then(a=>a.filter(x=>/Kenya|Turkana|Marsabit|District|Province|County|Sub|World/i.test(x))));
await page.screenshot({path:"map1.png", clip:{x:200,y:330,width:1200,height:560}});
await browser.close(); process.exit(0);
