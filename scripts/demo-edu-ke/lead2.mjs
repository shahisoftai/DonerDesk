import { attach } from "../demo-ui/lib.mjs";
const { page, browser } = await attach("lead2"); page.setDefaultTimeout(15000);
await page.getByRole("button", { name: "Apply to 15" }).click(); await page.waitForTimeout(6000);
console.log((await page.locator("main").innerText()).match(/No lead yet|Najeeb[^\n]*/g)?.slice(0,3));
await browser.close(); process.exit(0);
