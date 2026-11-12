import { attach, BASE } from "../demo-ui/lib.mjs";
const { page, browser } = await attach("assign");
await page.goto(BASE + "/projects/cd291c72-ebc9-4f16-8633-b7c9007507ed/team", { waitUntil: "domcontentloaded" }); await page.waitForTimeout(4000);
await page.getByRole("button", { name: "Assign member" }).first().click(); await page.waitForTimeout(1000);
console.log("FORM:", await page.locator("main select:visible, main input:visible").evaluateAll(s=>s.slice(0,6).map(x=>[x.tagName,x.name||x.id,x.tagName==="SELECT"?[...x.options].map(o=>o.text.slice(0,50)):""])));
for (const [who, role] of [["ZZ Test PM", null], ["ZZ Test Field", null]]) {
  const sels = page.locator("main select:visible"); 
  await sels.nth(0).selectOption({ label: (await sels.nth(0).locator("option").allInnerTexts()).find(o=>o.includes(who)) });
  const roleSel = sels.nth(1); console.log("roles:", await roleSel.locator("option").allInnerTexts());
  await roleSel.selectOption({ index: 1 });
  await page.getByRole("button", { name: /Assign member|Assign/ }).last().click(); await page.waitForTimeout(2500);
  const m = page.getByRole("button", { name: "Assign member" }).first(); if (await m.count()) await m.click().catch(()=>{}); await page.waitForTimeout(800);
}
console.log((await page.locator("main").innerText()).replace(/\n+/g," / ").slice(0,700));
await browser.close(); process.exit(0);
