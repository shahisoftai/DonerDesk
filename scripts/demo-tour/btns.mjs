import { createRequire } from "node:module";
const require = createRequire("/home/najeeb/Linux-Dev/Humanetarian/DonerDesk/apps/web/package.json");
const { chromium } = require("@playwright/test");
const b = await chromium.connectOverCDP("http://localhost:9333"); const page = b.contexts()[0].pages()[0];
await page.setInputFiles("input[type=file]", "/tmp/claude-1000/tour-files/otp-register-upper-dir-nov.jpg"); await page.waitForTimeout(1500);
console.log(await page.locator("main button").evaluateAll((bs) => bs.map((x) => (x.disabled ? "[off] " : "") + x.innerText.trim()).filter(Boolean)));
const t = await page.locator("main").innerText(); console.log(t.slice(t.indexOf("Notes"), t.indexOf("Notes") + 200), "\n...", t.slice(-500));
await b.close();
