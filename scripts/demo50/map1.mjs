import { attach, BASE } from "../demo-ui/lib.mjs";
const S = "/tmp/claude-1000/-home-najeeb-Linux-Dev-Humanetarian-DonerDesk/5b9cec18-2a09-4c38-858b-78c68c0eb2a3/scratchpad";
const { page, browser } = await attach("map1");
await page.goto(BASE + "/projects/cd291c72-ebc9-4f16-8633-b7c9007507ed/activities", { waitUntil: "domcontentloaded" }); await page.waitForTimeout(4000);
await page.getByRole("button", { name: "Map", exact: true }).click(); await page.waitForTimeout(9000);
console.log("canvas:", await page.locator("canvas").count(), "| maplibre:", await page.locator(".maplibregl-map").count());
const t = (await page.locator("main").innerText()).replace(/\n+/g," / "); const i = t.indexOf("Map"); console.log(t.slice(t.indexOf("Whole project")>0? t.indexOf("Hide done"):0).slice(0,1100));
await page.screenshot({ path: S + "/map1.png" });
await browser.close(); process.exit(0);
