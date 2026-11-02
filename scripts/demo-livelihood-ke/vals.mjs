import { attach, BASE } from "../demo-ui/lib.mjs"; import { readFileSync } from "node:fs";
const P = readFileSync("pid.txt","utf8").trim(); const per = readFileSync("periods.txt","utf8").trim().split("\n");
const SC = ["Turkana West","Turkana Central","Loima","Saku","North Horr"];
// per indicator: monthly splits Jul..Oct over SC (null = not yet started: left empty, never 0)
const D = {
 "KE-OP1.1": [[1,1,0,1,0],[1,1,1,0,1],[2,1,1,1,1],[1,2,1,1,0]],
 "KE-OP1.2": [[60,45,30,25,20],[85,70,45,40,30],[95,80,55,50,40],[90,75,50,45,35]],
 "KE-OP1.3": [null,[120,90,60,50,40],[150,110,80,70,60],[100,80,60,50,40]],
 "KE-OP2.1": [null,[20,30,0,10,0],[40,45,15,20,10],[50,60,25,30,15]],
 "KE-OP2.2": [null,[0,1,0,1,0],[1,1,0,0,1],[0,1,1,1,0]],
};
const p = Number(process.argv[2]); const { page, browser } = await attach("ke-vals");
await page.goto(`${BASE}/projects/${P}/reports/${per[p]}/inputs`); await page.waitForLoadState("networkidle"); await page.waitForTimeout(2500);
await page.getByRole("button",{name:"Sheet",exact:true}).click(); await page.waitForTimeout(800);
const heads = await page.locator("thead th").allInnerTexts(); const iThis = heads.findIndex(h=>h.trim()==="This period"); const iCum = heads.findIndex(h=>h.trim()==="Cumulative"); console.log("cols", iThis, iCum);
const rows = Object.keys(D).filter(c => D[c][p]);
for (const c of rows) {
  const split = D[c][p], tot = split.reduce((a,b)=>a+b,0), cum = D[c].slice(0,p+1).filter(Boolean).reduce((a,s)=>a+s.reduce((x,y)=>x+y,0),0);
  const row = page.locator("tr",{hasText:c}).first();
  await row.locator("td").nth(iThis).click(); await page.keyboard.type(String(tot)); await page.keyboard.press("Tab"); await page.keyboard.type(String(cum)); await page.keyboard.press("Enter");
  await row.locator("td").nth(1).click(); await page.waitForTimeout(600);
  const sec = page.getByLabel(`Details for ${c}`);
  await sec.locator("summary", {hasText:"By place"}).click(); await page.waitForTimeout(300);
  const text = SC.map((s,i)=>split[i]>0?`${s}\t${split[i]}`:null).filter(Boolean).join("\n");
  await sec.locator('table[aria-label^="By place"]').evaluate((el,t)=>{ const dt=new DataTransfer(); dt.setData("text/plain",t); el.dispatchEvent(new ClipboardEvent("paste",{clipboardData:dt,bubbles:true,cancelable:true})); }, text);
  await page.waitForTimeout(500);
  const note = await sec.innerText(); console.log(c, tot, cum, (note.match(/Rows? not saved[^\n]*|differ[^\n]*|does not match[^\n]*/)||["ok"])[0]);
}
await page.waitForTimeout(3500);
const sa=page.getByRole("button",{name:"Save all"}); if(await sa.isEnabled()) await sa.click(); await page.waitForTimeout(8000);
const t = await page.locator("main").innerText();
console.log("period", p, "| saved text:", (t.match(/Rows not saved: \d+|No values have been recorded[^\n]*|\d+ value[^\n]*recorded/)||[""])[0], "| Draft:", (t.match(/Saved as a draft/g)||[]).length);
await page.screenshot({path:`vals${p}.png`});
await browser.close(); process.exit(0);
