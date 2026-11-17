import { createRequire } from "node:module";
const require = createRequire("/home/najeeb/Linux-Dev/Humanetarian/DonerDesk/apps/web/package.json");
const { chromium } = require("@playwright/test");
const b = await chromium.connectOverCDP("http://localhost:9333"); const page = b.contexts()[0].pages()[0];
for (const n of [/^Submit for review/, /^Verify all/]) { const x = page.getByRole("button", { name: n }).first(); if (await x.isEnabled().catch(() => false)) { await x.click(); await page.waitForTimeout(9000); } }
console.log((await page.locator("main").innerText()).match(/\d+\/56 verified|[^\n]*(not verified|no file|evidence)[^\n]*/gi)?.slice(0, 6));
await page.screenshot({ path: "/tmp/claude-1000/look.png" }); await b.close();
