import { attach, BASE } from "../demo-ui/lib.mjs";
const S = "/tmp/claude-1000/-home-najeeb-Linux-Dev-Humanetarian-DonerDesk/5b9cec18-2a09-4c38-858b-78c68c0eb2a3/scratchpad";
const { page, browser } = await attach("tpl1");
await page.goto(BASE + "/visuals/templates", { waitUntil: "domcontentloaded" }); await page.waitForTimeout(6000);
console.log("TEXT:", (await page.locator("main").innerText()).replace(/\n+/g," / ").slice(0,1300));
console.log("BTNS:", (await page.locator("main button:visible, main a:visible").allInnerTexts()).map(s=>s.replace(/\n/g," ")).filter(s=>s.length<50).slice(0,25).join(" | "));
await page.screenshot({ path: S + "/tpl1.png" });
await browser.close(); process.exit(0);
