import { open, tabs, todo, shot } from "./wz.mjs";
const { page, browser } = await open("wz36");
await page.getByRole("button", { name: /^10\. / }).click(); await page.waitForTimeout(2500);
const nu = page.locator("main label").filter({ hasText: "Not used for this project" });
await nu.nth(0).click(); await page.waitForTimeout(1200); await nu.nth(1).click(); await page.waitForTimeout(2500);
console.log(await nu.evaluateAll(l=>l.map(x=>x.querySelector("input")?.checked)));
console.log(await tabs(page)); console.log((await todo(page))?.slice(0,200));
const so = page.getByRole("button", { name: "Sign off" }); console.log("sign off enabled:", await so.isEnabled());
if (await so.isEnabled()) { await so.click(); await page.waitForTimeout(3500); }
const t = (await page.locator("main").innerText()).replace(/\n+/g," / "); const i=t.indexOf("Sign off"); console.log(t.slice(i, i+700));
await shot(page, "wz36");
await browser.close(); process.exit(0);
