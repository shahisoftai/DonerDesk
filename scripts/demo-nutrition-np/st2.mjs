import { attach } from "../demo-ui/lib.mjs";
const A = [
 "In the first month 4,500 children 6-59 months were screened by MUAC and 210 children with SAM were admitted to outpatient therapeutic care, with 14 OTP sites now functioning; 180 FCHVs were trained on MUAC screening and referral.",
 "Monsoon-damaged trails delayed RUTF delivery to the Humla and Mugu health posts, and heavy workloads at facilities slowed the first IMAM training sessions; the project used porters and rescheduled sessions.",
 "Month one is the start-up month, so results are below the monthly average needed to reach the six-month targets; screening and admissions are expected to rise as FCHVs complete training and more OTP sites open.",
 "OTP sites were opened in two waves (14 in November) instead of all at once, and FCHV training was prioritised ahead of the household counselling plan to build case-finding capacity first.",
 "A mother in Jumla who joined a support group after her daughter was referred for SAM said the cooking demonstration showed her how to enrich local grains with oil and lentils."
];
const { page, browser } = await attach("st2");
const t = page.locator("main textarea"); for (let i=0;i<5;i++) { await t.nth(i).fill(A[i]); await page.waitForTimeout(300); }
console.log(await page.evaluate(()=>[...document.querySelectorAll("main button")].map(b=>b.innerText.trim()).filter(x=>x).join("|")));
const s = page.getByRole("button", { name: /^Save/ }).first(); if (await s.count()) { await s.click(); await page.waitForTimeout(4000); }
console.log((await page.locator("main").innerText()).match(/\d\/5 answered/)?.[0]);
await browser.close(); process.exit(0);
