import { chromium } from "../demo-ui/lib.mjs";
const b = await chromium.launch(); const p = await (await b.newContext({ viewport: { width: 1200, height: 900 } })).newPage();
await p.goto("https://donordesk.online/signup", { waitUntil: "domcontentloaded" }); await p.waitForTimeout(3000);
console.log((await p.locator("body").innerText()).replace(/\n+/g," / ").slice(600, 2200));
console.log("LABELS:", (await p.locator("label").allInnerTexts()).map(s=>s.replace(/\n.*/s,"")).join(" | "));
await b.close();
