import { createRequire } from "node:module";
const require = createRequire("/home/najeeb/Linux-Dev/Humanetarian/DonerDesk/apps/web/package.json");
const { chromium } = require("@playwright/test");
const b = await chromium.connectOverCDP("http://localhost:9333"); const page = b.contexts()[0].pages()[0]; page.setDefaultTimeout(30000);
await page.goto("https://donordesk.online/projects/f2a96a79-148d-4ec6-86d8-8bc58aeb90cb/reports/10002f71-f8b6-4a2e-a9c7-0cc1aee0cd60/inputs?tab=story"); await page.waitForTimeout(4000);
const tas = page.locator("main textarea"); const n = await tas.count(); console.log("textareas", n);
const A = [
 "In November the OTP and SFP sites in Upper Dir and Mardan opened on schedule and RUTF stocks held through the month.",
 "Early snow slowed two Upper Dir sites for a week; caregivers attended again once the road reopened.",
 "We moved MUAC screening days to market days in Takht Bhai, which raised attendance.",
 "Lady health workers in Katlang asked for a refresher on referral; one session was held.",
 "Next month we plan to add two outreach days in Wari and finish the stock check in Mardan.",
];
for (let i = 0; i < Math.min(n, 5); i++) { await tas.nth(i).fill(A[i]); await tas.nth(i).press("Tab"); await page.waitForTimeout(400); }
console.log(await page.locator("main").innerText().then((t) => t.match(/[^\n]*(Save|answered)[^\n]*/gi)?.slice(0, 5)));
const save = page.getByRole("button", { name: /^Save/ }).first(); if (await save.count()) { await save.click(); await page.waitForTimeout(4000); }
await b.close();
