import { attach, BASE } from "../demo-ui/lib.mjs";
const { page, browser } = await attach("dash2");
await page.goto(BASE + "/visuals/new", { waitUntil: "domcontentloaded" }); await page.waitForTimeout(4000);
await page.getByRole("button", { name: "Show how a project is progressing" }).click(); await page.waitForTimeout(1200);
await page.locator("label", { hasText: /^Results at a glance/ }).first().click(); await page.waitForTimeout(800);
console.log(await page.locator("main input:visible, main select:visible").evaluateAll(s=>s.slice(-14).map(x=>[x.tagName,x.type,x.name,x.id,(x.closest("label")?.innerText||x.previousElementSibling?.innerText||"").slice(0,30).replace(/\n/g," "),x.value.slice(0,15)])));
await browser.close(); process.exit(0);
