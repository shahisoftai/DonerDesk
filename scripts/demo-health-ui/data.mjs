export const MONTHS = ["March","April","May","June","July","August"];
export const MON = ["2026-03","2026-04","2026-05","2026-06","2026-07","2026-08"];
export const LAST = [31,30,31,30,31,31];
// indicator code -> [name, type, baseline, target, unit, means, source, freq, breakdown(yes/no), logframe code, monthly values]
export const IND = [
 ["HL-OC1a","Percentage of pregnant women with four or more ANC visits (ANC4+) at supported facilities","Percentage",28,45,"%","KHIS/DHIS2 MOH 405 ANC register extract","Facility ANC registers via KHIS","Monthly","no","O1",[29,32,36,40,43,46],"rate"],
 ["HL-OC1b","Percentage of deliveries attended by a skilled birth attendant at supported facilities","Percentage",41,60,"%","KHIS/DHIS2 MOH 333 maternity register extract","Facility maternity registers via KHIS","Monthly","no","O1",[42,46,50,54,58,61],"rate"],
 ["HL-OC1c","Percentage of children under 1 year who received DTP3/Penta3 at supported facilities","Percentage",62,80,"%","KHIS/DHIS2 MOH 710 immunization summary","Facility immunization registers via KHIS","Monthly","no","O1",[63,66,70,74,78,81],"rate"],
 ["HL-OC2a","Percentage of caregivers of children under five who can name at least three child danger signs","Percentage",31,60,"%","Community KAP spot survey report","Quarterly CHV-led KAP spot survey","Quarterly","no","O2",[null,null,44,null,null,61],"rate"],
 ["HL-1.1a","Number of health workers trained in EmONC, IMCI or essential newborn care","Number",0,120,"health workers","Training attendance sheets and certificates","Training registers","Monthly","yes","1.1",[14,26,24,22,20,16],"count"],
 ["HL-1.1b","Number of facility clinical mentorship visits conducted","Number",0,84,"visits","Signed mentorship visit logs","Mentor visit reports","Monthly","no","1.1",[8,14,14,14,14,14],"count"],
 ["HL-1.2a","Number of health facilities equipped with the essential MNCH equipment kit","Number",0,14,"facilities","Equipment handover certificates","Procurement and handover records","Monthly","no","1.2",[0,3,4,4,2,1],"count"],
 ["HL-1.3a","Number of pregnant women making a first ANC visit at supported facilities","Number",0,4200,"women","MOH 405 ANC register extracts","Facility ANC registers","Monthly","yes","1.3",[380,640,720,760,740,700],"count"],
 ["HL-1.3b","Number of deliveries attended by a skilled birth attendant at supported facilities","Number",0,2100,"deliveries","MOH 333 maternity register extracts","Facility maternity registers","Monthly","no","1.3",[160,280,330,350,340,340],"count"],
 ["HL-1.3c","Number of women referred for emergency obstetric care using the transport voucher scheme","Number",0,180,"women","Voucher claim forms and referral slips","Voucher register","Monthly","no","1.3",[10,22,30,34,32,34],"count"],
 ["HL-1.4a","Number of children under 1 year who received DTP3/Penta3","Number",0,3300,"children","MOH 710 immunization tally sheets","Facility and outreach immunization registers","Monthly","yes","1.4",[290,420,520,560,560,540],"count"],
 ["HL-1.4b","Number of outreach immunization sessions conducted","Number",0,180,"sessions","Outreach session logs","Outreach session records","Monthly","no","1.4",[18,28,30,32,32,34],"count"],
 ["HL-1.5a","Percentage of supported facilities submitting KHIS monthly reports on time","Percentage",64,90,"%","KHIS reporting-rate dashboard export","KHIS reporting-rate dashboard","Monthly","no","1.5",[66,72,79,84,88,92],"rate"],
 ["HL-2.1a","Number of community health volunteers (CHVs) trained and kitted","Number",0,220,"CHVs","CHV training registers","CHV training records","Monthly","yes","2.1",[40,60,50,40,20,10],"count"],
 ["HL-2.2a","Number of people reached with community health education","Number",0,18000,"people","Community dialogue attendance sheets","CHV and community dialogue registers","Monthly","yes","2.2",[1800,2600,3100,3400,3400,3200],"count"],
 ["HL-2.3a","Number of children 6-59 months screened for acute malnutrition using MUAC","Number",0,9000,"children","CHV MUAC screening logs","CHV MUAC registers","Monthly","yes","2.3",[900,1300,1550,1700,1700,1650],"count"],
 ["HL-2.3b","Number of children with acute malnutrition referred to treatment","Number",0,650,"children","Referral slips and CMAM site registers","CHV referral slips","Monthly","no","2.3",[60,90,110,120,125,120],"count"],
];
export const FEM = { "HL-1.1a":0.58, "HL-1.3a":1.0, "HL-1.4a":0.50, "HL-2.1a":0.64, "HL-2.2a":0.62, "HL-2.3a":0.51 };
export const val = (c, m) => IND.find(i => i[0] === c)[11][m];
export const cum = (c, m) => { const i = IND.find(x => x[0] === c); return i[12] === "rate" ? i[11][m] : i[11].slice(0, m + 1).reduce((a, b) => a + (b ?? 0), 0); };
export const split = (v, share) => { const f = Math.round(v * share); return [f, v - f]; };
