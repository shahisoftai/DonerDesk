// usage: node xlmonth.mjs <YYYY-MM> <periodId> : downloads the period sheet, fills it from vals.json, imports it, saves, hands in and verifies
import { attach, BASE } from "../demo-ui/lib.mjs";
import fs from "node:fs"; import { execFileSync } from "node:child_process";
const [month, periodId] = process.argv.slice(2); const S = process.env.S;
const { page, browser } = await attach("xlmonth"); page.setDefaultTimeout(20000);
await page.goto(`${BASE}/projects/cd291c72-ebc9-4f16-8633-b7c9007507ed/reports/${periodId}/inputs?tab=indicators`, { waitUntil: "domcontentloaded" }); await page.waitForTimeout(4500);
const b64 = await page.evaluate(async (id) => { const r = await fetch(`/api/reporting-periods/${id}/indicator-sheet/export`); const buf = new Uint8Array(await r.arrayBuffer()); let s = ""; for (const b of buf) s += String.fromCharCode(b); return btoa(s); }, periodId);
const empty = `${S}/xl-${month}-empty.xlsx`, filled = `${S}/xl-${month}.xlsx`; fs.writeFileSync(empty, Buffer.from(b64, "base64"));
console.log(execFileSync("python3", ["fillsheet.py", empty, filled, month]).toString().trim());
await page.locator("input[type=file][aria-label='Import Excel']").setInputFiles(filled); await page.waitForTimeout(4500);
const ap = page.getByRole("button", { name: /^Apply \d+ to grid/ }); console.log("apply:", await ap.innerText()); await ap.click(); await page.waitForTimeout(3000);
const click = async (name) => { const b = page.getByRole("button", { name }).first(); if (await b.isEnabled().catch(() => false)) { await b.click(); await page.waitForTimeout(6500); return true; } return false; };
console.log("save", await click("Save all")); console.log("submit", await click(/^Submit for review/)); console.log("verify", await click(/^Verify all/));
console.log((await page.locator("main").innerText()).match(/All \d+ values verified|[^\n]*not verified[^\n]*|[^\n]*evidence[^\n]*/gi)?.slice(0, 4));
await browser.close(); process.exit(0);
