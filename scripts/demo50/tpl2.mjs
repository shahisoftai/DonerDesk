import { attach, BASE } from "../demo-ui/lib.mjs";
const S = "/tmp/claude-1000/-home-najeeb-Linux-Dev-Humanetarian-DonerDesk/5b9cec18-2a09-4c38-858b-78c68c0eb2a3/scratchpad";
const { page, browser } = await attach("tpl2");
await page.goto(BASE + "/visuals/templates", { waitUntil: "domcontentloaded" }); await page.waitForTimeout(6000);
await page.getByRole("button", { name: "Use this template" }).first().click(); await page.waitForTimeout(3000);
console.log("FORM:", (await page.locator("main").innerText()).replace(/\n+/g," / ").replace(/^.*Look inside/,"").slice(0,1200));
console.log("controls:", await page.locator("main select:visible, main input:visible").evaluateAll(s=>s.map(x=>[x.tagName,(x.closest("label")?.innerText||x.getAttribute("aria-label")||"").slice(0,35).replace(/\n/g," "),x.value.slice(0,12)])).then(a=>a.slice(-12)));
await page.screenshot({ path: S + "/tpl2.png" });
await browser.close(); process.exit(0);
