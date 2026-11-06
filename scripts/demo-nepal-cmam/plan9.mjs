// Demo 9 monthly inputs: completed-activity records, story answers. Every figure comes from data.mjs.
import { IND, MONTHS, MN, MS, PERIOD_OF, EVT, mval, split, SPLIT } from "./data.mjs";
export { MN, MS, PERIOD_OF };
const LAST = [31, 28, 31, 30, 31, 30, 31, 31];
const day = (m, d) => `${MONTHS[m]}-${String(Math.min(d, LAST[m])).padStart(2, "0")}`;
export const endOfMonth = (m) => day(m, LAST[m]);
const v = (c, m) => mval(c, m);
const LOC = { nep: "Nepalgunj Sub-Metropolitan City, Banke", koh: "Kohalpur Municipality, Banke", kha: "Khajura Rural Municipality, Banke", raj: "Rajapur Municipality, Bardiya", gul: "Gulariya Municipality, Bardiya", thak: "Thakurbaba Municipality, Bardiya" };
export const FULL = { "A1.1": "Screen children by mid-upper arm circumference and refer by active case finding", "A1.2": "Treat children with severe acute malnutrition in outpatient therapeutic care", "A1.3": "Treat children with moderate acute malnutrition with supplementary feeding", "A1.4": "Train health workers and volunteers in CMAM", "A2.1": "Counsel caregivers on infant and young child feeding", "A2.2": "Form and support mother support groups", "A2.3": "Deliver therapeutic and supplementary food to sites" };
const nm = (n, one, many = one + "s") => `${n.toLocaleString("en-US")} ${n === 1 ? one : many}`;
/** The month's completed-activity records. `plan` = the start of the planned activity's title it delivers. */
export function activities(m) {
  const M = MN[m], out = [];
  const add = (a) => out.push({ date: day(m, a.d), through: endOfMonth(m), challenges: EVT[m][0], adapt: EVT[m][1], ...a, title: `${FULL[a.node]}, ${M}` });
  const screened = v("NP-OP1.1", m), [girls, boys] = split(screened, SPLIT["NP-OP1.1"]);
  add({ node: "A1.1", plan: "Screen children", d: 3, title: `A1.1 — Mid-upper arm circumference screening, ${M}`, loc: LOC.nep, total: screened, female: girls, male: boys,
    summary: `Female community health volunteers screened ${nm(screened, "child", "children")} aged 6 to 59 months by mid-upper arm circumference at household visits, health posts and outreach sites in ${LOC.nep.split(",")[1].trim()} and ${LOC.raj.split(",")[1].trim()}, and referred children below the cut-off.`,
    achievements: `${nm(screened, "child", "children")} screened (${girls} girls and ${boys} boys); referrals sent to the nearest health post.`, lessons: "Screening at the weekly market and at the health post on the same day reached children whose caregivers would not otherwise travel.", next: "Continue active case finding in the wards with the highest referral numbers." });
  const sam = v("NP-OP1.2", m), [samG, samB] = split(sam, SPLIT["NP-OP1.2"]);
  add({ node: "A1.2", plan: "Treat children with severe", d: 5, title: `A1.2 — Outpatient therapeutic care for severe acute malnutrition, ${M}`, loc: LOC.koh, total: sam, female: samG, male: samB,
    summary: `Health post staff admitted ${nm(sam, "child", "children")} with severe acute malnutrition and no medical complications to outpatient therapeutic care and gave weekly therapeutic food and routine medicines.`,
    achievements: `${nm(sam, "child", "children")} admitted (${samG} girls and ${samB} boys).`, lessons: "Home follow-up of absent children by volunteers kept more children in treatment until discharge.", next: "Review the register for children absent two weeks in a row." });
  const mam = v("NP-OP1.3", m), [mamG, mamB] = split(mam, SPLIT["NP-OP1.3"]);
  add({ node: "A1.3", plan: "Treat children with moderate", d: 7, title: `A1.3 — Supplementary feeding for moderate acute malnutrition, ${M}`, loc: LOC.gul, total: mam, female: mamG, male: mamB,
    summary: `${nm(mam, "child", "children")} with moderate acute malnutrition were admitted to targeted supplementary feeding and received fortified food rations at monthly distributions.`,
    achievements: `${nm(mam, "child", "children")} admitted (${mamG} girls and ${mamB} boys).`, lessons: "A fixed monthly distribution day at the ward office made collection easier for families.", next: "Continue monthly rations and check that no ration is missed after a road closure." });
  const pl = v("NP-OP2.1", m), plF = Math.round(pl * 0.92);
  add({ node: "A2.1", plan: "Counsel caregivers", d: 10, title: `A2.1 — Infant and young child feeding counselling, ${M}`, loc: LOC.thak, total: pl, female: plF, male: pl - plF,
    summary: `Counsellors gave individual and group counselling on breastfeeding and complementary feeding to ${nm(pl, "pregnant or lactating woman or caregiver", "pregnant or lactating women and caregivers")}.`,
    achievements: `${nm(pl, "caregiver")} counselled (${plF} women and ${pl - plF} men).`, lessons: "Inviting grandmothers to the group sessions improved acceptance of the advice at home.", next: "Add a session on feeding during and after floods." });
  const g = v("NP-OP2.2", m);
  add({ node: "A2.2", plan: "Form and support", d: 14, title: `A2.2 — Mother support groups, ${M}`, loc: LOC.kha, total: g * 12, female: g * 12, male: 0,
    summary: `${nm(g, "new mother support group")} (twelve members each) ${g === 1 ? "was" : "were"} formed and supported with monthly meetings led by trained peer supporters.`,
    achievements: `${nm(g, "group")} formed.`, lessons: "Groups led by a respected local mother kept better attendance.", next: "Visit each new group within two weeks of its first meeting." });
  const c = v("NP-OP2.3", m);
  add({ node: "A2.3", plan: "Deliver therapeutic", d: 18, title: `A2.3 — Delivery of therapeutic and supplementary food, ${M}`, loc: LOC.nep, total: undefined, female: undefined, male: undefined,
    summary: `${nm(c, "carton")} of therapeutic and supplementary food ${c === 1 ? "was" : "were"} delivered from the provincial store to the health posts and outreach sites against signed delivery notes.`,
    achievements: `${nm(c, "carton")} delivered.`, lessons: "A fortnightly delivery schedule agreed with the district health office cut the days sites were short.", next: "Confirm stock cards at each site at month end." });
  const t = v("NP-OP1.4", m);
  if (t) add({ node: "A1.4", plan: "Train health", d: 20, title: `A1.4 — CMAM training for health workers and volunteers, ${M}`, loc: LOC.koh, total: t, female: Math.round(t * 0.7), male: t - Math.round(t * 0.7),
    summary: `${nm(t, "health worker or volunteer", "health workers and volunteers")} completed a ${t > 30 ? "three" : "two"}-day CMAM training covering screening, admission, follow-up and referral.`,
    achievements: `${nm(t, "person", "people")} trained (${Math.round(t * 0.7)} women and ${t - Math.round(t * 0.7)} men).`, lessons: "Practical sessions at a working health post were rated most useful.", next: "Follow up trained volunteers at their first screening round." });
  return out;
}

/** The five "Tell the story" answers of one month: achievements, challenges, variance, adaptations, lessons. */
export function story(m) {
  const M = MN[m];
  const cure = v("NP-OC1a", m), def = v("NP-OC1b", m), rec = v("NP-OC1d", m);
  return [
    `In ${M}, ${nm(v("NP-OP1.1", m), "child", "children")} were screened, ${nm(v("NP-OP1.2", m), "child", "children")} with severe acute malnutrition and ${nm(v("NP-OP1.3", m), "child", "children")} with moderate acute malnutrition were admitted, and ${nm(v("NP-OP2.1", m), "caregiver")} were counselled on infant and young child feeding.`,
    EVT[m][0],
    `The cure rate for severe acute malnutrition was ${cure} percent against a target of 75 percent and the default rate was ${def} percent against a target of 15 percent; the recovery rate for moderate acute malnutrition was ${rec} percent.`,
    EVT[m][1],
    "Home follow-up by volunteers and a fixed monthly distribution day kept more children in treatment until they recovered.",
  ];
}
