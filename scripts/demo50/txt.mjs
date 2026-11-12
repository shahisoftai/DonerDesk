import { attach, BASE } from "../demo-ui/lib.mjs";
const S = "/tmp/claude-1000/-home-najeeb-Linux-Dev-Humanetarian-DonerDesk/5b9cec18-2a09-4c38-858b-78c68c0eb2a3/scratchpad";
const { page, browser } = await attach("txt");
await page.goto(BASE + process.argv[2], { waitUntil: "domcontentloaded" }); await page.waitForTimeout(Number(process.argv[3] ?? 4000));
if (process.argv[4]) { await page.getByRole("button", { name: new RegExp(process.argv[4]) }).first().click(); await page.waitForTimeout(1500); }
if (process.argv[5]) { await page.getByRole("button", { name: new RegExp(process.argv[5]) }).first().click(); await page.waitForTimeout(1500); }
console.log((await page.locator("main").innerText()).replace(/\n+/g," / ").slice(0, Number(process.env.N ?? 2500)));
await page.screenshot({ path: `${S}/txt.png` });
await browser.close(); process.exit(0);
