import { open, tabs, shot } from "./wz.mjs";
const { page, browser } = await open("wz3");
await page.getByRole("button", { name: /^2\. / }).click(); await page.waitForTimeout(1500);
console.log("fields:", await page.locator("main input, main select, main textarea").evaluateAll(s=>s.filter(x=>x.offsetParent).map(x=>[x.tagName, x.type, x.name||x.id, x.getAttribute("aria-label")||x.placeholder||"", x.value])));
console.log((await page.locator("main").innerText()).replace(/\n+/g," / ").split("Project and team /")[2]?.slice(0,1500));
await shot(page, "wz3");
await browser.close(); process.exit(0);
