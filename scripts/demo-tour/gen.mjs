import { createRequire } from "node:module";
const require = createRequire("/home/najeeb/Linux-Dev/Humanetarian/DonerDesk/apps/web/package.json");
const { chromium } = require("@playwright/test");
const b = await chromium.connectOverCDP("http://localhost:9333"); const page = b.contexts()[0].pages()[0]; page.setDefaultTimeout(30000);
await page.goto("https://donordesk.online/projects/f2a96a79-148d-4ec6-86d8-8bc58aeb90cb/reports/10002f71-f8b6-4a2e-a9c7-0cc1aee0cd60"); await page.waitForTimeout(4000);
const g = page.getByRole("button", { name: /^Generate report/ }).first(); console.log("generate", await g.count()); await g.click();
for (let i = 0; i < 40; i++) { await page.waitForTimeout(5000); const t = await page.locator("main").innerText(); if (/Regenerate|Needs review|Draft ready|failed|could not|unavailable/i.test(t) && !/Generating|being written/i.test(t)) { console.log(t.match(/[^\n]*(Regenerate|Needs review|Draft ready|failed|could not|unavailable)[^\n]*/i)?.[0]); break; } }
await page.screenshot({ path: "/tmp/claude-1000/look.png" }); await b.close();
