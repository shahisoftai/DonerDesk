import { attach } from "../demo-ui/lib.mjs";
const { page, browser } = await attach("rep");
const rm = page.getByRole("button", { name: /^Remove/ }); console.log("removes", await rm.count());
await rm.nth(1).click(); await page.waitForTimeout(1500); await rm.nth(1).click(); await page.waitForTimeout(1500);
await page.getByLabel("Add a kind of report").selectOption({ label: "Semi-annual report" }); await page.waitForTimeout(1500);
console.log((await page.locator("main").innerText()).split("Each kind of report")[1].slice(0,700));
await browser.close(); process.exit(0);
