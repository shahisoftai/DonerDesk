import { attach, BASE } from "../demo-ui/lib.mjs";
const { page, browser } = await attach("form1");
await page.goto(BASE + "/projects/cd291c72-ebc9-4f16-8633-b7c9007507ed/forms/new", { waitUntil: "domcontentloaded" }); await page.waitForTimeout(4000);
await page.getByLabel("Form name").fill("ZZ TEST water points checked");
await page.getByRole("button", { name: "Add a question" }).click(); await page.waitForTimeout(1200);
console.log("Q FIELDS:", await page.locator("main input:visible, main select:visible").evaluateAll(s=>s.slice(0,12).map(x=>[x.tagName,x.type,x.getAttribute("aria-label")||(x.closest("label")?.innerText||"").slice(0,30),x.value,x.tagName==="SELECT"?[...x.options].map(o=>o.text):""])));
await page.getByRole("button", { name: "Add an indicator" }).click(); await page.waitForTimeout(1200);
const t = (await page.locator("main").innerText()).replace(/\n+/g," / "); const i=t.indexOf("What the answers add up to"); console.log("MAP:", t.slice(i, i+900));
await browser.close(); process.exit(0);
