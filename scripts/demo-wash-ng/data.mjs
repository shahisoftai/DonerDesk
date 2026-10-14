// Single source for demo 8 (Nigeria WASH, 8 months, Feb-Sep 2026). Every figure used anywhere comes from here.
export const MONTHS = ["2026-02","2026-03","2026-04","2026-05","2026-06","2026-07","2026-08","2026-09"];
export const MN = ["February 2026","March 2026","April 2026","May 2026","June 2026","July 2026","August 2026","September 2026"];
export const MS = ["Feb","Mar","Apr","May","Jun","Jul","Aug","Sep"];
// reporting periods: P0 Feb (monthly), P1 Mar (monthly), P2 Apr-Jun (quarterly), P3 Jul (monthly), P4 Aug (monthly), P5 Sep (final = closing)
export const PERIOD_OF = [0, 1, 2, 2, 2, 3, 4, 5];
export const PERIOD_LABEL = ["Feb 2026","Mar 2026","Apr-Jun 2026","Jul 2026","Aug 2026","Sep 2026"];
export const LOGFRAME = [
 ["Goal","G1","Reduced waterborne disease and improved health and dignity of displaced and host communities in Borno State, north-east Nigeria","Contribution to the Lake Chad Basin Resilience Fund WASH objective and SDG 6"],
 ["Outcome","O1","Displaced and host households use safe water and sanitation facilities in four LGAs","Specific objective 1"],
 ["Outcome","O2","Households adopt key hygiene practices and communities manage their WASH services","Specific objective 2"],
 ["Output","1.1","Water points constructed or rehabilitated and chlorinated","Boreholes, hand pumps and solar mini-schemes"],
 ["Output","1.2","Household latrines constructed by displaced and host households","Gender-sensitive, lockable, with handwashing station"],
 ["Output","1.3","School and health-facility WASH blocks constructed","Separate girls and boys blocks, with menstrual hygiene rooms"],
 ["Output","2.1","Women, men and children reached with hygiene promotion","Including cholera prevention messages"],
 ["Output","2.2","Water point committees established and trained","At least half of members are women"],
 ["Output","2.3","Water quality monitored at water points","Free chlorine residual and bacteriological tests"],
 ["Output","2.4","Households supplied with hygiene kits and household water treatment","Targeted at cholera and flood response"],
 ["Activity","A1.1","Survey, drill, rehabilitate and chlorinate water points",""],
 ["Activity","A1.2","Construct household latrines with the displaced and host households",""],
 ["Activity","A1.3","Construct WASH blocks in schools and health facilities",""],
 ["Activity","A2.1","Run community hygiene promotion with trained mobilisers",""],
 ["Activity","A2.2","Form, train and support water point committees",""],
 ["Activity","A2.3","Test water quality at water points",""],
 ["Activity","A2.4","Distribute hygiene kits and household water treatment",""],
];
const P = "Percentage", N = "Number";
// code, name, type, baseline, target, unit, MoV, source, frequency, disagg, logframe code, monthly series Feb..Sep, higher-is-better
export const IND = [
 ["WS-IMP1","Percentage of households reporting diarrhoea in a child under five in the last two weeks",P,31,18,"%","Household survey (baseline, mid-line and end-line)","Household WASH survey","Annual","no","G1",[,,,,,,,21],false],
 ["WS-OC1a","Percentage of households using an improved drinking water source",P,42,75,"%","Household survey report","Household WASH survey","Quarterly","no","O1",[,,,,58,,,72],true],
 ["WS-OC1b","Percentage of households with access to a functional, unshared latrine",P,28,55,"%","Household survey report","Household WASH survey","Quarterly","no","O1",[,,,,38,,,52],true],
 ["WS-OC1c","Percentage of water points with free chlorine residual of at least 0.2 mg/l",P,40,90,"%","Water quality test logs","Monthly water quality monitoring","Monthly","no","O1",[42,50,58,63,70,74,66,88],true],
 ["WS-OC2a","Percentage of households with a handwashing facility with soap and water",P,22,60,"%","Household survey and spot checks","Household WASH survey","Quarterly","no","O2",[,,,,41,,,63],true],
 ["WS-OC2b","Percentage of water point committees that are functional",P,15,80,"%","Committee functionality checklist","Committee monitoring visits","Monthly","no","O2",[,20,32,45,50,55,62,78],true],
 ["WS-OP1.1","Number of water points constructed or rehabilitated",N,0,20,"water points","Completion and handover certificates","Contractor and engineer records","Monthly","no","1.1",[,2,,3,3,2,3,3],true],
 ["WS-OP1.1b","Number of people with new or improved access to safe water",N,0,30000,"people","Water point population estimate and handover records","Engineer and community records","Monthly","yes","1.1",[,2400,,4200,4500,3000,5000,6900],true],
 ["WS-OP1.2","Number of household latrines constructed",N,0,600,"latrines","Latrine completion register and inspection checklists","Construction registers","Monthly","no","1.2",[,40,90,110,115,100,60,70],true],
 ["WS-OP1.3","Number of school and health-facility WASH blocks constructed",N,0,8,"blocks","Completion certificates","Contractor and engineer records","Monthly","no","1.3",[,,1,1,1,1,2,2],true],
 ["WS-OP2.1","Number of people reached with hygiene promotion",N,0,24000,"people","Session attendance registers","Mobiliser registers","Monthly","yes","2.1",[1500,2400,2800,3100,3300,3200,3600,3000],true],
 ["WS-OP2.2","Number of water point committees established and trained",N,0,16,"committees","Training attendance sheets and committee minutes","Committee registers","Monthly","no","2.2",[,3,3,3,2,2,1,1],true],
 ["WS-OP2.3","Number of water quality tests conducted",N,0,320,"tests","Water quality test logs","Water quality monitoring logs","Monthly","no","2.3",[20,35,40,45,45,50,55,50],true],
 ["WS-OP2.4","Number of households receiving hygiene kits and household water treatment",N,0,2500,"households","Distribution lists","Distribution registers","Monthly","no","2.4",[,,,,,600,1100,900],true],
];
export const SPLIT = {"WS-OP1.1b":0.55,"WS-OP2.1":0.60}; // female share
// FIN: budget line, budget, spent (USD)
export const FINANCE = [["Water supply infrastructure",260000,247500],["Sanitation and WASH blocks",150000,146200],["Hygiene promotion, kits and household water treatment",80000,83100],["Committees, training and capacity building",50000,47800],["Water quality monitoring",30000,28400],["Programme staff and field operations",90000,88300],["Monitoring, evaluation, accountability and learning",25000,19600],["Indirect costs",35000,34900]];

