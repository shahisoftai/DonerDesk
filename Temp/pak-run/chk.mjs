import { attach } from "./lib.mjs";
const { page, browser } = await attach("chk");
console.log((await page.locator("section[aria-roledescription='slide']").innerText()).split("Your documents")[1]?.slice(0,200));
await page.getByRole("button",{name:/^2\. /}).first().click(); await page.waitForTimeout(2000);
const v = await page.locator("section[aria-roledescription='slide'] input, section[aria-roledescription='slide'] textarea").evaluateAll(els=>els.slice(0,6).map(e=>(e.labels?.[0]?.innerText||e.id)+"="+e.value));
console.log(v.join("\n"));
await browser.close();
