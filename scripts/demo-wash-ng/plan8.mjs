// Demo 8 monthly inputs: activity records, story answers, evidence manifest. Every figure comes from data.mjs.
import { IND, MONTHS, MN, MS, PERIOD_OF, mval, split, SPLIT } from "./data.mjs";
export { MN, MS, PERIOD_OF };
const LAST = [28, 31, 30, 31, 30, 31, 31, 30];
const day = (m, d) => `${MONTHS[m]}-${String(Math.min(d, LAST[m])).padStart(2, "0")}`;
export const cumm = (code, m) => { let t = 0; for (let q = 0; q <= m; q++) t += mval(code, q) ?? 0; return t; };
const v = (c, m) => mval(c, m);
// month events: [challenge, adaptation]
export const EVT = [
 ["The drilling contractor mobilised later than planned and the rig reached Konduga only in the last week; the harmattan dust and the start of Ramadan on 18 February shortened working days.", "Site surveys and baseline water quality testing were done first so that drilling could start as soon as the rig arrived."],
 ["Ramadan fasting hours cut working hours for local labour and masons, and the mobile network at Mashimari was unreliable for data collection.", "Construction was scheduled for early mornings and the mobilisers recorded sessions on paper registers for later entry."],
 ["Insecurity on the Mafa to Dikwa road restricted movement for about ten days and the Mafa school site could not be visited.", "Work moved to Konduga and Jere, and the Mafa school block was started once the road was cleared with the community leaders."],
 ["The drilling rig broke down for nine days waiting for a spare part from Kano and diesel prices rose by about a fifth.", "A second smaller rig was hired for hand-pump boreholes and diesel purchases were pooled across the sites."],
 ["The first rains collapsed latrine pits in sandy soil at Mele and Dalori.", "Pit lining with concrete rings was added to the design for all remaining latrines and the collapsed pits were rebuilt."],
 ["The Borno State Ministry of Health declared a cholera alert in Jere and Konduga and demand for chlorine and hygiene kits rose sharply.", "The planned hygiene sessions were reoriented to cholera prevention and the kit distribution was brought forward from September."],
 ["Floods in Jere and Konduga damaged one water point and contaminated three others, and about 400 households could not reach their latrines for a week.", "The water points were disinfected and retested, a flood contingency of hygiene kits was released and latrine access paths were raised."],
 ["End-line survey and handover coincided with the end of staff contracts and with heavy rain that delayed the last school block.", "Handover meetings were held in each LGA before contracts ended and the school block finished one week late."],
];
const adapt = (m) => EVT[m][1];
const LOC = { jere: "Dalori ward, Jere LGA", mash: "Mashimari, Jere LGA", kond: "Konduga town, Konduga LGA", mele: "Mele, Konduga LGA", mafa: "Mafa town, Mafa LGA", dikwa: "Dikwa Ward 3, Dikwa LGA" };
export function activities(m) {
  const M = MN[m], out = [];
  const add = (a) => out.push({ date: day(m, a.d), challenges: EVT[m][0], adapt: adapt(m), ...a });
  const sx = (c, n) => split(n, SPLIT[c] ?? 0.55);
  const A11 = (d, title, loc, summary, achievements, extra = {}) => add({ node: "A1.1", d, title: `A1.1 — ${title}, ${M}`, loc, summary, achievements, lessons: "Chlorinating and testing a water point at handover, before the community starts to use it, avoids early contamination complaints.", next: "Complete the remaining water points and hand each over to its committee.", ind: "WS-OP1.1", ...extra });
  const A12 = (d, loc, n) => add({ node: "A1.2", d, title: `A1.2 — Household latrine construction, ${M} (${loc.split(",")[0]})`, loc, summary: `Masons and trained householders built ${n} lockable household latrines with a handwashing station, prioritising households headed by women, older people and people with disabilities, in ${loc}.`, achievements: `${n} latrines completed in ${M} and passed inspection; ${cumm("WS-OP1.2", m)} of 600 to date.`, lessons: "Households that dig their own pits and are paid for materials, not labour, finish faster.", next: "Continue construction and inspect the completed latrines.", ind: "WS-OP1.2" });
  const A13 = (d, loc, title, n) => add({ node: "A1.3", d, title: `A1.3 — ${title}, ${M}`, loc, summary: `A contractor built a WASH block with separate girls and boys latrines, a menstrual hygiene room and handwashing points at ${title.includes("school") ? "a primary school" : "a primary health centre"} in ${loc}; the school or facility management committee signed the completion certificate.`, achievements: `${n} WASH block${n > 1 ? "s" : ""} completed in ${M}; ${cumm("WS-OP1.3", m)} of 8 to date.`, lessons: "Involving the school management committee from the design stage secures a maintenance budget.", next: "Hand over the remaining blocks and train the school hygiene clubs.", ind: "WS-OP1.3" });
  const A21 = (d, loc, extra = "") => { const n = v("WS-OP2.1", m), [f, ml] = sx("WS-OP2.1", n); add({ node: "A2.1", d, title: `A2.1 — Community hygiene promotion sessions, ${M} (${loc.split(",")[0]})`, loc, total: n, female: f, male: ml, summary: `Trained community mobilisers held hygiene promotion sessions at water points, markets and mosques on handwashing, safe water storage and latrine use; ${n} people attended (${f} female, ${ml} male).${extra}`, achievements: `${n} people reached in ${M} (${f} female, ${ml} male); ${cumm("WS-OP2.1", m)} of 24,000 to date.`, lessons: "Sessions held after prayers and at the water point reach more men; women attend sessions led by female mobilisers.", next: "Continue the sessions and add a hygiene club session in the schools.", ind: "WS-OP2.1" }); };
  const A22 = (d, loc, n, what) => add({ node: "A2.2", d, title: `A2.2 — ${what}, ${M}`, loc, total: n * 7, female: n * 4, male: n * 3, summary: `${n} water point committee${n > 1 ? "s" : ""} (seven members each, at least four women) ${what.toLowerCase().includes("form") ? "were formed and trained" : "received training"} on operation and maintenance, tariff collection and the care of the water point, in ${loc}.`, achievements: `${n} committee${n > 1 ? "s" : ""} established and trained in ${M}; ${cumm("WS-OP2.2", m)} of 16 to date.`, lessons: "Committees that agree a small monthly tariff before the water point opens keep it working.", next: "Follow up the committees with monthly monitoring visits.", ind: "WS-OP2.2" });
  const A23 = (d, loc, title, n) => add({ node: "A2.3", d, title: `A2.3 — ${title}, ${M}`, loc, summary: `The water quality officer tested ${n} water points for free chlorine residual and, for a sample, bacteriology using portable test kits; ${v("WS-OC1c", m)} percent of the water points tested had a residual of at least 0.2 mg/l.`, achievements: `${n} water quality tests carried out in ${M}; ${cumm("WS-OP2.3", m)} of 320 to date. Chlorine compliance ${v("WS-OC1c", m)} percent.`, lessons: "A simple chlorinator at the water point and a weekly check by the committee raise compliance.", next: "Retest the water points that failed and train committee members to read the kit.", ind: "WS-OP2.3" });
  const A24 = (d, loc, n, what) => { add({ node: "A2.4", d, title: `A2.4 — ${what}, ${M}`, loc, summary: `Each household received a hygiene kit (soap, bucket with lid, water treatment tablets and a leaflet) in ${loc}; households were selected from the community list with the committees and the distribution list was verified at the point of distribution.`, achievements: `${n} households received kits in ${M}; ${cumm("WS-OP2.4", m)} of 2,500 to date.`, lessons: "Distributing at the water point with a complaint desk reduces disputes about who is on the list.", next: "Follow up use of the kits during the next hygiene sessions.", ind: "WS-OP2.4" }); };
  if (m === 0) {
    A11(9, "Contractor selection and hydrogeological survey", `${LOC.kond}`, "The drilling contractor was selected after a three-quote procurement and a hydrogeological and geophysical survey identified six borehole sites with the community leaders and the Ministry of Water Resources.", "Contractor contracted; six borehole sites surveyed and agreed with community leaders.", { ind: undefined });
    A21(16, LOC.jere, " Twelve mobilisers (eight women) were trained first.");
    A23(24, LOC.mash, "Baseline water quality testing at existing water points", v("WS-OP2.3", m));
  } else if (m === 1) {
    A11(10, "Drilling and chlorination of two boreholes", LOC.kond, `The contractor drilled, developed and test-pumped two boreholes with hand pumps and the water quality officer chlorinated and tested them before handover to the communities; about 2,400 people now use them.`, "2 water points completed; about 2,400 people with improved access.", {});
    A21(17, LOC.mash);
    A22(24, LOC.jere, 3, "Formation of three water point committees");
  } else if (m === 2) {
    A12(8, LOC.mele, 90);
    A13(15, LOC.mafa, "Primary school WASH block, Mafa", 1);
    A21(21, LOC.dikwa);
  } else if (m === 3) {
    A11(7, "Drilling of three boreholes", LOC.kond, `Three boreholes with hand pumps were completed and handed over to their committees; about 4,200 people use them. The rig was out for nine days.`, "3 water points completed; about 4,200 people with improved access.", {});
    A22(14, LOC.mele, 3, "Training of three water point committees");
    A23(22, LOC.jere, "Monthly water quality monitoring round", v("WS-OP2.3", m));
  } else if (m === 4) {
    A11(9, "Drilling of three boreholes", LOC.mele, `Three boreholes with hand pumps were completed and handed over in Konduga LGA; about 4,500 people use them.`, "3 water points completed; about 4,500 people with improved access.", {});
    A12(16, LOC.jere, 115);
    A21(23, LOC.kond);
  } else if (m === 5) {
    A11(8, "Rehabilitation of two hand-pump boreholes", LOC.jere, `Two broken hand-pump boreholes were rehabilitated and chlorinated and handed over to their committees; about 3,000 people use them.`, "2 water points rehabilitated; about 3,000 people with improved access.", {});
    A21(15, LOC.mash, " Sessions were reoriented to cholera prevention after the state alert.");
    A24(22, LOC.jere, v("WS-OP2.4", m), "Hygiene kit and water treatment distribution after the cholera alert");
  } else if (m === 6) {
    A11(6, "Emergency rehabilitation after flooding", LOC.jere, `Flooding damaged one water point and contaminated three; the team repaired the damaged hand pump, flushed and disinfected the three others, and the water quality officer retested them. Five thousand people regained safe water within a week.`, "3 water points rehabilitated and 4 retested after the floods; about 5,000 people with restored access.", {});
    A24(12, LOC.kond, v("WS-OP2.4", m), "Flood and cholera response kit distribution");
    A23(20, LOC.jere, "Post-flood water quality testing", v("WS-OP2.3", m));
  } else {
    A13(9, LOC.dikwa, "Health-centre WASH block, Dikwa", 1);
    A13(18, LOC.mafa, "Second school WASH block, Mafa", 1);
    A24(24, LOC.mele, v("WS-OP2.4", m), "End-of-project hygiene kit distribution");
  }
  return out;
}
const comp = [
 "Gender: twelve community mobilisers were recruited, eight of them women, so women could be reached at home. Protection: the site survey followed the do-no-harm checklist and no sites were chosen near military checkpoints. Accountability: a complaint and feedback box was set up at the Konduga office and each site displayed the hotline number.",
 "Gender: women hold four of the seven places on each of the three new water point committees. Protection: water points were sited in daylight-accessible places agreed with women's groups. Accountability: two complaints about the water point location in Jere were recorded and resolved by moving the tap stand.",
 "Gender: latrines in Mele prioritised households headed by women and by older people. Protection: no incident reported; the road closure was handled with the community leaders. Accountability: one complaint about the beneficiary list at Dikwa was resolved at a community meeting.",
 "Gender: women are 4 of the 7 members of every committee trained this quarter. Protection: no incident reported at any site; the school block in Mafa includes a menstrual hygiene room. Accountability: the feedback hotline received 14 messages in the quarter, 13 resolved within a week; the 14th concerned a hand pump that was repaired.",
 "Gender: kit distribution was led by women staff at female-only desks. Protection: no incident reported; distribution points were chosen away from the flooded routes. Accountability: the complaint desk at the distribution recorded 6 queries about the list; 5 resolved on the day.",
 "Gender: women's groups were consulted on the flood-affected latrine access paths. Protection: unaccompanied women and children were prioritised at the kit distribution. Accountability: 9 queries from affected households were recorded and answered within two days.",
 "Gender: final figures show 55 percent of the people with improved access were women and girls and 60 percent of those reached by hygiene promotion were women. Protection: no safeguarding incident was reported during the project. Accountability: all complaints were resolved and the community feedback is summarised in the lessons.",
];
const compOf = [0, 1, 2, 2, 2, 4, 5, 6];
export function story(m) {
  const t = (c) => v(c, m);
  const well = [
   "The project started on 1 February 2026: the drilling contractor was selected, six borehole sites were surveyed with community leaders, twelve mobilisers were trained and 1,500 people were reached with hygiene promotion in the first month.",
   `The first two boreholes were completed and handed over and about 2,400 people now have safe water; ${t("WS-OP1.2")} household latrines were built, three committees were formed and ${t("WS-OP2.1")} people were reached with hygiene promotion.`,
   `${t("WS-OP1.2")} latrines were built in Mele, the first school WASH block was completed at Mafa and ${t("WS-OP2.1")} people were reached with hygiene promotion.`,
   `Three boreholes were completed, three committees trained and ${t("WS-OP2.3")} water quality tests carried out; chlorine compliance reached ${t("WS-OC1c")} percent.`,
   `Three more boreholes were completed and handed over, ${t("WS-OP1.2")} latrines were built and ${t("WS-OP2.1")} people were reached; chlorine compliance reached ${t("WS-OC1c")} percent.`,
   `Two water points were rehabilitated, ${t("WS-OP2.4")} households received hygiene kits after the cholera alert and ${t("WS-OP2.1")} people were reached with cholera prevention messages.`,
   `Three water points were rehabilitated after the floods and ${t("WS-OP2.4")} households received kits; ${t("WS-OP2.3")} post-flood water quality tests were done.`,
   "The two last WASH blocks were completed and handed over, the end-line household survey was done, and committees and the LGA water boards received the handover documents.",
  ][m];
  const gap = [
   "No water point and no latrine was completed in February because the rig arrived late; the three-quote procurement and survey took the whole month.",
   "Two boreholes were completed against a plan of three because the rig was shared with a second site; one will follow in April.",
   "No water point was completed in April: the Mafa road closure and the rig repair moved the borehole work into May.",
   "Three boreholes were completed against a plan of four because the rig broke down for nine days.",
   "On plan for boreholes and latrines; some pits collapsed after the first rains and were rebuilt with concrete rings.",
   "Two water points were rehabilitated against a plan of three and the kit distribution was brought forward from September.",
   `Chlorine compliance dropped from ${val("WS-OC1c", 5)} to ${t("WS-OC1c")} percent after the floods contaminated three water points; the water points were disinfected and retested.`,
   "Water points reached 16 of 20 and persons with new access 26,000 of 30,000 because of the rig breakdowns, the Mafa road closure and the floods; committees, latrines and blocks are at or close to target.",
  ][m];
  const bene = [
   "A mobiliser in Jere held the first handwashing demonstration with a tippy-tap and women's group leaders asked for a second session for their members.",
   "The new borehole at Konduga ended a daily two-hour walk for women to a shallow well that dried up each March.",
   "A widow in Mele received a lockable latrine with a handwashing station built by the project masons.",
   "A committee at Mele opened its borehole with a monthly tariff agreed by a women's majority.",
   "A woman-headed household in Dalori rebuilt its collapsed latrine with a concrete ring after the first rains.",
   "A mobiliser used the cholera alert messages at a mosque in Mashimari and the imam repeated the handwashing message at Friday prayers.",
   "A committee chair in Jere chlorinated the flooded borehole with the project test kit before anyone fell ill.",
   "A girls' hygiene club at the Mafa school began managing the menstrual hygiene room and the soap stock.",
  ][m];
  return [well, EVT[m][0], gap, adapt(m), bene, comp[compOf[m]]];
}
const val = (c, m) => mval(c, m);
// evidence manifest: one record per file
export function evidence(m) {
  const M = MN[m], out = []; const seen = {}; const tagFor = (a) => { seen[a.node] = (seen[a.node] ?? 0) + 1; return (n) => `${String(m + 1).padStart(2, "0")}-${n}${seen[a.node] > 1 ? "-" + seen[a.node] : ""}`; };
  for (const a of activities(m)) { const tag = tagFor(a);
    const base = { m, node: a.node, loc: a.loc, a };
    if (["A2.1", "A2.2"].includes(a.node)) {
      out.push({ ...base, ind: a.ind, kind: "attendance", file: `${tag(a.node)}-attendance.csv`, type: "Attendance sheet", sens: "Internal", title: `Attendance — ${a.title}`, notes: `Attendance register: ${a.total} participants (${a.female} female, ${a.male} male), ${M}.` });
      out.push({ ...base, kind: "photo", file: `${tag(a.node)}-photo.jpg`, type: "Photo", sens: "Public", title: `Photo — ${a.title}`, notes: `Participants at the session, ${M}. Synthetic demo image.` });
    } else if (a.node === "A1.1") {
      out.push({ ...base, ind: a.ind, kind: "handover", file: `${tag(a.node)}-handover-certificate.pdf`, type: "Approval document", sens: "Internal", title: `Water point completion and handover certificates — ${M}`, notes: `Completion certificates signed by the engineer and the committee chairs, ${M}.` });
      out.push({ ...base, kind: "photo", file: `${tag(a.node)}-photo.jpg`, type: "Photo", sens: "Public", title: `Photo — water point, ${M}`, notes: "Hand-pump borehole at handover. Synthetic demo image." });
    } else if (a.node === "A1.2") {
      out.push({ ...base, ind: a.ind, kind: "latrines", file: `${tag(a.node)}-latrine-register.csv`, type: "Field visit report", sens: "Internal", title: `Latrine completion register — ${M}`, notes: `Register of latrines completed and inspected in ${M}.` });
    } else if (a.node === "A1.3") {
      out.push({ ...base, ind: a.ind, kind: "handover", file: `${tag(a.node)}-completion-certificate.pdf`, type: "Approval document", sens: "Internal", title: `WASH block completion certificate — ${M}`, notes: `Completion certificate for ${a.title}.` });
      out.push({ ...base, kind: "photo", file: `${tag(a.node)}-photo.jpg`, type: "Photo", sens: "Public", title: `Photo — ${a.title}`, notes: "WASH block with girls' and boys' latrines and handwashing points. Synthetic demo image." });
    } else if (a.node === "A2.3") {
      out.push({ ...base, ind: a.ind, kind: "wq", file: `${tag(a.node)}-water-quality-log.csv`, type: "Monitoring report", sens: "Internal", title: `Water quality test log — ${M}`, notes: `Free chlorine residual and bacteriology results for ${M}.` });
    } else if (a.node === "A2.4") {
      out.push({ ...base, ind: a.ind, kind: "dist", file: `${tag(a.node)}-distribution-list.csv`, type: "Distribution list", sens: "Internal", title: `Hygiene kit distribution list — ${M}`, notes: `Distribution list, ${v("WS-OP2.4", m)} households, ${M}. Names anonymised to household identifiers.` });
    }
  }
  // monitoring evidence for indicators whose value has no activity record that month
  const noAct = (node) => !activities(m).some((x) => x.node === node);
  if (m === 2 && noAct("A1.1")) {}
  if (m === 1) out.push({ m, node: "A2.2", ind: undefined, kind: "gbv", file: "02-safety-audit-latrine-siting.pdf", type: "Field visit report", sens: "Highly sensitive", loc: LOC.jere, title: "Confidential safety audit of latrine and water point siting — March 2026", notes: "Women's focus-group findings on safety at water points; highly sensitive, not for donor circulation.", a: activities(m).find((x) => x.node === "A2.2") });
  if (m === 0) out.push({ m, node: "A1.1", ind: undefined, kind: "proc", file: "01-drilling-contract-procurement-file.pdf", type: "Procurement document", sens: "Internal", loc: LOC.kond, title: "Drilling contractor procurement file — three-quote comparison and contract", notes: "Evaluation of three quotes, award decision and signed contract for borehole drilling.", a: activities(m).find((x) => x.node === "A1.1") });
  return out;
}
if (process.argv[1]?.endsWith("plan8.mjs")) {
  const fs = await import("node:fs"); const plan = MONTHS.map((_, m) => ({ acts: activities(m), story: story(m), ev: evidence(m) }));
  fs.writeFileSync("plan.json", JSON.stringify({ MONTHS, MN, IND, plan }, null, 1));
  console.log(plan.map((p, m) => `${MS[m]}: ${p.acts.length} acts, ${p.ev.length} files`).join("\n"), "\ntotal files", plan.reduce((a, p) => a + p.ev.length, 0));
}
// compliance statements, keyed by what the donor template section is about; ms = the months the period covers
export function stmt(label, ms) {
  const last = ms[ms.length - 1], list = (f) => ms.map(f).join(" ");
  if (/Water Quality|Sector Standards|WASH Standards/i.test(label)) {
    const tests = ms.reduce((a, m) => a + (mval("WS-OP2.3", m) ?? 0), 0);
    return `Water quality and standards: ${tests} water quality tests were carried out in the period and ${mval("WS-OC1c", last)} percent of the water points tested had a free chlorine residual of at least 0.2 mg/l at the end of it. Each new or rehabilitated water point was chlorinated and tested before handover, water points are designed for at least 15 litres per person per day within 500 metres, and latrines are lockable, lined and have a handwashing station in line with the SPHERE minimum standards.`;
  }
  if (/Access, Security/i.test(label)) return list((m) => `${EVT[m][0]} ${EVT[m][1]}`);
  if (/Protection|Gender/i.test(label)) return comp[compOf[last]];
  if (/Sustainab|Handover/i.test(label)) return "Handover: water point committees (seven members each, at least four women) now hold the keys, tariff books and spare parts, and the four LGA water boards received the maintenance plans, the asset register and the water quality monitoring schedule; school and health-centre management committees took over the WASH blocks with signed completion certificates. The project did not retain any asset.";
  if (/Risks|Lessons/i.test(label)) return "Risks that materialised: delayed contractor mobilisation, insecurity on the Mafa to Dikwa road, a drilling rig breakdown, the 2026 cholera alert and floods in Jere and Konduga. Mitigation: a second rig for hand-pump boreholes, early-morning construction in Ramadan, pit lining after the first rains, reorientation of hygiene sessions to cholera prevention and a flood contingency of kits. Lessons: committees that set a tariff early keep water points working; concrete rings are needed in sandy soils; chlorination at handover should be a standard step.";
  return "";
}
