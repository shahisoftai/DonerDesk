import { createRequire } from "node:module";
const require = createRequire("/home/najeeb/Linux-Dev/Humanetarian/DonerDesk/apps/web/package.json");
const { chromium } = require("@playwright/test");
const b = await chromium.connectOverCDP("http://localhost:9333"); const page = b.contexts()[0].pages()[0];
const t = await page.locator("main").innerText(); console.log(t.slice(0, Number(process.argv[2]||2500)));
await page.screenshot({ path: "/tmp/claude-1000/look.png" }); await b.close();
