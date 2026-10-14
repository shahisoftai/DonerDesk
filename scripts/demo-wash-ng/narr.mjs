import { attach, BASE, dump } from "../demo-ui/lib.mjs"; import { readFileSync } from "node:fs";
const P = readFileSync("pid.txt","utf8").trim(); const { page, browser } = await attach("narr");
await page.goto(`${BASE}/projects/${P}/activities/new`); await page.waitForLoadState("networkidle"); await page.waitForTimeout(1500);
const fresh = page.getByRole("button", { name: "Start fresh" }); if (await fresh.count()) { await fresh.click(); await page.waitForTimeout(800); }
await page.getByRole("button", { name: /Tell it in your own words/ }).click(); await page.waitForTimeout(800);
console.log((await dump(page)).filter(l=>/textarea|button/.test(l)&&!/^a /.test(l)&&/words|Fill|Apply|Use|narrative|Dictate/i.test(l)).join("\n"));
const ta = page.locator("textarea").first();
await ta.fill("On 9 February 2026 in Konduga town we completed the contractor selection and the hydrogeological survey. Six borehole sites were surveyed with community leaders and the Ministry of Water Resources. 24 people attended the site meeting, 9 women and 15 men. The contractor mobilised late and the rig only arrived in the last week. Next we will start drilling at the first two sites.");
await page.waitForTimeout(500);
const b = page.getByRole("button", { name: /Fill the form|Fill form|Apply|Suggest|Use this/i }); console.log("fill buttons:", await b.allInnerTexts());
if (await b.count()) { await b.first().click(); await page.waitForTimeout(1500); }
console.log("values:", JSON.stringify(await page.evaluate(() => Object.fromEntries([...document.querySelectorAll("form input, form textarea, form select")].filter(e => e.name).map(e => [e.name, (e.value||"").slice(0,70)])))));
console.log((await page.locator("main").innerText()).replace(/\n+/g," | ").slice(0,900));
await page.screenshot({path:"shot-narr.png"});
await browser.close(); process.exit(0);
