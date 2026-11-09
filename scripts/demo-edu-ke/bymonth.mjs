// usage: node bymonth.mjs <YYYY-MM> <periodId> : adds the by-county split of key indicators, saves, hands in and verifies
import { attach, BASE } from "../demo-ui/lib.mjs"; import fs from "node:fs";
const [month, periodId] = process.argv.slice(2);
const V = JSON.parse(fs.readFileSync("vals.json", "utf8"))[month];
const CODES = ["OP1-1a","OP1-2c","OP2-1a","OP2-2a","OP3-1c","OP3-2a","OP3-2b"]; const PL = ["Turkana County","Garissa County","Marsabit County","Wajir County","Mandera County"];
const { page, browser } = await attach("bymonth"); page.setDefaultTimeout(15000);
await page.goto(BASE + "/projects/8e20556a-115e-48a7-be9b-bb1bfe14bf70/reports/" + periodId + "/inputs?tab=indicators", { waitUntil: "domcontentloaded" }); await page.waitForTimeout(4500);
await page.getByRole("button", { name: "Sheet", exact: true }).click().catch(()=>{}); await page.waitForTimeout(1500);
const ro = page.getByRole("button", { name: /^Reopen verified/ }); if (await ro.count() && await ro.first().isEnabled()) { await ro.first().click(); await page.waitForTimeout(1200); await page.getByLabel("Why the values are being reopened").fill("Adding the by-county breakdown of each figure."); await page.getByRole("button", { name: "Reopen", exact: true }).click(); await page.waitForTimeout(6000); }
for (const code of CODES) {
  const n = V[code]?.period; if (!n) continue;
  const row = page.locator("tr").filter({ has: page.locator("[role=gridcell]", { hasText: code }) }).first();
  await row.locator("[role=gridcell]").first().click(); await page.waitForTimeout(900);
  const sum = page.locator("summary", { hasText: "By place" }).first(); const det = sum.locator("xpath=ancestor::details[1]");
  if (!(await det.evaluate((d) => d.open))) { await sum.click(); await page.waitForTimeout(500); }
  const per = [Math.floor(n/5),Math.floor(n/5),Math.floor(n/5),Math.floor(n/5),Math.floor(n/5)]; per[0] += n - per.reduce((a,b)=>a+b,0);
  const text = PL.map((p, i) => p + "\t" + per[i]).join("\n");
  await page.evaluate((txt) => { const t = document.querySelector("table[aria-label^='By place']"); const box = t.parentElement; const dt = new DataTransfer(); dt.setData("text/plain", txt); box.dispatchEvent(new ClipboardEvent("paste", { clipboardData: dt, bubbles: true, cancelable: true })); }, text);
  await page.waitForTimeout(900);
  const tot = await det.locator("table[aria-label^='By place']").getByLabel(PL[3] + " Value", { exact: true }).inputValue().catch(() => "?"); if (tot !== String(per[3])) console.log("CHECK", code, PL[3], tot);
  console.log(code, n, per.join("/"));
}
const click = async (name) => { const b = page.getByRole("button", { name }).first(); if (await b.isEnabled().catch(() => false)) { await b.click(); await page.waitForTimeout(7000); return true; } return false; };
console.log("save", await click("Save all")); console.log("submit", await click(/^Submit for review/)); console.log("verify", await click(/^Verify all/));
console.log((await page.locator("main").innerText()).match(/All \d+ values verified|[^\n]*not verified[^\n]*|[^\n]*(problem|must|sum)[^\n]*/gi)?.slice(0, 4));
await browser.close(); process.exit(0);
