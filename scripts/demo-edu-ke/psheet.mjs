import { attach } from "../demo-ui/lib.mjs";
const { page, browser } = await attach("psheet"); page.setDefaultTimeout(20000);
const rows = `Name,Level,Inside,Latitude,Longitude,Code,Other spellings
Balambala,Community or site,Garissa County,0.09,39.85,,
Karare,Community or site,Marsabit County,2.33,37.98,,
Habaswein,Community or site,Wajir County,1.0167,39.4833,,
Rhamu,Community or site,Mandera County,3.9333,41.2167,,`;
const ta = page.locator("section[aria-labelledby=import-title] textarea"); console.log(await ta.count());
await ta.first().fill(rows); await page.waitForTimeout(800);
await page.getByRole("button", { name: "Check the sheet" }).click(); await page.waitForTimeout(6000);
const t = await page.locator("main").innerText(); console.log(t.slice(t.indexOf("Check the sheet")).slice(0,1200).replace(/\n+/g," | "));
await browser.close(); process.exit(0);
