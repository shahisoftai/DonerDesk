import { attach } from "../demo-ui/lib.mjs";
const { page, browser } = await attach("flg5"); page.setDefaultTimeout(12000);
const titles = ["Executive Summary","Project Background","Achievement of Objectives","Outcomes and Impact","Activities Delivered","Beneficiaries Reached","Financial Close-out","Sustainability and Exit","Challenges and Lessons Learned","Recommendations","Conclusion","Annexes"];
for (const t of titles) {
  await page.getByText(t, { exact: true }).first().click().catch(()=>{}); await page.waitForTimeout(2200);
  const body = await page.locator("body").innerText(); const m = body.match(/\d+ of \d+ statements need your decision/)?.[0]; if (!m) continue;
  const parts = body.split("Needs a decision").slice(1).map(x=>x.slice(0,420).replace(/\n+/g," | "));
  console.log("##", t, m); parts.forEach(p=>console.log("  -", p));
}
await browser.close(); process.exit(0);