const idx = (code) => IND.findIndex((i) => i[0] === code);
export const ind = (code) => IND[idx(code)];
/** value of a monthly series for one calendar month (undefined = not recorded) */
export const mval = (code, m) => ind(code)[11][m];
const isRate = (code) => ind(code)[2] === P;
/** period achievement: a count is the sum over the months of the period, a rate is the last recorded month of it */
export function pval(code, p) {
  const months = PERIOD_OF.map((x, m) => (x === p ? m : -1)).filter((m) => m >= 0);
  const vs = months.map((m) => mval(code, m));
  if (isRate(code) || ind(code)[8] === "Annual") { const last = [...vs].reverse().find((v) => v != null); return last; }
  const rec = vs.filter((v) => v != null); return rec.length ? rec.reduce((a, b) => a + b, 0) : undefined;
}
/** cumulative to the end of period p (rates repeat the period value) */
export function pcum(code, p) {
  if (isRate(code) || ind(code)[8] === "Annual") return pval(code, p);
  let t = 0; for (let q = 0; q <= p; q++) t += pval(code, q) ?? 0; return t;
}
export const split = (v, share) => { const f = Math.round(v * share); return [f, v - f]; };
// cumulative expenditure to 30 June 2026 (end of the quarterly period)
export const FINANCE_Q = [["Water supply infrastructure",260000,118000],["Sanitation and WASH blocks",150000,62000],["Hygiene promotion, kits and household water treatment",80000,14000],["Committees, training and capacity building",50000,22000],["Water quality monitoring",30000,12000],["Programme staff and field operations",90000,44000],["Monitoring, evaluation, accountability and learning",25000,6000],["Indirect costs",35000,17000]];
