// Single source for demo 7 (see memorybank/demo/verification-demo-7-reference.md sections 4-7)
export const MONTHS = ["2025-10","2025-11","2025-12","2026-01","2026-02","2026-03","2026-04","2026-05","2026-06","2026-07","2026-08","2026-09"];
export const LOGFRAME = [
 ["Goal","G1","Reduced maternal and child mortality and improved health outcomes of women and children in Northern Ghana","Contribution to Global Gateway human development priorities and SDG 3"],
 ["Outcome","O1","Increased use of quality maternal, newborn and child health (MNCH) services in 40 facilities in 5 districts","Specific objective 1"],
 ["Outcome","O2","Strengthened district health governance, data use and health financing","Specific objective 2"],
 ["Output","1.1","Health workers (CHOs, midwives, nurses) competent in EmONC, IMNCI and essential newborn care","Clinical training and mentoring"],
 ["Output","1.2","Facilities equipped for safe delivery and cold chain","Delivery kits and solar vaccine fridges"],
 ["Output","1.3","Community health volunteers (CHVs) trained and active in case finding and referral","CHV training and refreshers"],
 ["Output","1.4","Outreach clinics delivered in hard-to-reach communities","Integrated outreach"],
 ["Output","1.5","Women reached with community education on ANC, delivery and danger signs","Community sessions"],
 ["Output","2.1","DHMT staff competent in data use (DHIMS2 and scorecards)","Data-use training"],
 ["Output","2.2","Supportive supervision delivered to facilities","Supervision visits"],
 ["Output","2.3","Quarterly district scorecards produced and reviewed","Review meetings"],
 ["Output","2.4","Households helped to enrol or renew NHIS membership","NHIS enrolment drives"],
 ["Output","2.5","Facility managers trained in respectful maternity care","Cross-cutting: gender and rights"],
 ["Activity","A1.1","Deliver EmONC, IMNCI and essential newborn care training and on-site mentoring",""],
 ["Activity","A1.2","Procure, deliver and install delivery kits and solar vaccine fridges",""],
 ["Activity","A1.3","Train and refresh community health volunteers",""],
 ["Activity","A1.4","Run integrated outreach clinics in hard-to-reach communities",""],
 ["Activity","A1.5","Hold community education sessions on ANC, delivery and danger signs",""],
 ["Activity","A2.1","Train DHMT staff in DHIMS2 and scorecard use",""],
 ["Activity","A2.2","Conduct supportive supervision visits to facilities",""],
 ["Activity","A2.3","Hold quarterly district scorecard review meetings",""],
 ["Activity","A2.4","Run NHIS enrolment and renewal drives",""],
 ["Activity","A2.5","Train facility managers in respectful maternity care",""],
];
const P="Percentage", N="Number";
// code, name, type, baseline, target, unit, MoV, source, frequency, disagg, logframe code, monthly series
const D = "DHIMS2 / GHS records";
export const IND = [
 ["MR-IMP1","Institutional maternal mortality ratio per 100,000 live births at supported facilities",N,168,120,"per 100,000 live births","GHS facility maternal death audit and DHIMS2 births","Annual maternal death review and DHIMS2","Annual","no","G1",[,,,,,,,,,,,131]],
 ["MR-OC1a","Percentage of pregnant women with four or more ANC visits",P,52,70,"%","DHIMS2 ANC register extract",D,"Monthly","no","O1",[53,54,53,56,57,59,61,59,62,61,60,66]],
 ["MR-OC1b","Percentage of deliveries attended by a skilled birth attendant",P,58,75,"%","DHIMS2 maternity register extract",D,"Monthly","no","O1",[59,60,60,62,63,65,67,66,68,69,68,72]],
 ["MR-OC1c","Percentage of children under 1 year receiving Penta3",P,71,88,"%","DHIMS2 immunisation summary",D,"Monthly","no","O1",[72,73,74,75,70,72,76,78,80,82,81,86]],
 ["MR-OC1d","Percentage of newborns with a postnatal check within 48 hours",P,34,60,"%","DHIMS2 postnatal register extract",D,"Monthly","no","O1",[36,38,39,41,43,45,48,46,50,52,52,57]],
 ["MR-OC1e","Percentage of facilities with no stock-out of tracer MNCH medicines",P,55,85,"%","Facility stock cards and monthly stock report","Facility stock cards","Monthly","no","O1",[58,60,62,65,60,68,72,70,76,78,77,83]],
 ["MR-OC2a","Percentage of facilities submitting complete and timely DHIMS2 reports",P,71,95,"%","DHIMS2 reporting-rate dashboard",D,"Monthly","no","O2",[74,77,78,82,84,86,89,86,90,92,91,95]],
 ["MR-OC2b","Percentage of target households covered by active NHIS membership",P,48,65,"%","Household coverage survey and NHIA records","Quarterly household spot survey","Quarterly","no","O2",[,,51,,,55,,,59,,,63]],
 ["MR-OC2c","Percentage of women satisfied with respectful maternity care",P,62,80,"%","Exit interview survey report","Quarterly exit interviews","Quarterly","no","O2",[,,65,,,70,,,74,,,78]],
 ["MR-OP1.1","Number of health workers trained in EmONC or IMNCI",N,0,240,"health workers","Training attendance sheets and certificates","Training registers","Monthly","yes","1.1",[,40,,45,,30,40,,35,30,,20]],
 ["MR-OP1.2","Number of facilities equipped with delivery kits and solar vaccine fridges",N,0,24,"facilities","Equipment handover certificates","Procurement and handover records","Monthly","no","1.2",[,2,3,2,,4,3,2,,3,2,2]],
 ["MR-OP1.3","Number of CHVs trained and active",N,0,300,"CHVs","CHV training registers and activity logs","CHV registers","Monthly","yes","1.3",[50,50,,50,50,,50,,30,20,,]],
 ["MR-OP1.4","Number of outreach clinics held",N,0,360,"clinics","Signed outreach clinic registers","Outreach registers","Monthly","no","1.4",[20,28,26,30,32,32,33,18,31,26,24,34]],
 ["MR-OP1.5","Number of women reached by community education sessions",N,0,18000,"women","Session attendance registers","Community session registers","Monthly","no","1.5",[900,1300,1250,1500,1600,1650,1700,900,1650,1400,1300,1850]],
 ["MR-OP2.1","Number of DHMT staff trained in data use",N,0,60,"staff","Training attendance sheets","Training registers","Monthly","yes","2.1",[,15,,,15,,15,,,15,,]],
 ["MR-OP2.2","Number of supportive supervision visits conducted",N,0,120,"visits","Signed supervision checklists","Supervision reports","Monthly","no","2.2",[6,8,8,10,10,11,11,6,11,10,9,12]],
 ["MR-OP2.3","Number of quarterly district scorecards produced",N,0,20,"scorecards","Published scorecards and review minutes","DHMT review minutes","Quarterly","no","2.3",[,,5,,,5,,,5,,,5]],
 ["MR-OP2.4","Number of households assisted with NHIS enrolment or renewal",N,0,6000,"households","NHIS enrolment drive registers","NHIA drive registers","Monthly","no","2.4",[300,400,450,500,520,560,600,350,560,520,480,760]],
 ["MR-OP2.5","Number of facility managers trained in respectful maternity care",N,0,40,"managers","Training attendance sheets","Training registers","Monthly","yes","2.5",[,,10,,,10,,10,,10,,]],
];
export const SPLIT = {"MR-OP1.1":0.70,"MR-OP1.3":0.60,"MR-OP2.1":0.70,"MR-OP2.5":0.55}; // female share
export const FINANCE = [["Personnel",520000,505000],["Training and capacity building",310000,298000],["Equipment and supplies",420000,395000],["Community outreach and education",190000,184000],["Travel and supportive supervision",110000,109200],["Local office and operations",100000,98300],["Monitoring, evaluation, visibility and audit",60000,36900],["Indirect costs",90000,86000]];
