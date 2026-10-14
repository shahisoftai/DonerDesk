import { attach, BASE, dump } from "../demo-ui/lib.mjs"; import { readFileSync } from "node:fs";
const P = readFileSync("pid.txt","utf8").trim(); const per = readFileSync("periods.txt","utf8").trim().split("\n"); const id = process.argv[2].length > 2 ? process.argv[2] : per[Number(process.argv[2])];
const { page, browser } = await attach("edsec");
await page.goto(`${BASE}/projects/${P}/reports/${id}`); await page.waitForLoadState("networkidle"); await page.waitForTimeout(2500);
const h = page.getByRole("heading", { name: new RegExp(process.argv[3]) }).first(); await h.scrollIntoViewIfNeeded(); await h.click(); await page.waitForTimeout(800);
await page.getByRole("button", { name: /^Edit( \(reopens section\))?$/ }).first().click(); await page.waitForTimeout(1500);
console.log((await dump(page)).filter(l=>/button|textarea/.test(l)&&!/^a /.test(l)&&/Save|Cancel|Bold|Italic|heading|List|Undo|Dictate|Done/i.test(l)).slice(0,14).join("\n"));
const ed = page.locator("[contenteditable=true]").first(); const before = (await ed.innerText()).slice(0,100); console.log("editor text starts:", before);
if (process.argv[4]) { const fs = await import("node:fs"); const txt = fs.readFileSync(process.argv[4], "utf8").trim(); await ed.click(); await page.keyboard.press("Control+A"); await page.keyboard.type(txt, { delay: 0 }); await page.waitForTimeout(800);
  await page.getByRole("button", { name: /^(Done editing|Save)/ }).first().click(); await page.waitForTimeout(4000); console.log("saved?", (await page.locator("body").innerText()).replace(/\n+/g," | ").match(/[^|]*(aved|Draft|needs review|edited)[^|]*/gi)?.slice(0,4)); }
await page.screenshot({ path: "shot-edit.png" });
await browser.close(); process.exit(0);
