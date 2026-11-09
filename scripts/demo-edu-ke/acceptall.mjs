import { attach, BASE } from "../demo-ui/lib.mjs";
const { page, browser } = await attach("acceptall");
await page.goto(`${BASE}/projects/8e20556a-115e-48a7-be9b-bb1bfe14bf70/activities?view=completed`, { waitUntil: "domcontentloaded" }); await page.waitForTimeout(4000);
const sel = page.getByText("Select all waiting", { exact: true });
if (await sel.count()) { await sel.click(); await page.waitForTimeout(800); const b = page.getByRole("button", { name: /^Accept \d+ selected/ }); console.log(await b.innerText()); await b.click(); await page.waitForTimeout(15000); }
console.log((await page.locator("main").innerText()).match(/\d+ records? accepted/)?.[0] ?? "no banner");
await browser.close(); process.exit(0);
