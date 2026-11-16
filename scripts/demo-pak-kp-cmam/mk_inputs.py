"""Pakistan KP CMAM+IYCF demo inputs (Upper Dir + Mardan, UNICEF, 1 Nov 2026 - 30 Apr 2027).
Indicator set follows the 2021 Pakistan nutrition reporting sheet (boys/girls splits, OTP/SFP/SC cohorts, PLW, IYCF, supplies).
Six places per district (3 tehsils + 3 facilities). All people, sites and figures are fictional.
Usage: python3 mk_inputs.py <outdir>"""
import sys, csv, os, json
from docx import Document
from openpyxl import Workbook
out = sys.argv[1] if len(sys.argv) > 1 else "inputs"; os.makedirs(out, exist_ok=True)

LF = [
("GOAL","G","Acute malnutrition among children 6-59 months and pregnant and lactating women (PLW) is reduced and infant and young child feeding (IYCF) practices are improved in Upper Dir and Mardan districts, Khyber Pakhtunkhwa"),
("OUTCOME","OC1","Children 6-59 months with severe or moderate acute malnutrition are found early and recover through quality community-based management of acute malnutrition (CMAM) that meets Sphere standards"),
("OUTPUT","1.1","Children 6-59 months are screened for acute malnutrition by MUAC and oedema check and referred"),
("ACTIVITY","A1.1.1","Monthly community MUAC and oedema screening by lady health workers and community volunteers"),
("ACTIVITY","A1.1.2","Refer screened SAM and MAM cases to OTP, SFP or stabilisation centre"),
("OUTPUT","1.2","Children with SAM without complications are treated in outpatient therapeutic programme (OTP) sites"),
("ACTIVITY","A1.2.1","Run OTP sites: admission, weekly RUTF distribution and follow-up"),
("OUTPUT","1.3","Children with MAM are treated in supplementary feeding programme (SFP) sites"),
("ACTIVITY","A1.3.1","Run SFP sites: ration distribution and follow-up"),
("OUTPUT","1.4","Children with SAM and medical complications are treated in stabilisation centres (SC)"),
("ACTIVITY","A1.4.1","Operate stabilisation centres: F-75, F-100 and ReSoMal treatment"),
("OUTCOME","OC2","Pregnant and lactating women are screened and treated, and caregivers practise optimal infant and young child feeding"),
("OUTPUT","2.1","PLW are screened and malnourished PLW are enrolled in supplementary feeding"),
("ACTIVITY","A2.1.1","Screen PLW by MUAC at health facilities and in the community and enrol malnourished PLW in SFP"),
("OUTPUT","2.2","PLW and caregivers receive IYCF counselling"),
("ACTIVITY","A2.2.1","IYCF counselling sessions at health facilities"),
("ACTIVITY","A2.2.2","IYCF counselling sessions in communities"),
("OUTPUT","2.3","Children 6-23 months and PLW receive micronutrient supplements"),
("ACTIVITY","A2.3.1","Distribute micronutrient powder (MNP) to children 6-23 months, and iron-folic acid (IFA) and multiple micronutrients (MMN) to PLW"),
("OUTCOME","OC3","Nutrition supplies and monthly data systems are reliable so that services do not stop"),
("OUTPUT","3.1","Nutrition supplies are received, stored and used without stock-outs"),
("ACTIVITY","A3.1.1","Manage nutrition supplies: RUTF, RUSF, F-75, F-100, ReSoMal, MNP, IFA and MUAC tapes"),
("OUTPUT","3.2","Monthly district nutrition data are complete, reviewed and reported on time"),
("ACTIVITY","A3.2.1","Monthly district data review, supportive supervision and training of health staff"),
]
def I(c,n,t,tg,u,r,src,sex=True,better="Higher",base="0"):
    return (c,n,t,"" if t=="PERCENTAGE" else base,tg,u,"Monthly","Sex" if sex else "",r,src,better)
