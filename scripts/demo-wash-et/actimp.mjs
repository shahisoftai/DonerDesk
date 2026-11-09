import { attach, BASE } from "../demo-ui/lib.mjs";
const { page, browser } = await attach("actimp"); page.setDefaultTimeout(30000);
await page.goto(`${BASE}/projects/cd291c72-ebc9-4f16-8633-b7c9007507ed/activities/import`, { waitUntil: "domcontentloaded" }); await page.waitForTimeout(3500);
await page.locator("input[type=file]").first().setInputFiles(process.env.S + "/activities-all.xlsx"); await page.waitForTimeout(6000);
console.log((await page.locator("main").innerText()).match(/[^\n]*(row|Row|ready|match|problem|error)[^\n]*/gi)?.slice(0,8));
await page.screenshot({ path: process.env.SHOT, fullPage: false });
const b = page.getByRole("button", { name: /^Create activity records/ }); console.log(await b.allInnerTexts(), await b.first().isEnabled());
if (await b.first().isEnabled()) { await b.first().click(); await page.waitForTimeout(25000); console.log(page.url()); console.log((await page.locator("main").innerText()).slice(0,600)); }
await browser.close(); process.exit(0);
