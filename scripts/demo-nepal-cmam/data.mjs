// Single source for demo 9 (Nepal CMAM for flood-affected communities, 8 months, Jan-Aug 2026). Every figure used anywhere comes from here.
// Phase 28 focus: a work plan built from the logframe, four people, requests, a flood that moves and cancels planned work, problems/risks,
// comments, and quarterly/final reports that cite planned vs held.
export const PROJECT = {
  title: "[DEMO-9] Community Management of Acute Malnutrition (CMAM) for Flood-Affected Communities, Banke and Bardiya, Nepal",
  code: "NPL-CMAM", donor: "Himalayan Child Nutrition Fund", country: "Nepal", region: "Lumbini Province", district: "Banke and Bardiya",
  sector: "Nutrition", start: "2026-01-01", end: "2026-08-31", budget: 480000, currency: "USD",
  description: "Community-based treatment of severe and moderate acute malnutrition in children under five, with infant and young child feeding counselling for pregnant and lactating women, in eight flood-affected rural municipalities of Banke and Bardiya after the 2025 monsoon floods.",
};
export const MONTHS = ["2026-01","2026-02","2026-03","2026-04","2026-05","2026-06","2026-07","2026-08"];
export const MN = ["January 2026","February 2026","March 2026","April 2026","May 2026","June 2026","July 2026","August 2026"];
export const MS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug"];
// reporting periods: P0 Jan, P1 Feb (monthly), P2 Mar-May (quarterly), P3 Jun, P4 Jul (monthly), P5 Aug (final)
export const PERIOD_OF = [0, 1, 2, 2, 2, 3, 4, 5];
export const PERIOD_LABEL = ["Jan 2026", "Feb 2026", "Mar-May 2026", "Jun 2026", "Jul 2026", "Aug 2026"];
export const LOGFRAME = [
 ["Goal","G1","Reduced illness and death from acute malnutrition among children under five and pregnant and lactating women in flood-affected communities of Banke and Bardiya","Contribution to the Nepal Multi-Sector Nutrition Plan and SDG 2"],
 ["Outcome","O1","Children aged 6 to 59 months with severe or moderate acute malnutrition recover through community-based treatment","Specific objective 1"],
 ["Output","1.1","Children aged 6 to 59 months screened for acute malnutrition","Mid-upper arm circumference screening by female community health volunteers"],
 ["Activity","A1.1","Screen children by mid-upper arm circumference and refer by active case finding",""],
 ["Output","1.2","Children with severe acute malnutrition admitted to outpatient therapeutic care","Health posts and flood-time outreach sites"],
 ["Activity","A1.2","Treat children with severe acute malnutrition in outpatient therapeutic care",""],
 ["Output","1.3","Children with moderate acute malnutrition admitted to supplementary feeding","Targeted supplementary feeding with fortified food"],
 ["Activity","A1.3","Treat children with moderate acute malnutrition with supplementary feeding",""],
 ["Output","1.4","Health workers and female community health volunteers trained in CMAM","Including flood-time referral and supply procedures"],
 ["Activity","A1.4","Train health workers and volunteers in CMAM",""],
 ["Outcome","O2","Caregivers practise recommended infant and young child feeding and use nutrition services","Specific objective 2"],
 ["Output","2.1","Pregnant and lactating women and caregivers counselled on infant and young child feeding","Individual and group counselling"],
 ["Activity","A2.1","Counsel caregivers on infant and young child feeding",""],
 ["Output","2.2","Mother support groups formed and active","Peer support for breastfeeding and complementary feeding"],
 ["Activity","A2.2","Form and support mother support groups",""],
 ["Output","2.3","Therapeutic and supplementary food distributed without stock-outs","Cartons of therapeutic food delivered to sites"],
 ["Activity","A2.3","Deliver therapeutic and supplementary food to sites",""],
];
const P = "Percentage", N = "Number";
// code, name, type, baseline, target, unit, MoV, source, frequency, disagg, logframe code, monthly series Jan..Aug, higher-is-better
export const IND = [
 ["NP-IMP1","Prevalence of global acute malnutrition in children aged 6 to 59 months",P,14.2,10,"%","SMART nutrition survey (baseline and end-line)","SMART survey","Annual","no","G1",[,,,,,,,10.5],false],
 ["NP-OC1a","Cure rate of children with severe acute malnutrition discharged from outpatient care",P,60,75,"%","Outpatient register and monthly CMAM report","Health post registers","Monthly","no","O1",[68,70,72,74,77,76,73,79],true],
 ["NP-OC1b","Default rate of children with severe acute malnutrition",P,24,15,"%","Outpatient register and monthly CMAM report","Health post registers","Monthly","no","O1",[22,20,18,17,15,16,18,13],false],
 ["NP-OC1c","Death rate of children with severe acute malnutrition",P,3.5,3,"%","Outpatient register and monthly CMAM report","Health post registers","Monthly","no","O1",[2.1,1.8,1.5,1.2,1.0,1.4,1.6,0.9],false],
 ["NP-OC1d","Recovery rate of children with moderate acute malnutrition",P,60,75,"%","Supplementary feeding register","Health post registers","Monthly","no","O1",[66,69,72,75,78,77,74,80],true],
 ["NP-OC2a","Percentage of children aged 6 to 23 months with minimum dietary diversity",P,28,45,"%","Household nutrition survey","Household survey","Quarterly","no","O2",[,,,,41,,,46],true],
 ["NP-OP1.1","Number of children aged 6 to 59 months screened",N,0,24000,"children","Screening registers","Volunteer screening registers","Monthly","yes","1.1",[1800,2600,3200,3400,3300,3000,2400,3600],true],
 ["NP-OP1.2","Number of children with severe acute malnutrition admitted to outpatient care",N,0,1200,"children","Outpatient register","Health post registers","Monthly","yes","1.2",[60,110,150,170,165,140,130,150],true],
 ["NP-OP1.3","Number of children with moderate acute malnutrition admitted to supplementary feeding",N,0,3600,"children","Supplementary feeding register","Health post registers","Monthly","yes","1.3",[180,320,430,480,460,420,350,420],true],
 ["NP-OP1.4","Number of health workers and volunteers trained in CMAM",N,0,180,"people","Training attendance sheets","Training records","Monthly","no","1.4",[40,,45,,35,,20,40],true],
 ["NP-OP2.1","Number of pregnant and lactating women and caregivers counselled on infant and young child feeding",N,0,6000,"people","Counselling registers","Counsellor registers","Monthly","no","2.1",[450,650,780,800,780,700,640,780],true],
 ["NP-OP2.2","Number of mother support groups formed",N,0,60,"groups","Group registers","Group registers","Monthly","no","2.2",[4,6,8,9,8,7,6,8],true],
 ["NP-OP2.3","Number of cartons of therapeutic food distributed to sites",N,0,4000,"cartons","Delivery notes and stock cards","Supply records","Monthly","no","2.3",[180,300,420,480,460,400,360,400],true],
];
export const SPLIT = {"NP-OP1.1": 0.52, "NP-OP1.2": 0.55, "NP-OP1.3": 0.54}; // girls share
export const FINANCE = [["Therapeutic and supplementary food",170000,164800],["Health worker and volunteer training",60000,57100],["Screening, outreach and transport",90000,93400],["Counselling and mother support groups",50000,46200],["Programme staff",80000,78900],["Monitoring, evaluation and administration",30000,29600]];
const idx = (code) => IND.findIndex((i) => i[0] === code);
export const ind = (code) => IND[idx(code)];
export const mval = (code, m) => ind(code)[11][m];
const isRate = (code) => ind(code)[2] === P;
export function pval(code, p) {
  const months = PERIOD_OF.map((x, m) => (x === p ? m : -1)).filter((m) => m >= 0);
  const vs = months.map((m) => mval(code, m));
  if (isRate(code) || ind(code)[8] === "Annual") return [...vs].reverse().find((v) => v != null);
  const rec = vs.filter((v) => v != null); return rec.length ? rec.reduce((a, b) => a + b, 0) : undefined;
}
export function pcum(code, p) {
  if (isRate(code) || ind(code)[8] === "Annual") return pval(code, p);
  let t = 0; for (let q = 0; q <= p; q++) t += pval(code, q) ?? 0; return t;
}
export const split = (v, share) => { const f = Math.round(v * share); return [f, v - f]; };
// People: one admin (the signed-in user) plus four invited demo users
export const PEOPLE = [
  { name: "Sunita Thapa", email: "sunita.thapa.demo@example.org", role: "PROJECT_MANAGER" },
  { name: "Ram Bahadur Chaudhary", email: "ram.chaudhary.demo@example.org", role: "FIELD_OFFICER" },
  { name: "Anita Gurung", email: "anita.gurung.demo@example.org", role: "ME_OFFICER" },
  { name: "Bikash Rana", email: "bikash.rana.demo@example.org", role: "GRANTS_OFFICER" },
];
// What happens each month: [challenge, adaptation]
export const EVT = [
 ["Heavy winter fog and cold closed outreach sites in Banke for several days and two volunteers were still being oriented.", "Screening rounds moved to late morning and warm shelters were arranged at the Kohalpur and Nepalgunj sites."],
 ["Some caregivers travelled back to flood-damaged homes and missed their weekly outpatient visits.", "Volunteers followed up absent children at home and the visit day was aligned with the local market day."],
 ["Therapeutic food deliveries arrived late from the provincial store and three health posts ran short for nine days.", "Stock was redistributed between health posts and a fortnightly delivery schedule was agreed with the district health office."],
 ["The Karnali river bank breach on the Bardiya side cut the road to Rajapur for a week during the Tihar-season movement.", "Outreach rounds went by tractor trailer and volunteers carried supplies on foot to the cut-off wards."],
 ["Pre-monsoon storms damaged the roof of one health post and cold chain refrigeration failed twice.", "The health post moved its clinic to the ward office and the refrigeration was repaired by the municipality."],
 ["Early monsoon rains flooded the Rapti and Babai river crossings and four outreach sites could not be reached for ten days.", "The affected rounds were moved to the first dry days and the cancelled round was folded into the next month."],
 ["Floodwater in Bardiya displaced about 600 households and damaged two screening registers and a store of fortified food.", "Registers were rebuilt from volunteer notebooks, damaged stock was replaced and mobile teams followed displaced families to the relief camps."],
 ["The final month coincided with the monsoon peak and the end of volunteer stipends.", "Handover meetings were held in each rural municipality and registers were transferred to the health posts."],
];
