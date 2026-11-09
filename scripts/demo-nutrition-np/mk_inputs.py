"""Demo 14 inputs (Nepal CMAM + IYCF, UNICEF, 6 months). All organisations/people/figures fictional. Usage: python3 mk_inputs.py <outdir>"""
import sys, csv, os
from docx import Document
from openpyxl import Workbook
out = sys.argv[1]; os.makedirs(out, exist_ok=True)
LF = [
("GOAL","G","Acute malnutrition among children under five is reduced and infant and young child feeding practices are improved in Karnali and Sudurpashchim Provinces, Nepal"),
("OUTCOME","OC1","Children 6-59 months with severe and moderate acute malnutrition are identified early and recover through quality community-based management of acute malnutrition (CMAM/IMAM)"),
("OUTPUT","1.1","Community volunteers and health workers identify and refer children with acute malnutrition early"),
("ACTIVITY","A1.1.1","Train female community health volunteers (FCHVs) and health workers on MUAC screening and referral"),
("ACTIVITY","A1.1.2","Monthly community MUAC and oedema screening campaigns and outreach"),
("OUTPUT","1.2","Health facilities deliver quality outpatient therapeutic care for children with SAM and supplementary care for MAM"),
("ACTIVITY","A1.2.1","Establish and support outpatient therapeutic programme (OTP) sites and stabilisation centre referral"),
("ACTIVITY","A1.2.2","Train health workers in the national IMAM guideline and provide supportive supervision"),
("ACTIVITY","A1.2.3","Supply RUTF, essential medicines and anthropometric equipment to treatment sites"),
("OUTCOME","OC2","Caregivers of children under two practise optimal infant and young child feeding (IYCF)"),
("OUTPUT","2.1","Pregnant and breastfeeding women and caregivers receive IYCF counselling and peer support"),
("ACTIVITY","A2.1.1","Individual IYCF counselling at health facilities and through home visits"),
("ACTIVITY","A2.1.2","Form and support mother support groups and complementary feeding cooking demonstrations"),
("OUTPUT","2.2","Children 6-23 months and women receive micronutrient supplements and nutritious local foods"),
("ACTIVITY","A2.2.1","Distribute micronutrient powder (MNP) to children 6-23 months and iron-folic acid to pregnant women"),
("OUTCOME","OC3","Local governments and communities sustain nutrition services and healthy feeding norms"),
("OUTPUT","3.1","Municipal nutrition coordination and monitoring systems function"),
("ACTIVITY","A3.1.1","Support municipal nutrition and food security coordination committee meetings and monthly data review"),
("OUTPUT","3.2","Communities are reached with social and behaviour change communication on nutrition"),
("ACTIVITY","A3.2.1","Radio programmes, community dialogues and school-based nutrition messaging"),
]
IND = [  # code,name,type,baseline,target,unit,frequency,disagg,result,source
("GI-1","Prevalence of global acute malnutrition (MUAC <125 mm or oedema) among children 6-59 months in project districts","PERCENTAGE","9.5","7","%","Quarterly","","G","Rapid MUAC survey"),
("OC1a","SAM treatment cure rate (OTP discharges)","PERCENTAGE","68","80","%","Monthly","","OC1","OTP monthly reports (cohort)"),
("OC1b","SAM treatment default rate","PERCENTAGE","18","10","%","Monthly","","OC1","OTP monthly reports (cohort)"),
("OC1c","SAM treatment death rate","PERCENTAGE","1.5","1","%","Monthly","","OC1","OTP monthly reports (cohort)"),
("OP1-1a","Children 6-59 months screened for acute malnutrition using MUAC","NUMBER","0","36000","children","Monthly","","1.1","MUAC screening registers"),
("OP1-1b","Children with SAM admitted to outpatient therapeutic care","NUMBER","0","1800","children","Monthly","","1.1","OTP admission registers"),
("OP1-1c","Children with MAM enrolled in supplementary feeding and counselling","NUMBER","0","3000","children","Monthly","","1.1","MAM registers"),
("OP1-1d","FCHVs trained in MUAC screening and referral","NUMBER","0","600","FCHVs","Monthly","","1.1","Training attendance sheets"),
("OP1-2a","Health facilities functioning as OTP sites","NUMBER","0","40","facilities","Monthly","","1.2","Site assessment checklist"),
("OP1-2b","Health workers trained in the national IMAM guideline","NUMBER","0","240","health workers","Monthly","","1.2","Training attendance sheets"),
("OP1-2c","Cartons of RUTF delivered to treatment sites","NUMBER","0","2400","cartons","Monthly","","1.2","Delivery notes"),
("OP1-2d","Treatment sites with no RUTF stock-out during the month","PERCENTAGE","0","95","%","Monthly","","1.2","Stock reports"),
("OC2a","Infants 0-5 months exclusively breastfed","PERCENTAGE","56","65","%","Quarterly","","OC2","Household KPC survey"),
("OC2b","Children 6-23 months receiving a minimum acceptable diet","PERCENTAGE","43","55","%","Quarterly","","OC2","Household KPC survey"),
("OC2c","Newborns put to the breast within one hour of birth","PERCENTAGE","55","70","%","Quarterly","","OC2","Household KPC survey"),
("OP2-1a","Pregnant and breastfeeding women and caregivers receiving individual IYCF counselling","NUMBER","0","18000","people","Monthly","","2.1","Counselling registers"),
("OP2-1b","Mother support groups established and functioning","NUMBER","0","150","groups","Monthly","","2.1","Group records"),
("OP2-1c","Complementary feeding cooking demonstration sessions held","NUMBER","0","900","sessions","Monthly","","2.1","Session reports"),
("OP2-1d","Caregivers of children 6-23 months attending cooking demonstrations","NUMBER","0","7200","caregivers","Monthly","","2.1","Attendance sheets"),
("OP2-2a","Children 6-23 months receiving micronutrient powder (MNP)","NUMBER","0","9000","children","Monthly","","2.2","MNP distribution registers"),
("OP2-2b","Pregnant women receiving iron-folic acid supplements","NUMBER","0","7000","women","Monthly","","2.2","ANC registers"),
("OC3a","Supported health facilities meeting the IMAM quality checklist","PERCENTAGE","0","80","%","Quarterly","","OC3","Supervision checklists"),
("OP3-1a","Municipal nutrition coordination committee meetings supported","NUMBER","0","30","meetings","Monthly","","3.1","Meeting minutes"),
("OP3-1b","Supportive supervision visits to treatment sites","NUMBER","0","150","visits","Monthly","","3.1","Supervision reports"),
("OP3-2a","Radio nutrition programmes broadcast","NUMBER","0","120","broadcasts","Monthly","","3.2","Broadcast logs"),
("OP3-2b","People reached through community dialogues and school messaging","NUMBER","0","12000","people","Monthly","","3.2","Attendance sheets"),
]
PLAN = [
("A1.1.1","Training of FCHVs on MUAC screening - Jumla and Kalikot","2026-11-02","2026-11-27","Jumla",""),
("A1.1.1","Training of FCHVs on MUAC screening - Mugu, Humla and Bajura","2026-11-09","2026-12-18","Mugu",""),
("A1.1.2","Monthly MUAC screening campaign - Jumla","2026-11-16","2026-11-20","Jumla","monthly"),
("A1.1.2","Monthly MUAC screening campaign - Kalikot","2026-11-17","2026-11-21","Kalikot","monthly"),
("A1.1.2","Monthly MUAC screening campaign - Mugu and Humla","2026-11-18","2026-11-24","Mugu","monthly"),
("A1.1.2","Monthly MUAC screening campaign - Bajura","2026-11-19","2026-11-25","Bajura","monthly"),
("A1.2.1","Establish and support OTP sites","2026-11-02","2027-04-23","Jumla",""),
("A1.2.2","IMAM guideline training for health workers","2026-11-09","2027-01-29","Kalikot",""),
("A1.2.2","Monthly supportive supervision to OTP sites","2026-11-23","2026-11-27","Humla","monthly"),
("A1.2.3","RUTF and essential supplies delivery","2026-11-09","2026-11-20","Jumla","monthly"),
("A2.1.1","Individual IYCF counselling at facilities and home visits","2026-11-02","2026-11-27","Bajura","monthly"),
("A2.1.2","Mother support groups and cooking demonstrations","2026-11-09","2026-11-27","Kalikot","monthly"),
("A2.2.1","Micronutrient powder and iron-folic acid distribution","2026-11-16","2026-11-27","Mugu","monthly"),
("A3.1.1","Municipal nutrition coordination committee meetings and data review","2026-11-23","2026-11-27","Jumla","monthly"),
("A3.2.1","Radio programmes and community dialogues","2026-11-02","2026-11-27","Humla","monthly"),
("A3.2.1","School-based nutrition messaging","2027-01-11","2027-03-26","Bajura",""),
]
BUDGET = [("CMAM treatment (RUTF, medicines, equipment)",210000),("MUAC screening and community mobilisation",95000),("Training and supportive supervision",85000),
("IYCF counselling and mother support groups",120000),("Micronutrient supplementation",70000),("Coordination, SBCC and radio",55000),("Monitoring, evaluation and learning",45000),("Staff and administration",70000)]
assert sum(b for _,b in BUDGET)==750000
for n,rows,h in [("logframe",LF,["Level","Code","Title"]),("indicators",IND,["Code","Name","Type","Baseline","Target","Unit","Frequency","Disaggregated","Logframe Code","Data source"]),("workplan",PLAN,["Logframe Code","Title","Start","End","Location","Repeats"])]:
    with open(f"{out}/{n}.csv","w",newline="") as f: w=csv.writer(f); w.writerow(h); w.writerows(rows)
