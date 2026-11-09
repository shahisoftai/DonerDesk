import { attach } from "../demo-ui/lib.mjs";
const { page, browser } = await attach("rep2"); page.setDefaultTimeout(15000);
const cad = page.getByLabel("Reports are made"); console.log("cadence", await cad.evaluate(e=>e.selectedOptions[0]?.text));
await cad.selectOption({ label: "Every month" }); await page.waitForTimeout(1500);
const add = page.getByLabel("Add a kind of report"); console.log(await add.evaluate(e=>[...e.options].map(o=>o.textContent.trim())));
const has = (await page.locator("main").innerText()).includes("Monthly report\nRemove");
if (!has) { await add.selectOption({ label: "Monthly report" }).catch(()=>console.log("no monthly option")); await page.waitForTimeout(1500); }
const d = page.getByLabel("Due (days after the period ends)"); console.log(await d.evaluateAll(a=>a.map(x=>x.value)));
const lay = page.getByLabel("Layout"); for (let i=0;i<await lay.count();i++){ await lay.nth(i).selectOption({label:"The standard layout"}); await page.waitForTimeout(400);} 
for (let i=0;i<await d.count();i++){ const v = await d.nth(i).inputValue(); if (!v) { await d.nth(i).fill("30"); await d.nth(i).blur(); await page.waitForTimeout(600);} }
console.log(await d.evaluateAll(a=>a.map(x=>x.value)));
console.log((await page.locator("main").innerText()).match(/The reporting calendar[\s\S]{0,700}/)?.[0]);
await browser.close(); process.exit(0);
