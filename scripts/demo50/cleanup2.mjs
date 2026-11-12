import { attach, BASE } from "../demo-ui/lib.mjs";
const { page, browser } = await attach("cleanup2");
await page.goto(BASE + "/projects/14d6f13d-34ee-47ef-9d64-d16595e3e690/reports/e8df4e42-7295-4f43-b34b-1018f2b4275f/inputs?tab=indicators", { waitUntil: "domcontentloaded" }); await page.waitForTimeout(7000);
const body = await page.locator("main").innerText();
console.log("has ZZ TEST in page:", /ZZ TEST/.test(body));
// sheet view row values
const row = page.locator("tr", { hasText: "OP1-1a" }).first();
console.log("SHEET ROW:", (await row.innerText()).replace(/\s+/g," ").slice(0, 300));
console.log("Statuses:", (await page.locator("main").innerText()).match(/(\d+) values still being entered[^.]*\./)?.[0]);
// audit trail for recent events
await page.goto(BASE + "/settings/audit", { waitUntil: "domcontentloaded" }); await page.waitForTimeout(4500);
console.log((await page.locator("main").innerText()).replace(/\n+/g," / ").slice(0, 1600));
await browser.close(); process.exit(0);
