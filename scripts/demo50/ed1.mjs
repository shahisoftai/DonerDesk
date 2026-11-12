import { attach, BASE } from "../demo-ui/lib.mjs";
const S = "/tmp/claude-1000/-home-najeeb-Linux-Dev-Humanetarian-DonerDesk/5b9cec18-2a09-4c38-858b-78c68c0eb2a3/scratchpad";
const { page, browser } = await attach("ed1");
await page.goto(BASE + "/visuals/fee3d075-90d6-4c46-b028-09e0d812852a", { waitUntil: "domcontentloaded" }); await page.waitForTimeout(8000);
await page.getByRole("button", { name: "Edit", exact: true }).click(); await page.waitForTimeout(4000);
console.log("BTNS:", (await page.locator("button:visible, summary:visible").allInnerTexts()).map(s=>s.replace(/\n/g," ")).filter(s=>s&&s.length<45).slice(0,60).join(" | "));
console.log("TEXT:", (await page.locator("main").innerText()).replace(/\n+/g," / ").slice(0,900));
await page.screenshot({ path: S + "/ed1.png" });
await browser.close(); process.exit(0);
