import { attach, BASE } from "../demo-ui/lib.mjs";
const { page, browser } = await attach("acceptall");
await page.goto(`${BASE}/projects/40d65f44-d771-4ee6-9edf-4c34a4cab5ac/activities?view=completed`, { waitUntil: "domcontentloaded" }); await page.waitForTimeout(4000);
const sel = page.getByText("Select all waiting", { exact: true });
if (await sel.count()) { await sel.click(); await page.waitForTimeout(800); const b = page.getByRole("button", { name: /^Accept \d+ selected/ }); console.log(await b.innerText()); await b.click(); await page.waitForTimeout(15000); }
console.log((await page.locator("main").innerText()).match(/\d+ records? accepted/)?.[0] ?? "no banner");
await browser.close(); process.exit(0);
