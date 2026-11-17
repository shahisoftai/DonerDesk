import { createRequire } from "node:module";
const require = createRequire("/home/najeeb/Linux-Dev/Humanetarian/DonerDesk/apps/web/package.json");
const { chromium } = require("@playwright/test");
const b = await chromium.connectOverCDP("http://localhost:9333"); const page = b.contexts()[0].pages()[0];
for (const p of process.argv.slice(2)) {
  await page.goto("https://donordesk.online" + p); await page.waitForTimeout(4500);
  const r = await page.evaluate(() => [...document.querySelectorAll("main .animate-fade-in, main .page-stack, [data-tour-id]")].map((e) => { const r = e.getBoundingClientRect(); const depth = (() => { let d = 0, n = e; while (n && n !== document.body) { d++; n = n.parentElement; } return d; })(); return `${e.tagName}.${String(e.className).slice(0, 40)} d${depth} ${Math.round(r.width)}x${Math.round(r.height)} ${e.getAttribute("data-tour-id") || ""}`; }));
  console.log(p, "\n  " + r.join("\n  "));
}
await b.close();
