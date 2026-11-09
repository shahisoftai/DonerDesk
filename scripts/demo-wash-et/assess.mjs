import { attach } from "../demo-ui/lib.mjs";
const A = [
"About 85,000 people (14,000 households) across five woredas; sites range from 400 to 2,500 households (illustrative).",
"Most households use 6 to 8 litres per person per day, well below the 15 litre minimum (illustrative survey, December 2025).",
"Boreholes, shallow wells and berkads; many are dry or contaminated and surface water is common during the dry season.",
"About 1 working toilet per 55 people in settlements; open defecation is common in rural kebeles (illustrative).",
"Households mostly lack soap and a dedicated handwashing place.",
"Acute watery diarrhoea cases rise in the dry season; no declared cholera outbreak at project start.",
"Rainy seasons are April-May (gu) and October-November (deyr); the long dry season (jilaal) is January-March.",
"Four consecutive failed rainy seasons have caused drought displacement and livestock losses in Somali Region.",
"Women-headed households, children under five, pastoralist households, people with disabilities and minority clans.",
"Complaint desks at water points, a toll-free line and community committees; the HWSA accountability officer answers within seven days.",
"The HWSA safeguarding focal person is the Operations Manager; staff and volunteers report concerns to the focal person or the confidential email line.",
"Names and household data are collected on registers kept in locked cabinets and access-controlled files; no data is shared outside the project and USAID.",
];
const { page, browser } = await attach("assess");
const all = await page.evaluate(() => [...document.querySelectorAll("main input, main textarea, main select")].map((e,i)=>({i,t:e.type,tag:e.tagName})));
const idx = all.filter(x=>x.t!=="checkbox"&&x.t!=="file"&&x.t!=="radio").slice(2);
const els = page.locator("main input, main textarea, main select"); console.log(idx.map(x=>x.t).join(","));
let k = 0;
for (const x of idx) { const e = els.nth(x.i);
  if (x.tag === "SELECT") { if (x.i > 0 && k >= 0) { const n = k; await e.selectOption({ label: n === 4 ? "No" : "No" }).catch(()=>{}); } }
  else if (x.t === "number") await e.fill(k === 0 ? "85000" : "7"); else await e.fill(A[k] ?? "See project proposal."); k++; await page.waitForTimeout(250); }
await page.waitForTimeout(1500);
await page.getByRole("button", { name: "Next", exact: true }).first().click(); await page.waitForTimeout(2500);
console.log((await page.locator("main").innerText()).match(/Still to answer \(\d+\)/)?.[0]);
await browser.close(); process.exit(0);
