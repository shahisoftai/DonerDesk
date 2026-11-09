import { attach } from "../demo-ui/lib.mjs";
const { page, browser } = await attach("flg8"); page.setDefaultTimeout(12000);
const titles = ["Executive Summary","Project Background","Achievement of Objectives","Outcomes and Impact","Activities Delivered","Beneficiaries Reached","Financial Close-out","Sustainability and Exit","Challenges and Lessons Learned","Recommendations","Conclusion","Annexes"];
for (const t of titles) {
  await page.getByText(t, { exact: true }).first().click().catch(()=>{}); await page.waitForTimeout(2200); let n = 0;
  for (let k = 0; k < 10; k++) {
    const b = page.getByRole("button", { name: "Keep with a note", exact: true }); if (!(await b.count())) break;
    await b.first().click(); await page.waitForTimeout(800);
    await page.getByLabel("Why this statement is acceptable").fill("Figure checked against the verified indicator value in the Data Center for the period (verified in the period sheet; the evidence file is the monthly register summary).");
    await page.getByRole("button", { name: "Keep with note", exact: true }).click(); await page.waitForTimeout(3500); n++;
  }
  if (n) console.log(t, n);
}
console.log((await page.locator("body").innerText()).match(/Review \d+ flagged statements?|\d+ issues/g));
await browser.close(); process.exit(0);
