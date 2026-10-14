import { attach, BASE } from "../demo-ui/lib.mjs"; import { readFileSync } from "node:fs";
const P = readFileSync("pid.txt","utf8").trim(); const { page, browser } = await attach("tplact");
await page.goto(`${BASE}/projects/${P}/activities/import`); await page.waitForLoadState("networkidle");
const [dl] = await Promise.all([page.waitForEvent("download", { timeout: 15000 }).catch(()=>null), page.getByText("Download template").first().click()]);
if (dl) { await dl.saveAs("act-template-download"); console.log("saved", dl.suggestedFilename()); } else console.log("no download event", page.url());
await browser.close(); process.exit(0);
