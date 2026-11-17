// node export-sheet.mjs <out.xlsx> : downloads the November period's indicator sheet of the tour project
import { createRequire } from "node:module"; import fs from "node:fs";
const require = createRequire("/home/najeeb/Linux-Dev/Humanetarian/DonerDesk/apps/web/package.json");
const { chromium } = require("@playwright/test");
const PID = "f2a96a79-148d-4ec6-86d8-8bc58aeb90cb";
const b = await chromium.connectOverCDP("http://localhost:9333"); const page = b.contexts()[0].pages()[0];
await page.goto(`https://donordesk.online/projects/${PID}/reports`); await page.waitForTimeout(3500);
const hrefs = await page.locator("a[href*='/reports/']").evaluateAll((as) => as.map((a) => [a.getAttribute("href"), a.closest("div")?.innerText ?? ""]));
const nov = await page.evaluate(() => { const card = [...document.querySelectorAll("a")].find((a) => /Enter indicator data/.test(a.innerText) && /Nov 1, 2026/.test(a.closest("div[class]")?.parentElement?.innerText ?? "")); return card?.getAttribute("href"); });
console.log("nov link", nov);
const id = nov?.match(/reports\/([0-9a-f-]{36})/)?.[1]; console.log("period", id);
await page.goto(`https://donordesk.online/projects/${PID}/reports/${id}/inputs?tab=indicators`); await page.waitForTimeout(4000);
const b64 = await page.evaluate(async (p) => { const r = await fetch(`/api/reporting-periods/${p}/indicator-sheet/export`); const buf = new Uint8Array(await r.arrayBuffer()); let s = ""; for (const x of buf) s += String.fromCharCode(x); return btoa(s); }, id);
fs.writeFileSync(process.argv[2], Buffer.from(b64, "base64")); fs.writeFileSync(process.argv[2] + ".period", id);
await b.close();
