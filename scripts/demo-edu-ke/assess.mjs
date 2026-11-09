import { attach } from "../demo-ui/lib.mjs";
const A = [
"About 38,000 school-age children are out of school in the five counties (illustrative); reasons are distance, drought displacement, poverty, early marriage and lack of documents.",
"Pupil-teacher ratios are above 70 to 1 in many schools; about a third of teachers are on short contracts and some are paid late (illustrative).",
"The Kenyan competency-based curriculum in English and Kiswahili, with mother-tongue support in early grades; accelerated education follows the national AEP curriculum.",
"Drought and flooding in 2025 displaced families; school feeding was reduced and several schools closed for weeks (illustrative).",
"Girls, children with disabilities, pastoralist and displaced children, orphans and children from minority communities.",
"Complaint boxes and a toll-free line in each school, plus parent meetings; the ALP accountability officer replies within seven days.",
"The ALP safeguarding focal person is the Child Protection Officer; staff, teachers and volunteers report concerns to the focal person or the confidential email line.",
"Learner and teacher names are kept in school registers and a password-protected database; data is shared only with the project, the county education office and the EU.",
];
const { page, browser } = await attach("assess");
const all = await page.evaluate(() => [...document.querySelectorAll("main input:not([type=file]):not([type=checkbox]):not([type=radio]), main textarea")].map((e,i)=>({i,v:e.value})));
const empties = all.filter(x=>!x.v);
const els = page.locator("main input:not([type=file]):not([type=checkbox]):not([type=radio]), main textarea");
console.log("empties", empties.length);
for (const [k,x] of empties.entries()) { await els.nth(x.i).fill(A[k] ?? "See project proposal."); await page.waitForTimeout(250); }
await page.waitForTimeout(1500);
await page.getByRole("button", { name: "Next", exact: true }).first().click(); await page.waitForTimeout(2500);
console.log((await page.locator("main").innerText()).match(/Still to answer \(\d+\)/)?.[0]);
await browser.close(); process.exit(0);