IND = [
I("OC1-1","OTP cure rate (SAM children discharged cured / total OTP exits)","PERCENTAGE","75","%","OC1","OTP monthly exit registers"),
I("OC1-2","OTP death rate","PERCENTAGE","10","%","OC1","OTP monthly exit registers",better="Lower"),
I("OC1-3","OTP default rate","PERCENTAGE","15","%","OC1","OTP monthly exit registers",better="Lower"),
I("OC1-4","OTP non-response rate","PERCENTAGE","10","%","OC1","OTP monthly exit registers",better="Lower"),
I("OC1-5","SFP cure rate (MAM children discharged cured / total SFP exits)","PERCENTAGE","75","%","OC1","SFP monthly exit registers"),
I("OC1-6","SFP death rate","PERCENTAGE","3","%","OC1","SFP monthly exit registers",better="Lower"),
I("OC1-7","SFP default rate","PERCENTAGE","15","%","OC1","SFP monthly exit registers",better="Lower"),
I("OC1-8","SFP non-response rate","PERCENTAGE","15","%","OC1","SFP monthly exit registers",better="Lower"),
I("OC1-9","Stabilisation centre cure rate","PERCENTAGE","75","%","OC1","SC monthly exit registers"),
I("OC1-10","Stabilisation centre death rate","PERCENTAGE","10","%","OC1","SC monthly exit registers",better="Lower"),
I("OC1-11","Stabilisation centre default rate","PERCENTAGE","15","%","OC1","SC monthly exit registers",better="Lower"),
I("OP1.1-1","Children 6-59 months screened for acute malnutrition","NUMBER","150000","children","1.1","MUAC screening registers"),
I("OP1.1-2","Children screened with MUAC above 12.5 cm (healthy)","NUMBER","130000","children","1.1","MUAC screening registers"),
I("OP1.1-3","Children screened with MAM (MUAC 11.5 to 12.5 cm)","NUMBER","14000","children","1.1","MUAC screening registers"),
I("OP1.1-4","Children screened with SAM (MUAC below 11.5 cm)","NUMBER","4800","children","1.1","MUAC screening registers"),
I("OP1.1-5","Children screened with bilateral pitting oedema","NUMBER","300","children","1.1","MUAC screening registers"),
I("OP1.2-1","New SAM admissions in OTP","NUMBER","4200","children","1.2","OTP admission registers"),
I("OP1.2-2","Children discharged cured from OTP","NUMBER","3350","children","1.2","OTP exit registers"),
I("OP1.2-3","Children who died in OTP","NUMBER","40","children","1.2","OTP exit registers",better="Lower"),
I("OP1.2-4","Children who defaulted from OTP","NUMBER","400","children","1.2","OTP exit registers",better="Lower"),
I("OP1.2-5","Children non-recovered (non-response) in OTP","NUMBER","250","children","1.2","OTP exit registers",better="Lower"),
I("OP1.2-6","Children moved out from OTP (transfers)","NUMBER","160","children","1.2","OTP exit registers",better="Lower"),
I("OP1.2-7","Functional OTP sites","NUMBER","60","sites","1.2","Site lists",sex=False),
I("OP1.3-1","New MAM admissions in SFP","NUMBER","11000","children","1.3","SFP admission registers"),
I("OP1.3-2","Children discharged cured from SFP","NUMBER","8800","children","1.3","SFP exit registers"),
I("OP1.3-3","Children who died in SFP","NUMBER","60","children","1.3","SFP exit registers",better="Lower"),
I("OP1.3-4","Children who defaulted from SFP","NUMBER","1000","children","1.3","SFP exit registers",better="Lower"),
I("OP1.3-5","Children non-recovered (non-response) in SFP","NUMBER","600","children","1.3","SFP exit registers",better="Lower"),
I("OP1.3-6","Children moved out from SFP (transfers)","NUMBER","300","children","1.3","SFP exit registers",better="Lower"),
I("OP1.3-7","Functional SFP sites","NUMBER","70","sites","1.3","Site lists",sex=False),
I("OP1.4-1","New admissions in stabilisation centres","NUMBER","450","children","1.4","SC admission registers"),
I("OP1.4-2","Children discharged cured from stabilisation centres","NUMBER","360","children","1.4","SC exit registers"),
I("OP1.4-3","Children who died in stabilisation centres","NUMBER","20","children","1.4","SC exit registers",better="Lower"),
I("OP1.4-4","Children who defaulted from stabilisation centres","NUMBER","50","children","1.4","SC exit registers",better="Lower"),
I("OP1.4-5","Functional stabilisation centres","NUMBER","4","sites","1.4","Site lists",sex=False),
I("OP2.1-1","PLW screened by MUAC","NUMBER","40000","women","2.1","PLW screening registers",sex=False),
I("OP2.1-2","Malnourished PLW enrolled in SFP","NUMBER","6000","women","2.1","PLW SFP registers",sex=False),
I("OP2.1-3","PLW discharged cured from SFP","NUMBER","4500","women","2.1","PLW SFP registers",sex=False),
I("OP2.1-4","PLW who defaulted from SFP","NUMBER","500","women","2.1","PLW SFP registers",sex=False,better="Lower"),
I("OP2.2-1","IYCF counselling sessions held at health facilities","NUMBER","1200","sessions","2.2","IYCF session records",sex=False),
I("OP2.2-2","IYCF counselling sessions held in communities","NUMBER","2400","sessions","2.2","IYCF session records",sex=False),
I("OP2.2-3","PLW and caregivers counselled on IYCF at health facilities","NUMBER","24000","people","2.2","Attendance sheets",sex=False),
I("OP2.2-4","PLW and caregivers counselled on IYCF in communities","NUMBER","36000","people","2.2","Attendance sheets",sex=False),
I("OP2.3-1","Children 6-23 months receiving micronutrient powder (MNP)","NUMBER","30000","children","2.3","MNP distribution registers"),
I("OP2.3-2","PLW receiving iron-folic acid (IFA)","NUMBER","20000","women","2.3","IFA distribution registers",sex=False),
I("OP2.3-3","PLW receiving multiple micronutrients (MMN)","NUMBER","8000","women","2.3","MMN distribution registers",sex=False),
I("OP3.1-1","RUTF cartons received at district stores","NUMBER","4500","cartons","3.1","Stock receipts",sex=False),
I("OP3.1-2","RUTF cartons consumed","NUMBER","3900","cartons","3.1","Stock registers",sex=False),
I("OP3.1-3","RUSF cartons received at district stores","NUMBER","6500","cartons","3.1","Stock receipts",sex=False),
I("OP3.1-4","RUSF cartons consumed","NUMBER","5800","cartons","3.1","Stock registers",sex=False),
I("OP3.1-5","MNP sachet boxes received","NUMBER","900","boxes","3.1","Stock receipts",sex=False),
I("OP3.1-6","MNP sachet boxes consumed","NUMBER","800","boxes","3.1","Stock registers",sex=False),
I("OP3.2-1","District monthly nutrition reports submitted on time","NUMBER","12","reports","3.2","Report log",sex=False),
I("OP3.2-2","Health staff trained in CMAM and IYCF","NUMBER","240","staff","3.2","Training attendance sheets",sex=False),
I("OP3.2-3","Supportive supervision visits to nutrition sites","NUMBER","180","visits","3.2","Supervision reports",sex=False),
]
D = "pak-cmam-demo.example"
TEAM = [
("Dr. Ayesha Khan",f"ayesha.khan@{D}","Project manager"),
("Imran Yousafzai",f"imran.yousafzai@{D}","Monitoring and evaluation officer"),
("Sadia Bibi",f"sadia.bibi@{D}","Grants officer"),
("Tariq Mehmood",f"tariq.mehmood@{D}","Compliance officer"),
("Gul Rehman",f"gul.rehman@{D}","Field officer"),
("Nasreen Akhtar",f"nasreen.akhtar@{D}","Field officer"),
("Zahid Ali",f"zahid.ali@{D}","Field officer"),
("Farah Naz",f"farah.naz@{D}","Field officer"),
("Dr. Mariam Shah",f"mariam.shah@{D}","Viewer"),
]
L = {"UD":f"gul.rehman@{D}","UD2":f"nasreen.akhtar@{D}","MD":f"zahid.ali@{D}","MD2":f"farah.naz@{D}","PM":f"ayesha.khan@{D}","ME":f"imran.yousafzai@{D}"}
S,E="2026-11-02","2026-11-27"
PLAN = [
("A1.1.1","Community MUAC screening and referral - Upper Dir",S,E,L["UD"],"Upper Dir","Monthly"),
("A1.1.1","Community MUAC screening and referral - Mardan",S,E,L["MD"],"Mardan","Monthly"),
("A1.1.2","Referral of SAM and MAM cases - Upper Dir",S,E,L["UD2"],"Upper Dir","Monthly"),
("A1.1.2","Referral of SAM and MAM cases - Mardan",S,E,L["MD2"],"Mardan","Monthly"),
("A1.2.1","OTP treatment of SAM with RUTF - Upper Dir",S,E,L["UD"],"Upper Dir","Monthly"),
("A1.2.1","OTP treatment of SAM with RUTF - Mardan",S,E,L["MD"],"Mardan","Monthly"),
("A1.3.1","SFP treatment of MAM - Upper Dir",S,E,L["UD2"],"Upper Dir","Monthly"),
("A1.3.1","SFP treatment of MAM - Mardan",S,E,L["MD2"],"Mardan","Monthly"),
("A1.4.1","Stabilisation centre treatment - DHQ Hospital Dir",S,E,L["UD"],"Upper Dir","Monthly"),
("A1.4.1","Stabilisation centre treatment - Mardan Medical Complex",S,E,L["MD"],"Mardan","Monthly"),
("A2.1.1","PLW MUAC screening and SFP enrolment - Upper Dir",S,E,L["UD2"],"Upper Dir","Monthly"),
("A2.1.1","PLW MUAC screening and SFP enrolment - Mardan",S,E,L["MD2"],"Mardan","Monthly"),
("A2.2.1","IYCF counselling at health facilities - Upper Dir",S,E,L["UD2"],"Upper Dir","Monthly"),
("A2.2.1","IYCF counselling at health facilities - Mardan",S,E,L["MD2"],"Mardan","Monthly"),
("A2.2.2","IYCF counselling in communities - Upper Dir",S,E,L["UD"],"Upper Dir","Monthly"),
("A2.2.2","IYCF counselling in communities - Mardan",S,E,L["MD"],"Mardan","Monthly"),
("A2.3.1","MNP, IFA and MMN distribution - Upper Dir",S,E,L["UD2"],"Upper Dir","Monthly"),
("A2.3.1","MNP, IFA and MMN distribution - Mardan",S,E,L["MD2"],"Mardan","Monthly"),
("A3.1.1","Nutrition supply receipt, storage and stock check - Upper Dir","2026-11-02","2026-11-13",L["UD"],"Upper Dir","Monthly"),
("A3.1.1","Nutrition supply receipt, storage and stock check - Mardan","2026-11-02","2026-11-13",L["MD"],"Mardan","Monthly"),
("A3.2.1","Monthly district data review and report","2026-11-23","2026-11-27",L["ME"],"K.P.","Monthly"),
("A3.2.1","Supportive supervision visits to OTP, SFP and SC sites","2026-11-16","2026-11-20",L["ME"],"K.P.","Monthly"),
("A3.2.1","Training of health staff in CMAM and IYCF - Upper Dir","2026-11-09","2026-11-20",L["PM"],"Upper Dir",""),
("A3.2.1","Training of health staff in CMAM and IYCF - Mardan","2026-11-23","2026-12-04",L["PM"],"Mardan",""),
("A3.2.1","Refresher training on MUAC and IYCF","2027-02-01","2027-02-12",L["PM"],"K.P.",""),
]
BUDGET = [("RUTF, RUSF, F-75, F-100 and ReSoMal (supplies)",190000),("MNP, IFA, MMN and MUAC tapes",60000),("Community screening and referral (LHW and volunteer support)",85000),
("OTP, SFP and SC site support and incentives",110000),("IYCF counselling and mother support",60000),("Training and supportive supervision",50000),("Monitoring, data and reporting",35000),("Staff, vehicles and administration",70000)]
TOTAL=sum(b for _,b in BUDGET); assert TOTAL==660000
PLACES = {"Upper Dir":(["Dir","Wari","Sheringal"],[("DHQ Hospital Dir","Dir","Stabilisation centre",35.2075,71.8760),("RHC Wari","Wari","OTP site",34.9667,71.8000),("BHU Sheringal","Sheringal","SFP site",35.3000,71.7500)]),
          "Mardan":(["Mardan City","Takht Bhai","Katlang"],[("Mardan Medical Complex","Mardan City","Stabilisation centre",34.1980,72.0420),("RHC Takht Bhai","Takht Bhai","OTP site",34.2900,71.9500),("BHU Katlang","Katlang","SFP site",34.3300,72.0700)])}
