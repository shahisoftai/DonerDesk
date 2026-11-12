import { attach, BASE } from "../demo-ui/lib.mjs";
const S = "/tmp/claude-1000/-home-najeeb-Linux-Dev-Humanetarian-DonerDesk/5b9cec18-2a09-4c38-858b-78c68c0eb2a3/scratchpad";
const { page, browser } = await attach("dash5");
await page.goto(BASE + "/visuals/fee3d075-90d6-4c46-b028-09e0d812852a", { waitUntil: "domcontentloaded" }); await page.waitForTimeout(8000);
console.log("toolbar:", await page.locator("main button:visible, main summary:visible, main a:visible").evaluateAll(s=>s.slice(0,16).map(x=>x.tagName+":"+x.innerText.trim().replace(/\n/g," "))));
await page.getByText("More", { exact: true }).first().click(); await page.waitForTimeout(1000);
console.log("MORE:", (await page.locator("main").innerText()).replace(/\n+/g," / ").match(/More \/[^]{0,700}/)?.[0]);
await page.screenshot({ path: S + "/dash5.png" });
await browser.close(); process.exit(0);
