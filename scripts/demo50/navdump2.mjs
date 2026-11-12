import { attach, BASE } from "../demo-ui/lib.mjs";
const { page, browser } = await attach("navdump2");
const dump = async (url) => {
  await page.goto(BASE + url, { waitUntil: "domcontentloaded" }); await page.waitForTimeout(3500);
  console.log("\n=== " + url + " -> " + new URL(page.url()).pathname + " | h1: " + (await page.locator("h1").first().innerText().catch(()=>"")));
  const l = await page.$$eval("main a, main [role=tab], main button", (els) => els.map((e) => (e.innerText||e.getAttribute("aria-label")||"").trim().replace(/\s+/g," ") + (e.getAttribute("href") ? " -> " + e.getAttribute("href") : "")).filter((s) => s.length > 1 && s.length < 80));
  console.log([...new Set(l)].slice(0, 70).join("\n"));
};
await dump("/projects");
const first = await page.$$eval("main a[href^='/projects/']", (a) => a.map((x) => x.getAttribute("href")).filter((h) => /^\/projects\/[0-9a-f-]{36}$/.test(h)));
console.log("PROJECTS", first.slice(0,10));
if (first[0]) await dump(first[0]);
await dump("/settings");
await browser.close(); process.exit(0);