with open(f"{out}/places.csv","w",newline="") as f:
    w=csv.writer(f); w.writerow(["Name","Level","Parent","Code","Latitude","Longitude","Other spellings","Facility type"])
    w.writerow(["Pakistan","Country","","","","","",""]); w.writerow(["K.P.","State or province","Pakistan","","","","Khyber Pakhtunkhwa; KP; KPK",""])
    for dist,(teh,fac) in PLACES.items():
        w.writerow([dist,"District or locality","K.P.","","","","Dir Upper" if dist=="Upper Dir" else "",""])
        for t in teh: w.writerow([t,"Sub-district",dist,"","","","",""])
        for n,p,ty,la,lo in fac: w.writerow([n,"Community or site",p,"",la,lo,"",ty])
for n,rows,h in [("logframe",LF,["Level","Code","Title"]),("indicators",IND,["Code","Indicator","Type","Baseline","Target","Unit","Frequency","Disaggregation","Logframe Code","Means of Verification","Better when"]),("workplan",PLAN,["Logframe Code","Title","Start","End","Lead email","Location","Repeats"])]:
    with open(f"{out}/{n}.csv","w",newline="") as f: w=csv.writer(f); w.writerow(h); w.writerows(rows)

# Work plan rows for Dec-Apr: the wizard reads the first month only, so the monthly series is imported afterwards (no lead emails: leads join later).
SHIFT={"2026-11-02":"2026-12-01","2026-11-27":"2026-12-24","2026-11-13":"2026-12-11","2026-11-23":"2026-12-21","2026-11-16":"2026-12-14","2026-11-20":"2026-12-18"}
with open(f"{out}/workplan-dec.csv","w",newline="") as f:
    w=csv.writer(f); w.writerow(["Logframe Code","Title","Start","End","Lead email","Location","Repeats"])
    for r in PLAN:
        if r[6]=="Monthly": w.writerow([r[0],r[1],SHIFT[r[2]],SHIFT[r[3]],"",r[5],"Monthly"])
