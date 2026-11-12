import { attach, BASE } from "../demo-ui/lib.mjs";
const { page, browser } = await attach("unclassic");
await page.goto(BASE + "/projects/8e20556a-115e-48a7-be9b-bb1bfe14bf70/reports/b31e987c-08db-4c41-af79-8ac33d39945e", { waitUntil: "domcontentloaded" }); await page.waitForTimeout(4000);
const btns = await page.locator("main button, main a").allInnerTexts();
console.log([...new Set(btns.map(b=>b.trim().replace(/\s+/g," ")).filter(Boolean))].slice(0,40).join(" | "));
const sw = page.getByText(/Switch to (new|the new|simple|focus)[^|]*/i).first();
if (await sw.count()) { await sw.click(); await page.waitForTimeout(3000); console.log("clicked switch"); }
else { const more = page.getByRole("button",{name:/More actions|⋯|menu/i}).first(); if (await more.count()) { await more.click(); await page.waitForTimeout(500); console.log("MENU:", await page.locator("[role=menu]").innerText().catch(()=>"")); } }
console.log("NOW:", (await page.locator("main").innerText()).replace(/\n+/g," / ").slice(560,800));
await browser.close(); process.exit(0);
