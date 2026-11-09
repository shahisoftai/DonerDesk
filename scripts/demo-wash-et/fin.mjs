import { attach, BASE } from "../demo-ui/lib.mjs";
const { page, browser } = await attach("fin");
page.setDefaultTimeout(15000);
await page.goto(`${BASE}/projects/cd291c72-ebc9-4f16-8633-b7c9007507ed/reports`, { waitUntil: "domcontentloaded" }); await page.waitForTimeout(4000);
const b = page.getByRole("button", { name: "Make this the final report" }); console.log("buttons", await b.count());
page.once("dialog", (d) => d.accept());
await b.first().click(); await page.waitForTimeout(2500);
const c = page.getByRole("button", { name: /^(Yes|Confirm|Make this the final report)/ }); if (await c.count()) { console.log("confirm"); await c.last().click(); await page.waitForTimeout(6000); }
console.log((await page.locator("main").innerText()).match(/Final[^\n]*/g));
await browser.close(); process.exit(0);