d=Document()
d.add_heading("Community-based Management of Acute Malnutrition (CMAM) and Infant and Young Child Feeding (IYCF) in Upper Dir and Mardan, Khyber Pakhtunkhwa (PAK-KP-CMAM)",0)
d.add_paragraph("Project proposal to UNICEF Pakistan. Implementing partner: Khyber Nutrition Response Alliance (KNRA), in agreement with the Nutrition Directorate, Department of Health, Khyber Pakhtunkhwa. All organisations, people, sites and figures in this document are fictional.")
d.add_heading("1. Project summary",1)
d.add_paragraph("Project code: PAK-KP-CMAM-2026. Donor: UNICEF. Sector: Nutrition. Country: Pakistan. Province: Khyber Pakhtunkhwa. Districts: Upper Dir and Mardan. Duration: 1 November 2026 to 30 April 2027 (six months). Budget: USD %s, expressed in US dollars." % format(TOTAL,","))
d.add_paragraph("KNRA supports the Nutrition Directorate to deliver CMAM and IYCF through community outreach, outpatient therapeutic programme (OTP) sites for children with severe acute malnutrition (SAM) without complications, supplementary feeding programme (SFP) sites for moderate acute malnutrition (MAM), and stabilisation centres (SC) for SAM with complications. Pregnant and lactating women (PLW) are screened and supplemented, and caregivers receive IYCF counselling and micronutrient supplements. Data are collected monthly from every site and reported by place and by sex of child.")
d.add_heading("2. Context and needs",1)
d.add_paragraph("Khyber Pakhtunkhwa has high rates of child wasting and stunting, made worse by food insecurity, flooding and displacement. Upper Dir is a mountainous district where winter snow cuts off valleys and long distances limit access to health facilities. Mardan is a densely populated district with large host communities and several high-volume treatment sites. Targets in this scenario are illustrative.")
d.add_heading("3. Results framework",1)
t=d.add_table(rows=1,cols=3); t.style="Table Grid"
for i,h in enumerate(["Level","Code","Result"]): t.rows[0].cells[i].text=h
for r in LF:
    c=t.add_row().cells
    for i,v in enumerate(r): c[i].text=v
