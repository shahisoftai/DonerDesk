import { attach } from "./lib.mjs"; const { page, browser } = await attach(); const t0 = Date.now();
for (let i = 0; i < 17; i++) {
  const stop = await page.getByRole("button", { name: "Stop" }).count(); const txt = (await page.locator("main").innerText()).match(/Writing section[^\n]*|being written[^\n]*|\d+ of \d+ sections[^\n]*/i)?.[0];
  console.log(Math.round((Date.now() - t0) / 1000) + "s", stop ? "running" : "idle", txt ?? "");
  if (!stop && i > 0) break; await page.waitForTimeout(15000);
}
await browser.close(); process.exit(0);
