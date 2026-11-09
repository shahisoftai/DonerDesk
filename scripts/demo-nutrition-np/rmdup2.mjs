import { attach } from "../demo-ui/lib.mjs";
const { page, browser } = await attach("rmdup2");
const rm = page.getByRole("button", { name: /^Remove/ });
console.log("remove buttons", await rm.count());
for (let k = 0; k < 26; k++) { await rm.nth(26).click(); await page.waitForTimeout(1800); }
console.log("after", await rm.count());
await browser.close(); process.exit(0);
