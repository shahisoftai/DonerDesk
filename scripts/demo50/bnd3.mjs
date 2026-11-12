import { attach, BASE } from "../demo-ui/lib.mjs";
const S = "/tmp/claude-1000/-home-najeeb-Linux-Dev-Humanetarian-DonerDesk/5b9cec18-2a09-4c38-858b-78c68c0eb2a3/scratchpad";
const { page, browser } = await attach("bnd3");
await page.goto(BASE + "/settings", { waitUntil: "domcontentloaded" }); await page.waitForTimeout(4500);
const card = page.locator("section, div", { hasText: "Boundaries for a country and level" }).filter({ has: page.locator("input[type=file]") }).last();
console.log("FIELDS:", await card.locator("input:visible, select:visible").evaluateAll(s=>s.map(x=>[x.tagName,x.type,x.getAttribute("aria-label")||x.placeholder||(x.closest("label")?.innerText||"").slice(0,25),x.tagName==="SELECT"?[...x.options].slice(0,5).map(o=>o.text):""])));
await browser.close(); process.exit(0);
