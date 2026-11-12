import { attach, BASE } from "../demo-ui/lib.mjs";
const S = "/tmp/claude-1000/-home-najeeb-Linux-Dev-Humanetarian-DonerDesk/5b9cec18-2a09-4c38-858b-78c68c0eb2a3/scratchpad";
const { page, browser } = await attach("map10");
await page.goto(BASE + "/visuals/maps/14d6f13d-34ee-47ef-9d64-d16595e3e690", { waitUntil: "domcontentloaded" }); await page.waitForTimeout(12000);
const t = (await page.locator("main").innerText()).replace(/\n+/g," / ");
for (const k of ["Open its provinces","Analyse","Draw rings","Show every place","Nearest","People living within"]) console.log(k, t.includes(k));
console.log((await page.locator("main button:visible, main a:visible").allInnerTexts()).map(s=>s.replace(/\n/g," ")).filter(s=>s.length<40).slice(0,25).join(" | "));
await page.screenshot({ path: S + "/map10.png" });
await browser.close(); process.exit(0);
