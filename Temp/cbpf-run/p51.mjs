import { attach, BASE } from "./lib.mjs";
const { page, browser } = await attach("timing");
for (const u of ["/projects/new/wizard?new=1", "/projects/new/wizard"]) {
  const t0 = Date.now(); await page.goto(BASE + u, { waitUntil: "commit" });
  try { await page.waitForSelector("h1", { timeout: 40000 }); console.log(u, "h1 after", Date.now() - t0, "ms →", page.url().slice(-45)); } catch { console.log(u, "no h1 in 40s;", await page.locator("body").innerText().then(t=>t.slice(0,80))); }
}
await browser.close();
