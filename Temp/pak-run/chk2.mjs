import { attach } from "./lib.mjs";
const { page, shot, browser } = await attach("chk2");
await page.reload(); await page.waitForTimeout(4000);
await page.getByRole("button",{name:/^2\. /}).first().click(); await page.waitForTimeout(2500);
const v = await page.locator("section[aria-roledescription='slide'] input, section[aria-roledescription='slide'] textarea").evaluateAll(els=>els.slice(0,6).map(e=>(e.labels?.[0]?.innerText||e.id)+"="+e.value));
console.log(v.join("\n")); await shot("chk2");
await browser.close();
