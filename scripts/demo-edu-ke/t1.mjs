import { attach, BASE } from "../demo-ui/lib.mjs";
const { page, browser } = await attach("t1");
await page.goto(BASE + "/onboarding", { waitUntil: "networkidle" }); await page.waitForTimeout(3000);
await page.getByLabel(/I have read and accept/).click();
await page.waitForTimeout(500);
const b = page.getByRole("button", { name: "Accept and finish setup" }); console.log("enabled", await b.isEnabled());
await b.click({timeout:8000}); await page.waitForTimeout(5000);
console.log((await page.locator("main").innerText()).slice(0,400));
await browser.close(); process.exit(0);
