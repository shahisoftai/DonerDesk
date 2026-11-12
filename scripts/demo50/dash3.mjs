import { attach, BASE } from "../demo-ui/lib.mjs";
const S = "/tmp/claude-1000/-home-najeeb-Linux-Dev-Humanetarian-DonerDesk/5b9cec18-2a09-4c38-858b-78c68c0eb2a3/scratchpad";
const { page, browser } = await attach("dash3");
await page.goto(BASE + "/visuals/new", { waitUntil: "domcontentloaded" }); await page.waitForTimeout(4000);
await page.getByRole("button", { name: "Show how a project is progressing" }).click(); await page.waitForTimeout(1200);
await page.locator("label", { hasText: /^Results at a glance/ }).first().click(); await page.waitForTimeout(800);
const sel = page.locator("main select:visible"); const n = await sel.count();
await page.locator("main input:not([type=radio]):not([type=checkbox]):visible").last().fill("ZZ TEST results at a glance");
await sel.nth(n-6).selectOption({ label: "Only me" });
const projSel = sel.nth(n-5); await projSel.selectOption({ label: (await projSel.locator("option").allInnerTexts()).find(o=>/DEMO-14/.test(o)) }); await page.waitForTimeout(1500);
for (let k = 0; k < 4; k++) { const s = sel.nth(n-4+k); const o = await s.locator("option").count(); await s.selectOption({ index: Math.min(1 + k * 4, o - 1) }).catch(()=>{}); }
await page.getByRole("button", { name: "Make it" }).click(); await page.waitForTimeout(10000);
console.log("URL", new URL(page.url()).pathname);
console.log((await page.locator("main").innerText()).replace(/\n+/g," / ").slice(0,1200));
await page.screenshot({ path: S + "/dash3.png" });
await browser.close(); process.exit(0);
