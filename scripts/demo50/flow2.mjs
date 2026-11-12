import { attach, BASE } from "../demo-ui/lib.mjs";
const S = "/tmp/claude-1000/-home-najeeb-Linux-Dev-Humanetarian-DonerDesk/5b9cec18-2a09-4c38-858b-78c68c0eb2a3/scratchpad";
const { page, browser } = await attach("flow2");
await page.goto(BASE + "/visuals/maps/14d6f13d-34ee-47ef-9d64-d16595e3e690", { waitUntil: "domcontentloaded" }); await page.waitForTimeout(11000);
await page.getByLabel("Data shown").selectOption({ label: "Flows between places" }); await page.waitForTimeout(3500);
const kinds = await page.getByRole("radio").evaluateAll(r=>r.map(x=>x.closest("label")?.innerText.trim()).filter(Boolean)); console.log("KINDS:", kinds.filter(k=>/map|Flow/i.test(k)));
const flow = page.getByRole("radio", { name: /Flow map/ }); if (await flow.count()) { await flow.first().check(); await page.waitForTimeout(5000); }
const chart = page.locator("[role=img], canvas").last(); await chart.scrollIntoViewIfNeeded(); await page.waitForTimeout(1500);
console.log("note:", (await page.locator("main").innerText()).replace(/\n+/g," / ").match(/(movement|Flow)[^/]{0,160}/gi)?.slice(0,4));
await page.screenshot({ path: S + "/flow2.png" });
await browser.close(); process.exit(0);
