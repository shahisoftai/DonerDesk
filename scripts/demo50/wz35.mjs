import { open, tabs, todo, shot } from "./wz.mjs";
const { page, browser } = await open("wz35");
await page.getByRole("button", { name: /^10\. / }).click(); await page.waitForTimeout(2500);
const nu = page.locator("main label").filter({ hasText: "Not used for this project" });
console.log(await nu.evaluateAll(l=>l.map(x=>(x.closest("section,fieldset,div[class*=rounded]")?.innerText||"").slice(0,40).replace(/\n/g," ") + "|checked=" + x.querySelector("input")?.checked)));
await browser.close(); process.exit(0);
