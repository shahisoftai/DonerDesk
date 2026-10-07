// Demo 7 monthly inputs: activity records, story answers, evidence manifest. Every figure comes from data.mjs.
import { IND, SPLIT, MONTHS } from "./data.mjs";
export const MN = ["October 2025","November 2025","December 2025","January 2026","February 2026","March 2026","April 2026","May 2026","June 2026","July 2026","August 2026","September 2026"];
export const MS = ["Oct","Nov","Dec","Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep"];
const LAST = [31,30,31,31,28,31,30,31,30,31,31,30];
export const val = (c, m) => IND.find(i => i[0] === c)[11][m];
export const cum = (c, m) => { const i = IND.find(x => x[0] === c); return i[2] === "Percentage" || i[8] === "Annual" ? val(c, m) : i[11].slice(0, m + 1).reduce((a, b) => a + (b ?? 0), 0); };
export const split = (v, share) => { const f = Math.round(v * share); return [f, v - f]; };
const day = (m, d) => `${MONTHS[m]}-${String(Math.min(d, LAST[m])).padStart(2, "0")}`;
const D = ["Tolon","Kumbungu","Savelugu","Nanton","Karaga"];
const SITE = [["Tolon Health Centre","Wantugu CHPS compound","Kumbungu Health Centre"],["Savelugu Municipal Hospital","Voggu CHPS compound","Nanton Health Centre"],["Karaga Health Centre","Zangbalun CHPS compound","Tolon Health Centre"],["Kumbungu Health Centre","Diare CHPS compound","Savelugu Municipal Hospital"]];
const site = (m, k) => SITE[m % 4][k];
const DIST_OF = {"Tolon Health Centre":"Tolon","Wantugu CHPS compound":"Tolon","Kumbungu Health Centre":"Kumbungu","Voggu CHPS compound":"Kumbungu","Diare CHPS compound":"Kumbungu","Savelugu Municipal Hospital":"Savelugu","Nanton Health Centre":"Nanton","Karaga Health Centre":"Karaga","Zangbalun CHPS compound":"Karaga"};
const dist = (m, k) => k < 3 ? DIST_OF[SITE[m % 4][k]] : D[(m + k) % 5];
// month events: short challenge, adaptation
export const EVT = [
 ["Recruitment of six nurse-mentors and the first procurement round took longer than planned, so supported facilities were only partly covered in the first weeks.", "Baseline assessments of all 40 facilities were completed and mentors deployed from the second week."],
 ["Some CHPS compounds in Karaga could not be reached by the training team for two days after heavy late-season rain.", "Training venues were moved to the nearest health centre."],
 ["The harmattan and the Christmas holidays reduced clinic attendance and several health workers were on leave in the last two weeks of the month.", "Outreach days were moved to market days and the training schedule was compressed into the first half of the month."],
 ["Two vehicles were out of service for part of the month, limiting supervision visits to remote CHPS compounds.", "Visits were combined with outreach trips and a motorbike was hired for Karaga."],
 ["A national shortage of Penta (pentavalent) vaccine lasted about three weeks and several tracer medicines were out of stock at facility level.", "Children missed during the shortage were listed by CHVs and recalled in the last week; the Regional Health Directorate was asked to redistribute stock between districts."],
 ["Delivery of the solar vaccine fridges needed more installation days than planned because of poor access roads to two CHPS compounds.", "Installation teams worked in pairs and technicians trained facility staff on daily temperature logging at handover."],
 ["No major disruption; some facilities still uploaded their DHIMS2 reports after the deadline.", "The district health information officers followed up late facilities by phone at the end of each week."],
 ["An industrial action by nurses and community health officers lasted about two weeks and closed or reduced services at many facilities in the five districts.", "Training and outreach were suspended during the action; project mobile teams supported emergency services and clinics were rescheduled in June."],
 ["A backlog of clinics and trainings postponed in May had to be fitted into June alongside the quarterly survey round.", "The team ran extra clinics at weekends and combined two training cohorts."],
 ["Flooding and the lean season cut road access in Savelugu and Nanton for several days and two CHPS compounds closed temporarily.", "Outreach in the flood-affected communities was re-planned on higher ground routes and CHVs delivered ANC reminders on foot."],
 ["Flooding continued in the first half of August and an equipment shipment was held at customs, delaying the last delivery kits.", "Deliveries were re-sequenced to the accessible districts first and the shipment clearance was followed up weekly with the clearing agent."],
 ["Close-out workload (end-line survey, final scorecards and handover) coincided with the end of staff contracts.", "Handover meetings were held in each district before staff contracts ended."],
];
const adapt = m => EVT[m][1];
const kit = (m) => val("MR-OP1.2", m);
export function activities(m) {
  const M = MN[m], v = c => val(c, m), out = [];
  const add = (a) => out.push({ date: day(m, a.d), challenges: EVT[m][0], adapt: adapt(m), ...a });
  const tr = (code, node, d, what, loc, next, lesson) => {
    const t = v(code); if (t == null) return; const [f, ml] = split(t, SPLIT[code] ?? 0.65);
    add({ node, d, title: `${node} — ${what}, ${M} (${loc})`, loc: `${loc}, ${DIST_OF[loc] ?? dist(m, 0)} District`, total: t, female: f, male: ml,
      summary: `${t} participants (${f} female, ${ml} male) attended ${what.toLowerCase()} held at ${loc} in ${M}.`, achievements: `${t} people trained in ${M} (${f} female, ${ml} male); life-of-Action total ${cum(code, m)} of ${IND.find(i => i[0] === code)[4]}.`,
      lessons: lesson, next, ind: code });
  };
  tr("MR-OP1.1", "A1.1", 9, "EmONC, IMNCI and essential newborn care training with on-site mentoring", site(m, 0), "Hold the next cohort and follow up trained staff with mentoring visits.", "Mentoring at the facility within a month of the classroom course improves use of the partograph and neonatal resuscitation.");
  if (v("MR-OP1.2") != null) add({ node: "A1.2", d: 14, title: `A1.2 — Delivery kits and solar vaccine fridges installed at ${v("MR-OP1.2")} facilit${v("MR-OP1.2") === 1 ? "y" : "ies"}, ${M}`, loc: `${site(m, 1)}, ${dist(m, 1)} District`,
      summary: `Delivery kits (delivery sets, neonatal resuscitation equipment, fetal dopplers) and solar vaccine fridges were delivered and installed at ${v("MR-OP1.2")} facilities in ${M}; handover certificates were signed by the in-charges and logged by the district health directorate.`,
      achievements: `${v("MR-OP1.2")} facilities equipped in ${M}; ${cum("MR-OP1.2", m)} of 24 equipped to date.`, lessons: "Technician handover and a daily temperature log at installation keep fridges working after the project.", next: "Install the remaining kits and fridges as stock arrives.", ind: "MR-OP1.2" });
  tr("MR-OP1.3", "A1.3", 11, "CHV training and refresher sessions", site(m, 1), "Continue CHV cohorts and refresher sessions.", "Training CHVs at the nearest CHPS compound reduces absenteeism.");
  add({ node: "A1.4", d: 20, title: `A1.4 — Integrated outreach clinics, ${M} (${dist(m, 2)} District)`, loc: `${site(m, 2)} catchment, ${dist(m, 2)} District`,
    summary: `${v("MR-OP1.4")} integrated outreach clinics (ANC, immunisation, postnatal checks and child weighing) were held in hard-to-reach communities in ${M}. DHIMS2 shows ${v("MR-OC1a")} percent of pregnant women with four or more ANC visits, ${v("MR-OC1b")} percent skilled deliveries and ${v("MR-OC1c")} percent Penta3 coverage at supported facilities.`,
    achievements: `${v("MR-OP1.4")} outreach clinics held in ${M}; ${cum("MR-OP1.4", m)} of 360 to date. ANC4+ ${v("MR-OC1a")} percent, skilled delivery ${v("MR-OC1b")} percent, Penta3 ${v("MR-OC1c")} percent, postnatal check within 48 hours ${v("MR-OC1d")} percent.`,
    lessons: "Fixed outreach calendars shared with CHVs and chiefs raise turnout.", next: "Hold the planned clinics and review outreach routes against the road conditions.", ind: "MR-OP1.4" });
  add({ node: "A1.5", d: 17, title: `A1.5 — Community education sessions on ANC, delivery and danger signs, ${M}`, loc: `${dist(m, 1)} District communities`, total: v("MR-OP1.5"), female: v("MR-OP1.5"), male: 0,
    summary: `CHVs and community mobilisers held community education sessions on antenatal care, facility delivery and newborn danger signs and reached ${v("MR-OP1.5")} women in ${M}.`,
    achievements: `${v("MR-OP1.5")} women reached in ${M}; ${cum("MR-OP1.5", m)} of 18,000 to date.`, lessons: "Sessions at market days and water points reach more women than sessions at fixed venues.", next: "Continue the sessions and add radio spots.", ind: "MR-OP1.5" });
  tr("MR-OP2.1", "A2.1", 10, "DHIMS2 and scorecard data-use training for DHMT staff", `${dist(m, 0)} District Health Directorate`, "Support DHMTs to use the new data views in monthly review meetings.", "Training on the district's own data is more useful than generic examples.");
  add({ node: "A2.2", d: 24, title: `A2.2 — Supportive supervision visits, ${M} (${dist(m, 2)} District)`, loc: `${site(m, 2)}, ${dist(m, 2)} District`,
    summary: `District teams and project staff made ${v("MR-OP2.2")} supportive supervision visits to facilities in ${M}, using the standard checklist; findings covered partograph use, stock management, cold chain and DHIMS2 completeness. ${v("MR-OC2a")} percent of facilities submitted complete and timely DHIMS2 reports and ${v("MR-OC1e")} percent had no tracer-medicine stock-out.`,
    achievements: `${v("MR-OP2.2")} visits done in ${M}; ${cum("MR-OP2.2", m)} of 120 to date. DHIMS2 completeness and timeliness ${v("MR-OC2a")} percent; no stock-out at ${v("MR-OC1e")} percent of facilities.`,
    lessons: "A checklist with agreed actions that is reviewed at the next visit closes gaps faster than reports alone.", next: "Follow up the actions agreed at each facility.", ind: "MR-OP2.2" });
  if (v("MR-OP2.3") != null) add({ node: "A2.3", d: 27, title: `A2.3 — Quarterly district scorecard review meetings, ${M}`, loc: "Tamale, Northern Region", total: 25, female: 11, male: 14,
    summary: `The five DHMTs produced and reviewed their quarterly scorecards for the quarter ending ${M}; ${v("MR-OP2.3")} scorecards were published and review minutes recorded agreed actions. NHIS coverage reached ${v("MR-OC2b")} percent and ${v("MR-OC2c")} percent of women exit-interviewed were satisfied with respectful maternity care.`,
    achievements: `${v("MR-OP2.3")} district scorecards produced; ${cum("MR-OP2.3", m)} of 20 to date. NHIS coverage ${v("MR-OC2b")} percent; satisfaction with respectful maternity care ${v("MR-OC2c")} percent.`,
    lessons: "Scorecards presented with district budgets get faster action from the district assemblies.", next: "Follow the agreed actions in the next quarter.", ind: "MR-OP2.3" });
  add({ node: "A2.4", d: 19, title: `A2.4 — NHIS enrolment and renewal drives, ${M}`, loc: `${dist(m, 2)} and ${dist(m, 4)} Districts`,
    summary: `NHIA district officers and CHVs ran enrolment and renewal drives and registered or renewed ${v("MR-OP2.4")} households in ${M}, prioritising households with pregnant women and children under five.`,
    achievements: `${v("MR-OP2.4")} households assisted in ${M}; ${cum("MR-OP2.4", m)} of 6,000 to date.`, lessons: "Drives at antenatal clinics reach pregnant women directly.", next: "Continue drives and follow up renewals due next month.", ind: "MR-OP2.4" });
  tr("MR-OP2.5", "A2.5", 12, "respectful maternity care training for facility managers", `${dist(m, 1)} District Health Directorate`, "Support managers to put the agreed action plans in place.", "Managers who hear women's exit-interview feedback commit to concrete changes.");
  return out;
}
const comp = [
 "Gender: 60 percent of the CHVs trained were women, and ANC and postnatal services were prioritised for adolescent mothers. Environment: sharps boxes and placenta pits were checked at all facilities visited and used solar cold chain avoids diesel generators. Do-no-harm: no safeguarding incident was reported; all trainings used attendance sheets with consent for photographs.",
 "Gender: women made up 60 percent of CHVs trained and community sessions were held at times women could attend. Environment: healthcare waste was segregated at all newly equipped facilities and old vaccine fridges were returned to the regional stores for responsible disposal. Do-no-harm: no incident reported; CHVs were briefed on confidentiality of patient information.",
 "Gender: the first respectful maternity care cohort included 10 facility managers (6 women) and maternity staff agreed on privacy and companion-of-choice practices. Environment: waste pits were inspected during holiday coverage. Do-no-harm: a maternal death at a district hospital was reviewed under the confidential maternal death audit; the summary is held as highly sensitive and is not for donor circulation.",
 "Gender: 55 percent of DHMT staff trained were women. Environment: motorbike hire replaced a second vehicle, reducing fuel use on short trips. Do-no-harm: no safeguarding incident reported.",
 "Gender: CHVs prioritised pregnant women and newborns in the Penta recall list. Environment: expired vaccines were returned for incineration under district supervision. Do-no-harm: no incident; recall lists kept by CHVs were handled with consent.",
 "Gender: women and men CHV supervisors both received solar-fridge handover training. Environment: solar fridges reduce diesel use and old fridges were handed to the regional stores. Do-no-harm: installation teams used safe working practices and no injuries were reported.",
 "Gender: 70 percent of health workers trained were women. Environment: sharps and placenta pit checks were done at every supervision visit. Do-no-harm: no incident reported.",
 "Gender: emergency obstetric care was prioritised during the industrial action and mobile teams ran antenatal clinics for women in Karaga. Environment: waste management checks were paused for two weeks. Do-no-harm: the project did not replace striking staff and referred women to the nearest functioning facility.",
 "Gender: weekend clinics were arranged so women could attend with their companions. Environment: no change. Do-no-harm: no incident reported.",
 "Gender: CHVs reached pregnant women in flood-affected communities with referral advice. Environment: flooded pit latrines at two CHPS compounds were reported to the district for disinfection. Do-no-harm: outreach teams avoided unsafe flooded routes and followed district safety guidance.",
 "Gender: women's exit-interview satisfaction continued to improve. Environment: flood damage to waste pits at two CHPS compounds was repaired. Do-no-harm: no incident reported; the customs delay did not affect patient safety.",
 "Gender: final results show 70 percent of trained health workers were women and satisfaction with respectful maternity care rose from 62 to 78 percent. Environment: all solar fridges and waste pits were handed over to the districts. Do-no-harm: no safeguarding incident was reported during the Action.",
];
export function story(m) {
  const t = c => val(c, m);
  const well = [
   `The Action started on 1 October 2025: baseline assessments were completed in all 40 facilities, ${t("MR-OP1.3")} CHVs were trained and ${t("MR-OP1.4")} outreach clinics were held. The EU kick-off meeting was held in Tolon.`,
   `The first EmONC/IMNCI cohort trained ${t("MR-OP1.1")} health workers, ${t("MR-OP1.2")} facilities were equipped and ${t("MR-OP2.1")} DHMT staff trained in data use. A launch event with the district chief executives and press took place in Tamale.`,
   `The first quarterly scorecards (${t("MR-OP2.3")}) were produced and ${t("MR-OP2.5")} facility managers trained in respectful maternity care. ${t("MR-OP2.4")} households were helped with NHIS.`,
   `Training continued with ${t("MR-OP1.1")} health workers and ${t("MR-OP1.3")} CHVs; ${t("MR-OP1.2")} more facilities were equipped; skilled delivery reached ${t("MR-OC1b")} percent.`,
   `${t("MR-OP1.4")} outreach clinics were held, the most so far; CHVs trained: ${t("MR-OP1.3")}; DHMT staff trained: ${t("MR-OP2.1")}. Timely DHIMS2 reporting reached ${t("MR-OC2a")} percent.`,
   `Solar vaccine fridges were installed at ${t("MR-OP1.2")} facilities, the second scorecard round was completed and ${t("MR-OP1.1")} health workers were trained. Satisfaction with respectful maternity care reached ${t("MR-OC2c")} percent and NHIS coverage ${t("MR-OC2b")} percent.`,
   `The best month so far for services: ${t("MR-OP1.4")} outreach clinics, ${t("MR-OP1.5")} women reached and ${t("MR-OP2.4")} households assisted with NHIS; ANC4+ reached ${t("MR-OC1a")} percent.`,
   `Despite the industrial action, ${t("MR-OP1.4")} clinics were held with project mobile teams and ${t("MR-OP2.5")} facility managers were trained in respectful maternity care.`,
   `Recovery: ${t("MR-OP1.4")} clinics, ${t("MR-OP1.5")} women reached and the third scorecard round (${t("MR-OP2.3")} scorecards). Penta3 coverage rose to ${t("MR-OC1c")} percent.`,
   `${t("MR-OP1.1")} health workers trained, ${t("MR-OP1.2")} facilities equipped and ${t("MR-OP2.1")} DHMT staff trained despite flooding; timely DHIMS2 reporting reached ${t("MR-OC2a")} percent.`,
   `${t("MR-OP1.2")} more facilities equipped and ${t("MR-OP1.4")} clinics held while floods continued; timely DHIMS2 reporting stayed at ${t("MR-OC2a")} percent.`,
   `Close-out: end-line survey completed, final scorecards produced and the programme handed over to the five DHMTs. The institutional maternal mortality ratio was ${t("MR-IMP1")} per 100,000 live births against a baseline of 168.`,
  ][m];
  const gap = [
   "Training numbers are still at zero for the first month because the first cohort was scheduled for November.",
   "CHV numbers are on plan; equipment deliveries were two against a plan of three because of a delayed shipment of fridges.",
   "ANC4+ fell slightly during the holiday period; the scorecards were produced on time.",
   "On plan for all indicators except two supervision vehicles being out of service.",
   `Penta3 coverage fell to ${val("MR-OC1c", 4)} percent and tracer-medicine availability to ${val("MR-OC1e", 4)} percent because of the national Penta shortage; both are expected to recover once stock arrives.`,
   "Equipment and training on plan; the Penta and stock-out dip of February recovered.",
   "On or above plan for all service indicators.",
   `Outreach clinics fell to ${val("MR-OP1.4", 7)} against about 30 planned, and there was no training or CHV cohort, because of the two-week industrial action; ANC4+ and postnatal checks dipped.`,
   "On plan after the recovery; the backlog from May was cleared.",
   "Outreach and ANC slowed in Savelugu and Nanton because of floods; trainings were met.",
   `The last equipment shipment was held at customs, so ${cum("MR-OP1.2", 10)} of 24 facilities are equipped to date.`,
   `The impact target (maternal mortality ratio ${val("MR-IMP1", 11)} against a target of 120) was missed although the ratio fell from 168; outreach clinics (334 of 360), women reached (17,000 of 18,000), supervision visits (112 of 120) and equipped facilities (23 of 24) finished slightly below target.`,
  ][m];
  return [well, EVT[m][0], gap, adapt(m), [
   "A CHV in Tolon, supported by the project referral advice, accompanied a woman with severe pre-eclampsia signs to the district hospital in time for a safe delivery.",
   "The first training cohort in Tolon led two health centres to start using the partograph for every delivery.",
   "After the first respectful maternity care session, a hospital maternity ward introduced a privacy screen and companion-of-choice policy.",
   "A Karaga CHPS compound started a daily temperature log after the solar fridge handover.",
   "CHV recall lists helped trace and vaccinate children missed during the Penta shortage once stock arrived.",
   "Solar fridges allowed two remote CHPS compounds to hold Penta stock for the first time.",
   "Weekly late-facility calls raised timely DHIMS2 reporting to 89 percent.",
   "Project mobile teams kept emergency obstetric referrals running during the industrial action.",
   "Weekend clinics cleared the May backlog in two weeks.",
   "CHV foot visits kept ANC reminders going in flooded Savelugu communities.",
   "Weekly follow-up with the clearing agent finally released the last equipment shipment in September.",
   "All five districts adopted the scorecard in their quarterly review agendas.",
  ][m], comp[m]];
}
// evidence manifest: one record per file
export function evidence(m) {
  const M = MN[m], acts = activities(m), out = []; const tag = n => `${String(m + 1).padStart(2, "0")}-${n}`;
  for (const a of acts) {
    if (["A1.1","A1.3","A2.1","A2.5"].includes(a.node)) {
      out.push({ m, node: a.node, ind: a.ind, kind: "attendance", file: `${tag(a.node)}-attendance.csv`, type: "Attendance sheet", sens: "Internal", loc: a.loc, title: `Attendance — ${a.title}`, notes: `Attendance register: ${a.total} participants (${a.female} female, ${a.male} male), ${M}.`, a });
      out.push({ m, node: a.node, kind: "photo", file: `${tag(a.node)}-photo.jpg`, type: "Photo", sens: "Public", loc: a.loc, title: `Photo — ${a.title}`, notes: `Participants at the session, ${M}. Synthetic demo image; EU-funded banner visible.`, a });
    } else if (a.node === "A1.2") {
      out.push({ m, node: a.node, ind: a.ind, kind: "handover", file: `${tag(a.node)}-handover.pdf`, type: "Approval document", sens: "Internal", loc: a.loc, title: `Handover certificates — ${M}`, notes: `Equipment handover certificates for ${val("MR-OP1.2", m)} facilities signed by facility in-charges.`, a });
      out.push({ m, node: a.node, kind: "photo", file: `${tag(a.node)}-photo.jpg`, type: "Photo", sens: "Public", loc: a.loc, title: `Photo — solar fridge installation, ${M}`, notes: "Installed solar vaccine fridge with EU visibility sticker. Synthetic demo image.", a });
    } else if (a.node === "A1.4") {
      out.push({ m, node: a.node, ind: a.ind, kind: "outreach", file: `${tag(a.node)}-outreach-register.csv`, type: "Field visit report", sens: "Internal", loc: a.loc, title: `Outreach clinic register — ${M}`, notes: `Register of ${val("MR-OP1.4", m)} outreach clinics held in ${M}.`, a });
      out.push({ m, node: a.node, ind: "MR-OC1a", kind: "dhims", file: `${tag(a.node)}-dhims2-extract.csv`, type: "Monitoring report", sens: "Internal", loc: "Northern Region (five districts)", title: `DHIMS2 outcome extract — ${M}`, notes: `DHIMS2 extract for ${M}: ANC4+ ${val("MR-OC1a", m)}%, skilled delivery ${val("MR-OC1b", m)}%, Penta3 ${val("MR-OC1c", m)}%.`, a });
    } else if (a.node === "A1.5") {
      out.push({ m, node: a.node, ind: a.ind, kind: "attendance", file: `${tag(a.node)}-attendance.csv`, type: "Attendance sheet", sens: "Internal", loc: a.loc, title: `Session attendance — community education, ${M}`, notes: `Attendance totals across sessions: ${a.total} women, ${M}.`, a });
    } else if (a.node === "A2.2") {
      out.push({ m, node: a.node, ind: a.ind, kind: "supervision", file: `${tag(a.node)}-supervision.pdf`, type: "Monitoring report", sens: "Internal", loc: a.loc, title: `Supervision checklists — ${M}`, notes: `Signed supervision checklists for ${val("MR-OP2.2", m)} visits.`, a });
    } else if (a.node === "A2.3") {
      out.push({ m, node: a.node, ind: a.ind, kind: "minutes", file: `${tag(a.node)}-scorecard-minutes.pdf`, type: "Approval document", sens: "Internal", loc: a.loc, title: `Scorecard review minutes — ${M}`, notes: `Minutes of the quarterly district scorecard review meetings, ${M}.`, a });
    } else if (a.node === "A2.4") {
      out.push({ m, node: a.node, ind: a.ind, kind: "nhis", file: `${tag(a.node)}-nhis-register.csv`, type: "Beneficiary list", sens: "Internal", loc: a.loc, title: `NHIS enrolment register — ${M}`, notes: `Register of ${val("MR-OP2.4", m)} households enrolled or renewed, ${M}. Names removed.`, a });
    }
  }
  if (m === 2) out.push({ m, node: "A2.2", kind: "mdr", file: "03-maternal-death-review-summary.pdf", type: "Field visit report", sens: "Highly sensitive", loc: "Savelugu Municipal Hospital", title: "Confidential maternal death review summary — December 2025", notes: "Summary of one confidential maternal death review. Highly sensitive: not for donor circulation.", a: acts.find(x => x.node === "A2.2") });
  return out;
}
export const FIN = null;
if (process.argv[1]?.endsWith("plan7.mjs")) {
  const fs = await import("node:fs"); const plan = MONTHS.map((_, m) => ({ acts: activities(m), story: story(m), ev: evidence(m) }));
  fs.writeFileSync("plan.json", JSON.stringify({ MONTHS, MN, IND, plan }, null, 1));
  console.log(plan.map((p, m) => `${MS[m]}: ${p.acts.length} acts, ${p.ev.length} files`).join("\n"), "\ntotal files", plan.reduce((a, p) => a + p.ev.length, 0));
}
