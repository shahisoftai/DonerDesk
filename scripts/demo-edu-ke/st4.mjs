import { attach, BASE } from "../demo-ui/lib.mjs";
const A = [
 "Over six months the project enrolled 5,400 out-of-school children, opened 24 accelerated education centres, completed 40 classrooms and WASH facilities in 30 schools, trained 450 teachers, ran 120 remedial clubs, reached 15,000 learners through radio and digital lessons and gave bursaries to 1,500 girls across Turkana, Garissa, Marsabit, Wajir and Mandera.",
 "Seasonal flooding and drought displacement interrupted schooling in some sub-counties, insecurity limited access to a few schools and contractors delayed some classrooms; the project used accelerated learning, radio lessons, flexible scheduling and pre-qualified local contractors to keep delivery on track.",
 "Outputs were close to or at target. Outcomes moved from baseline (net enrolment 62% to 72%, attendance 71% to 84%, retention 78% to 88%, Grade 3 reading 18% to 35%, Grade 3 numeracy 22% to 38%, schools with an active committee and improvement plan 30% to 78%) but remain just below the final targets, as expected for a six-month project.",
 "Work was front-loaded on enrolment and accelerated education centres so children could start learning early, then shifted to classrooms, teacher coaching, remedial clubs and girls' support as the school term progressed; school management committee training and community dialogues ran throughout.",
 "A school management committee in Marsabit that was trained and developed a school improvement plan mobilised parents to build a girls' dormitory fence and brought 60 girls back to school, showing how community ownership sustains enrolment and attendance."
];
const { page, browser } = await attach("st4");
await page.goto(`${BASE}/projects/8e20556a-115e-48a7-be9b-bb1bfe14bf70/reports/a46fa895-78db-48ec-a95f-c3c3ade94418/inputs?tab=story`, { waitUntil: "domcontentloaded" }); await page.waitForTimeout(4000);
const t = page.locator("main textarea"); for (let i=0;i<5;i++) { await t.nth(i).fill(A[i]); await page.waitForTimeout(300); }
await page.waitForTimeout(3000); console.log("filled", await t.evaluateAll(a=>a.map(x=>x.value.length)));
await browser.close(); process.exit(0);
