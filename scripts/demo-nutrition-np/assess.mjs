import { attach } from "../demo-ui/lib.mjs";
const A = [
"GAM about 9.5% (MUAC) in the five districts, KNCHA rapid MUAC survey, September 2026 (illustrative).",
"About 61,000 children 6-59 months and 24,000 pregnant or lactating women across the five districts (illustrative estimates).",
"UNICEF supplies RUTF, F-75/F-100 and MNP through the provincial store; health facility in-charges hold site stock; KNCHA tracks monthly stock reports.",
"Children with SAM and complications go to the stabilisation centre at the district hospital (Jumla) or the provincial hospital; KNCHA arranges transport support.",
"Early introduction of water and cereal gruel before six months; low dietary diversity; limited animal-source foods; strong breastfeeding norms but delayed initiation in some communities.",
"Children under five and women in remote hill and mountain communities with seasonal food shortages, long travel to health posts and low maternal literacy.",
"Dalit and Janajati households, remote settlements without road access, women-headed households, people with disabilities and older caregivers.",
"Complaint boxes at health posts, a toll-free line and FCHV feedback in mother groups; the KNCHA accountability officer answers within seven days.",
"The KNCHA safeguarding focal person is the Operations Manager; staff and volunteers report concerns to the focal person or by the confidential email line.",
"Names, ages and MUAC results of children are collected on registers and kept in locked cabinets and access-controlled files; no data is shared outside the project and UNICEF.",
"About 85,000 people in the target municipalities; roughly 14% are children under five and 52% are female.",
"Primary health care centres, health posts and community health units exist in each municipality; many lack OTP trained staff or anthropometric equipment.",
"Diarrhoea, acute respiratory infection and anaemia are common; no outbreak is reported at project start.",
"Latest full immunisation coverage in the districts is about 80% (illustrative, provincial health office).",
"Hospital referrals go to district hospitals by road or air where roads are closed; KNCHA supports transport costs for referred children.",
];
const { page, browser } = await attach("assess");
const ins = page.locator("main input, main textarea").filter({ hasNot: page.locator("[type=checkbox]") });
const all = await page.evaluate(() => [...document.querySelectorAll("main input, main textarea")].map((e,i)=>({i,t:e.type})));
const idx = all.filter(x=>x.t!=="checkbox"&&x.t!=="file").slice(2).map(x=>x.i);
const els = page.locator("main input, main textarea");
const NUM={1:"61000",10:"85000"};
for (let k=0;k<idx.length;k++){ const t=all[idx[k]].t; await els.nth(idx[k]).fill(t==="number"?(NUM[k]??"1"):A[k]); }
await page.waitForTimeout(1500);
await page.getByRole("button", { name: "Next", exact: true }).first().click(); await page.waitForTimeout(2500);
console.log((await page.locator("main").innerText()).split("Start a different project instead")[1]?.slice(0,1800));
await browser.close(); process.exit(0);
