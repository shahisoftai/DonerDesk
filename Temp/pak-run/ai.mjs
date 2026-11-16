import { attach, BASE } from "./lib.mjs";
const { page, shot, browser } = await attach("ai");
for (const p of ["/settings/ai/usage","/settings/ai-usage","/settings/usage"]) { const r=await page.goto(BASE+p); await page.waitForTimeout(2000); const t=await page.locator("main").innerText(); if(/model|provider|AI/i.test(t)){ console.log(p); console.log(t.slice(0,2500)); await shot("ai"); break; } }
await browser.close();
