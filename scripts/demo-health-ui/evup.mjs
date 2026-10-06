import { attach, BASE } from "./lib.mjs"; import { readFileSync, appendFileSync } from "node:fs";
const P = readFileSync("pid.txt","utf8").trim(); const { page, browser } = await attach();
const manifest = JSON.parse(readFileSync("evidence-manifest.json","utf8")); const m = Number(process.argv[2]);
const TYPE = { "Attendance sheet":"Attendance sheet","Photo":"Photo","Distribution list":"Distribution list","Training record":"Training record","Field visit report":"Field visit report","Monitoring report":"Monitoring report","Kobo/ODK export":"Kobo/ODK export","Procurement document":"Procurement document","Approval document":"Approval document","Beneficiary list":"Beneficiary list" };
const SENS = { Public:"Public", Internal:"Internal", Sensitive:"Sensitive", "Highly sensitive":"Highly sensitive" };
const EV = "/home/najeeb/Linux-Dev/Humanetarian/DonerDesk/memorybank/demo/verification-demo-5-artifacts/ev/";
const items = manifest.filter(x => x.m === m); let first = true;
for (const e of items) {
  await page.goto(`${BASE}/projects/${P}/evidence/new`); await page.waitForLoadState("networkidle");
  const sels = page.locator("main select"); // type, confidentiality, activity, indicator (+ period when shown)
  await sels.nth(0).selectOption({ label: TYPE[e.type] ?? "Other" }); await sels.nth(1).selectOption({ label: SENS[e.sens] });
  await page.locator("main input:not([type=file]):not([type=checkbox]):not([type=radio])").first().fill(e.loc);
  await page.locator("main textarea").first().fill(e.notes);
  const aopts = await sels.nth(2).locator("option").allInnerTexts(); const monthName = ["Mar","Apr","May","Jun","Jul","Aug"][m];
  const ah = aopts.find(o => o.includes(` ${e.node} —`) && o.includes(`${monthName} 2026 ·`)); if (!ah) throw new Error("no activity " + e.node + " " + monthName);
  await sels.nth(2).selectOption({ label: ah });
  if (e.ind) { const iopts = await sels.nth(3).locator("option").allInnerTexts(); await sels.nth(3).selectOption({ label: iopts.find(o => o.startsWith(e.ind + " —")) }); await page.waitForTimeout(500); }
  if (first) { console.log((await page.locator("main").innerText()).split("Use as proof for")[1].slice(0, 700).replace(/\n+/g, " | ").slice(0,500)); first = false; }
  await page.locator("input[type=file]").setInputFiles(EV + e.file.split("/").pop());
  await page.waitForTimeout(800);
  const titleIn = page.locator("main input[type=text]"); const nT = await titleIn.count(); 
  await page.getByRole("button", { name: /^(Upload|Save|Submit)/ }).last().click();
  await page.waitForFunction(() => !location.pathname.endsWith("/new"), null, { timeout: 60000 }).catch(() => console.log("  (no redirect)", e.file.split("/").pop()));
  await page.waitForTimeout(800); appendFileSync("ev.log", `${m}\t${e.node}\t${e.ind}\t${e.file.split("/").pop()}\t${page.url().split("/").pop()}\n`);
}
console.log("month", m + 1, "uploaded", items.length);
await browser.close(); process.exit(0);
