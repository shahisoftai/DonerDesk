import { attach, BASE } from "../demo-ui/lib.mjs";
const { page, browser } = await attach("t3");
await page.goto(BASE + "/settings", { waitUntil: "networkidle" }); await page.waitForTimeout(1500);
const sec = page.locator("section[aria-labelledby=setup-assist-title]"); console.log(await sec.innerText());
await sec.locator("input[type=checkbox]").check(); await page.waitForTimeout(3000);
console.log(await sec.innerText(), await sec.locator("input[type=checkbox]").isChecked());
const ask = page.locator("section", {hasText:"Ask DonorDesk"}).first(); console.log((await ask.innerText().catch(()=>"")).slice(0,300));
await browser.close(); process.exit(0);
