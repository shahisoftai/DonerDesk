import { attach, BASE } from "../demo-ui/lib.mjs";
const A = [
 "Over six months the project screened 36,000 children 6-59 months by MUAC, admitted 1,800 children with SAM to outpatient therapeutic care, trained 600 FCHVs and 240 health workers, and brought 40 OTP sites into service. SAM cure rose from 72% in the first month to 83% in April, default fell from 16% to 8% and death from 1.4% to 0.7%.",
 "Monsoon trail damage and winter snow delayed RUTF deliveries and some sessions in Humla and Mugu, and health worker turnover required repeat IMAM training; the project pre-positioned RUTF, used porters and added refresher training and supportive supervision.",
 "Screening, admissions, counselling and MNP reached 100% of their six-month targets; recovery outcomes exceeded the Sphere minimums and the 80% cure target by April. Early months were below the monthly average because sites and FCHVs were still being set up.",
 "OTP sites were opened in waves, FCHV training was front-loaded to build case-finding, and mother support group formation was concentrated in the first four months before shifting to demonstrations and follow-up.",
 "A caregiver in Bajura whose child recovered from SAM now leads a mother support group and helps neighbours prepare enriched local porridge; groups like hers are the basis for sustaining IYCF practices after the project."
];
const { page, browser } = await attach("st4");
await page.goto(`${BASE}/projects/14d6f13d-34ee-47ef-9d64-d16595e3e690/reports/0c7387a8-805b-499f-8496-4d63b8267d56/inputs?tab=story`, { waitUntil: "domcontentloaded" }); await page.waitForTimeout(4000);
const t = page.locator("main textarea"); for (let i=0;i<5;i++) { await t.nth(i).fill(A[i]); await page.waitForTimeout(300); }
await page.waitForTimeout(3000); console.log("filled", await t.evaluateAll(a=>a.map(x=>x.value.length)));
await browser.close(); process.exit(0);