d=Document()
d.add_heading("Integrated Management of Acute Malnutrition and Infant and Young Child Feeding in Karnali and Sudurpashchim Provinces (CMAM-IYCF-NP)",0)
d.add_paragraph("Project proposal to UNICEF Nepal Country Office, Programme Cooperation Agreement. Implementing partner: Karnali Nutrition and Community Health Alliance (KNCHA). All organisations, people and figures in this document are fictional.")
d.add_heading("1. Project summary",1)
for t in ["Project code: NP-NUT-20261101. Agreement number (fictional): UNICEF-NPL-PCA-2026-0457. Donor: UNICEF. Sector: Nutrition. Country: Nepal. Duration: 1 November 2026 to 30 April 2027 (six months). Budget: USD 750,000, expressed in US dollars.",
"KNCHA supports the Ministry of Health and Population and the provincial and local governments to strengthen community-based management of acute malnutrition (CMAM, delivered in Nepal as the Integrated Management of Acute Malnutrition, IMAM) and infant and young child feeding (IYCF) in five districts: Jumla, Kalikot, Mugu and Humla (Karnali Province) and Bajura (Sudurpashchim Province). The project follows the national IMAM guideline and the Multisectoral Nutrition Plan."]: d.add_paragraph(t)
d.add_heading("2. Context and needs",1)
d.add_paragraph("Nepal has made progress in reducing stunting and wasting, but the mid- and far-western hills and mountains remain among the areas where child malnutrition is highest. The 2022 Nepal Demographic and Health Survey reports about 25% stunting and about 8% wasting among children under five, exclusive breastfeeding of about 56% among infants under six months, and a minimum acceptable diet for fewer than half of children 6-23 months. Remote communities have long travel times to health facilities, seasonal food shortages and limited complementary feeding diversity. The figures used for targets in this scenario are illustrative.")
d.add_heading("3. Results framework",1)
t=d.add_table(rows=1,cols=3); t.style="Table Grid"
for i,h in enumerate(["Level","Code","Result"]): t.rows[0].cells[i].text=h
for r in LF:
    c=t.add_row().cells
    for i,v in enumerate(r): c[i].text=v