d.add_heading("4. Indicators",1)
d.add_paragraph("Treatment performance follows the Sphere minimum standards: cure rate above 75%, death rate below 10% and default rate below 15%. Rates are calculated from admissions and exits and are never added across districts. Counts of children are reported separately for boys and girls.")
t=d.add_table(rows=1,cols=9); t.style="Table Grid"
for i,h in enumerate(["Code","Indicator","Baseline","Target","Unit","Frequency","Break down by","Better when","Result"]): t.rows[0].cells[i].text=h
for r in IND:
    c=t.add_row().cells
    for i,v in enumerate([r[0],r[1],r[3] or "Not stated",r[4],r[5],r[6],r[7] or "None",r[10],r[8]]): c[i].text=v
d.add_heading("5. Risks and assumptions",1)
for x in ["Risk (high): winter snow and landslides cut roads in Upper Dir, delaying RUTF delivery and caregiver attendance. Mitigation: pre-position three months of stock at tehsil stores.",
"Risk (medium): flooding or displacement in Mardan increases admissions beyond site capacity. Mitigation: surge staff and buffer stock.",
"Risk (medium): turnover of lady health workers reduces screening coverage. Mitigation: refresher training and supervision.",
"Risk (low): RUTF sharing in households slows recovery. Mitigation: counselling on correct use.",
"Assumption: the Nutrition Directorate keeps OTP, SFP and SC sites open and staffed.",
"Assumption: the UNICEF supply pipeline delivers RUTF, RUSF and MNP on schedule."]: d.add_paragraph(x)
d.add_heading("6. Reporting",1)
d.add_paragraph("KNRA reports monthly to UNICEF, with a mid-project report after three months and a final report after the end date.")
d.save(f"{out}/PAK-KP-Proposal.docx")
wb=Workbook(); ws=wb.active; ws.title="Summary Budget"; ws.append(["Budget category","Total (USD)"]); ws.append(["The budget is expressed in US dollars (USD)."])
for n,a in BUDGET: ws.append([n,a])
ws.append(["Total",TOTAL]); wb.save(f"{out}/PAK-KP-Budget.xlsx")
for name,rows,h in [("Logframe",LF,["Level","Code","Title"]),("WorkPlan",[r[:6] for r in PLAN],["Logframe Code","Title","Start","End","Lead email","Location"])]:
    wb=Workbook(); ws=wb.active; ws.title=name; ws.append(h)
    for r in rows: ws.append(list(r))
    wb.save(f"{out}/PAK-KP-{name}.xlsx")
wb=Workbook(); ws=wb.active; ws.title="Indicators"; ws.append(["Indicator","Code","Baseline","Target","Unit","Frequency","Break down by","Means of verification","Better when","Result"])
for r in IND: ws.append([r[1],r[0],r[3],r[4],r[5],r[6],r[7],r[9],r[10],r[8]])
wb.save(f"{out}/PAK-KP-Indicators.xlsx")
json.dump({"team":TEAM,"budget":BUDGET,"total":TOTAL},open(f"{out}/meta.json","w"),indent=1); print("ok",len(IND),"indicators",len(PLAN),"plan rows")
