import { attach, BASE } from "../demo-ui/lib.mjs";
const { page, browser } = await attach("form4");
await page.goto(BASE + "/projects/cd291c72-ebc9-4f16-8633-b7c9007507ed/forms", { waitUntil: "domcontentloaded" }); await page.waitForTimeout(3500);
await page.getByText("ZZ TEST water points checked").first().click(); await page.waitForTimeout(3000);
await page.getByText("Fill in", { exact: true }).first().click(); await page.waitForTimeout(3500);
console.log("FILL:", (await page.locator("main").innerText()).replace(/\n+/g," / ").replace(/^.*Templates \/ Team \/ Settings/,"").slice(0,700));
console.log("FIELDS:", await page.locator("main input:visible, main select:visible").evaluateAll(s=>s.map(x=>[x.type,x.getAttribute("aria-label")||(x.closest("label")?.innerText||"").slice(0,40)])));
await browser.close(); process.exit(0);
