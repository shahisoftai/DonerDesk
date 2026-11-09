import { attach, BASE } from "../demo-ui/lib.mjs";
const { page, browser } = await attach("mk3"); page.setDefaultTimeout(15000);
await page.goto(BASE+"/dashboards/templates", { waitUntil: "domcontentloaded" }); await page.waitForTimeout(3000);
await page.getByLabel("Water, sanitation and hygiene", { exact: true }).getByRole("button", { name: "Use this template" }).first().click(); await page.waitForTimeout(2500);
console.log(await page.evaluate(() => [...document.querySelectorAll("main select")].map((s,i)=>i+": "+(s.getAttribute("aria-label")||s.name||s.id))));
await browser.close(); process.exit(0);
