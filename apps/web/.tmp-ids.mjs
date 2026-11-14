import { chromium } from "@playwright/test";
const b = await chromium.connectOverCDP("http://127.0.0.1:9340");
const p = b.contexts()[0].pages()[0];
const hrefs = await p.$$eval('a[href^="/projects/"]', (as) => [...new Set(as.map((a) => a.getAttribute("href")))]);
console.log(hrefs.filter((h) => /^\/projects\/[^/]+$/.test(h)).join(" "));
await p.goto("https://donordesk.online" + hrefs.find((h) => /^\/projects\/[^/]+$/.test(h) && !h.endsWith("/new")) + "/reports", { waitUntil: "networkidle" });
const r = await p.$$eval('a[href*="/reports/"]', (as) => as.map((a) => a.getAttribute("href")).filter((h) => /reports\/[0-9a-f-]{20,}$/.test(h)));
console.log("REPORT", r[0]);
await b.close();