d.add_heading("4. Indicators",1)
d.add_paragraph("Treatment performance follows the Sphere minimum standards for SAM: cure rate above 75%, death rate below 10% and default rate below 15%; the project aims higher.")
t=d.add_table(rows=1,cols=8); t.style="Table Grid"
for i,h in enumerate(["Code","Indicator","Baseline","Target","Unit","Frequency","Means of verification","Result"]): t.rows[0].cells[i].text=h
for r in IND:
    c=t.add_row().cells
    for i,v in enumerate([r[0],r[1],r[3],r[4],r[5],r[6],r[9],r[8]]): c[i].text=v
d.add_heading("5. Risks and assumptions",1)
for t_ in ["Risk (high): monsoon landslides and road closures delay delivery of RUTF to remote health posts in Humla and Mugu. Mitigation: pre-position three months of RUTF stock and use helicopter or porter routes where needed.",
"Risk (medium): winter snow and cold limit caregiver attendance and community screening in high-altitude areas. Mitigation: reschedule sessions and use FCHV home visits.",
"Risk (medium): health worker turnover reduces the quality of IMAM services. Mitigation: refresher training and mentoring during supervision.",
"Risk (low): RUTF sharing within households reduces recovery. Mitigation: counselling on correct RUTF use.",
"Assumption: provincial and local governments continue to host and co-fund nutrition coordination committees.",
"Assumption: UNICEF supply pipeline delivers RUTF and MNP on schedule."]: d.add_paragraph(t_)
d.add_heading("6. Reporting",1)
d.add_paragraph("KNCHA reports monthly to UNICEF, with a mid-project report after three months and a final report after the end date.")
d.save(f"{out}/NP-Proposal.docx")
wb=Workbook(); ws=wb.active; ws.title="Summary Budget"
ws.append(["Budget category","Total (USD)"]); ws.append(["The budget is expressed in US dollars (USD)."])
for n,a in BUDGET: ws.append([n,a])
ws.append(["Total",750000]); wb.save(f"{out}/NP-Budget.xlsx")
wb=Workbook(); ws=wb.active; ws.title="Work plan"; ws.append(["Logframe Code","Title","Start","End","Location"])
for r in PLAN: ws.append(list(r[:5]))
wb.save(f"{out}/NP-WorkPlan.xlsx")
wb=Workbook(); ws=wb.active; ws.title="Logframe"; ws.append(["Level","Code","Title"])
for r in LF: ws.append(list(r))
wb.save(f"{out}/NP-Logframe.xlsx")
wb=Workbook(); ws=wb.active; ws.title="Indicators"; ws.append(["Indicator","Code","Baseline","Target","Unit","Frequency","Means of verification","Result"])
for r in IND: ws.append([r[1],r[0],r[3],r[4],r[5],r[6],r[9],r[8]])
wb.save(f"{out}/NP-Indicators.xlsx"); print("ok")
