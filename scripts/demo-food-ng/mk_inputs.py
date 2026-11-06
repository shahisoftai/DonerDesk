"""Demo 13 inputs (Nigeria food security, 6 months). All names/figures fictional. Usage: python3 mk_inputs.py <outdir>"""
import sys, csv, os
from docx import Document
from openpyxl import Workbook
out = sys.argv[1]; os.makedirs(out, exist_ok=True)

LF = [  # level, code, title
("GOAL","G","Food insecurity and vulnerability are reduced among conflict-affected households in Borno, Adamawa and Yobe States, north-east Nigeria"),
("OUTCOME","OC1","Targeted households meet their immediate food needs and improve their food consumption"),
("OUTPUT","1.1","Vulnerable households receive timely multi-purpose cash and food assistance"),
("ACTIVITY","A1.1.1","Community-based targeting, registration and verification of vulnerable households"),
("ACTIVITY","A1.1.2","Monthly cash and food distributions to registered households"),
("ACTIVITY","A1.1.3","Post-distribution monitoring and complaints handling"),
("OUTPUT","1.2","Children under five and pregnant and breastfeeding women are screened for malnutrition and referred, and caregivers learn nutrition-sensitive feeding practices"),
("ACTIVITY","A1.2.1","Community MUAC screening and referral of malnourished children"),
("ACTIVITY","A1.2.2","Nutrition education and cooking demonstration sessions for caregivers"),
("OUTCOME","OC2","Farming and small-business households restore their livelihoods and income"),
("OUTPUT","2.1","Farming households receive seeds, tools and climate-smart farming training"),
("ACTIVITY","A2.1.1","Procure and distribute dry-season seed and tool kits"),
("ACTIVITY","A2.1.2","Farmer field schools on climate-smart and low-input agriculture"),
("OUTPUT","2.2","Households save, borrow and start small businesses through village savings and loan associations and grants"),
("ACTIVITY","A2.2.1","Form and train village savings and loan associations (VSLAs)"),
("ACTIVITY","A2.2.2","Business skills training and livelihood start-up grants"),
("OUTCOME","OC3","Communities rebuild shared assets and strengthen local markets"),
("OUTPUT","3.1","Community assets are rehabilitated through cash-for-work"),
("ACTIVITY","A3.1.1","Cash-for-work rehabilitation of farm roads, irrigation channels and market sheds"),
("OUTPUT","3.2","Farmers, traders and local authorities are linked through market forums"),
("ACTIVITY","A3.2.1","Quarterly market linkage forums and price monitoring"),
]
# code,name,type,baseline,target,unit,frequency,disagg,result,source
IND = [
("GI-1","Households reporting acceptable food consumption (Food Consumption Score)","PERCENTAGE","38","65","%","Quarterly","","G","Household survey (FCS)"),
("OC1a","Households with acceptable Food Consumption Score","PERCENTAGE","38","60","%","Quarterly","","OC1","Household survey (FCS)"),
("OC1b","Households with a reduced Coping Strategies Index","PERCENTAGE","0","50","%","Quarterly","","OC1","Household survey (rCSI)"),
("OP1-1a","Households registered and verified","NUMBER","0","6000","households","Monthly","Location","1.1","Registration database"),
("OP1-1b","Households receiving at least one transfer","NUMBER","0","6000","households","Monthly","Location, Sex of head of household","1.1","Distribution lists"),
("OP1-1c","Value of cash transferred","CURRENCY","0","420000","USD","Monthly","Location","1.1","Payment reports"),
("OP1-1d","Beneficiaries satisfied with assistance","PERCENTAGE","0","85","%","Monthly","","1.1","Post-distribution monitoring"),
("OP1-2a","Children 6-59 months screened for malnutrition","NUMBER","0","9000","children","Monthly","Location, Sex","1.2","MUAC screening registers"),
("OP1-2b","Malnourished children referred to treatment","NUMBER","0","700","children","Monthly","Location","1.2","Referral slips"),
("OP1-2c","Caregivers attending nutrition education sessions","NUMBER","0","4800","people","Monthly","Location, Sex","1.2","Session attendance sheets"),
("OC2a","Households reporting increased income","PERCENTAGE","0","55","%","Final","","OC2","Endline survey"),
("OP2-1a","Farmers receiving seed and tool kits","NUMBER","0","3000","farmers","Monthly","Location, Sex","2.1","Distribution lists"),
("OP2-1b","Farmers trained in climate-smart agriculture","NUMBER","0","2400","farmers","Monthly","Location, Sex","2.1","Farmer field school registers"),
("OP2-2a","VSLA groups formed and trained","NUMBER","0","120","groups","Monthly","Location","2.2","VSLA records"),
("OP2-2b","Households receiving livelihood start-up grants","NUMBER","0","900","households","Monthly","Location","2.2","Grant payment lists"),
("OP3-1a","Person-days of cash-for-work created","NUMBER","0","36000","person-days","Monthly","Location","3.1","Cash-for-work attendance sheets"),
("OP3-1b","Community assets rehabilitated","NUMBER","0","24","assets","Monthly","Location","3.1","Completion certificates"),
("OP3-2a","Market linkage forums held","NUMBER","0","6","forums","Quarterly","","3.2","Forum minutes"),
]
LOC = ["Maiduguri","Bama","Monguno","Mubi","Potiskum"]
PLAN = [  # code,title,start,end,location,repeats
("A1.1.1","Community-based targeting and registration of households","2026-11-02","2026-11-27","Maiduguri",""),
("A1.1.1","Household verification and registration - Bama and Monguno","2026-11-02","2026-11-27","Bama",""),
("A1.1.1","Household verification and registration - Mubi and Potiskum","2026-11-09","2026-12-11","Mubi",""),
("A1.1.2","Monthly cash and food distribution - Maiduguri","2026-11-16","2026-11-20","Maiduguri","monthly"),
("A1.1.2","Monthly cash and food distribution - Bama","2026-11-17","2026-11-21","Bama","monthly"),
("A1.1.2","Monthly cash and food distribution - Monguno","2026-11-18","2026-11-22","Monguno","monthly"),
("A1.1.3","Post-distribution monitoring round","2026-11-23","2026-11-27","Maiduguri","monthly"),
("A1.2.1","Community MUAC screening - Monguno and Bama","2026-11-03","2026-11-27","Monguno","monthly"),
("A1.2.1","Community MUAC screening - Mubi and Potiskum","2026-11-10","2026-11-27","Mubi","monthly"),
("A1.2.2","Nutrition education and cooking demonstrations","2026-11-09","2026-11-27","Potiskum","monthly"),
("A2.1.1","Distribute dry-season seed and tool kits","2026-11-16","2026-12-18","Mubi",""),
("A2.1.2","Farmer field school sessions","2026-11-09","2027-03-26","Mubi","monthly"),
("A2.2.1","Form and train VSLA groups","2026-11-09","2027-01-29","Potiskum",""),
("A2.2.2","Business skills training and start-up grants","2026-12-07","2027-03-12","Maiduguri",""),
("A3.1.1","Cash-for-work: rehabilitate farm roads and irrigation channels","2026-11-16","2027-03-31","Bama",""),
("A3.2.1","Market linkage forum","2026-12-14","2026-12-18","Maiduguri",""),
("A3.2.1","Market linkage forum (second)","2027-03-08","2027-03-12","Maiduguri",""),
]
BUDGET = [("Food and cash assistance",410000),("Nutrition screening and education",62000),("Seeds, tools and farmer training",118000),
("VSLA and livelihood grants",96000),("Cash-for-work",84000),("Monitoring, evaluation and learning",48000),("Staff and administration",82000)]
assert sum(b for _,b in BUDGET)==900000

with open(f"{out}/logframe.csv","w",newline="") as f:
    w=csv.writer(f); w.writerow(["Level","Code","Title"]); w.writerows(LF)
with open(f"{out}/indicators.csv","w",newline="") as f:
    w=csv.writer(f); w.writerow(["Code","Name","Type","Baseline","Target","Unit","Frequency","Disaggregated","Logframe Code","Data source"]); w.writerows(IND)
with open(f"{out}/workplan.csv","w",newline="") as f:
    w=csv.writer(f); w.writerow(["Logframe Code","Title","Start","End","Location","Repeats"]); w.writerows(PLAN)

d=Document()
d.add_heading("Strengthening Food Security and Livelihoods for Conflict-Affected Households in North-East Nigeria (FSL-NE)",0)
d.add_paragraph("Project proposal - Nigeria Humanitarian Fund (NHF) reserve allocation. Implementing organisation: Borno Relief and Resilience Initiative (BRRI). All organisations, people and figures in this document are fictional.")
d.add_heading("1. Project summary",1)
for t in ["Project code: NG-FSL-20261101. Agreement number (fictional): NHF/RA/2026/0318. Donor: Nigeria Humanitarian Fund. Sector: Food security. Country: Nigeria. Duration: 1 November 2026 to 30 April 2027 (six months). Budget: USD 900,000, expressed in US dollars.",
"BRRI and local partners provide cash and food assistance, nutrition screening, seeds and tools, savings groups and cash-for-work to 6,000 conflict-affected households in five local government areas: Maiduguri, Bama and Monguno (Borno State), Mubi (Adamawa State) and Potiskum (Yobe State)."]: d.add_paragraph(t)
d.add_heading("2. Context and needs",1)
d.add_paragraph("Fifteen years of conflict in the north-east have displaced millions of people and destroyed farms, markets and roads. Many households in the target areas cannot meet basic food needs during the lean season, and acute malnutrition among children under five remains above emergency thresholds. The figures in this scenario are illustrative.")
d.add_heading("3. Results framework",1)
t=d.add_table(rows=1,cols=3); t.style="Table Grid"
for i,h in enumerate(["Level","Code","Result"]): t.rows[0].cells[i].text=h
for r in LF:
    c=t.add_row().cells
    for i,v in enumerate(r): c[i].text=v
d.add_heading("4. Indicators",1)
t=d.add_table(rows=1,cols=8); t.style="Table Grid"
for i,h in enumerate(["Code","Indicator","Baseline","Target","Unit","Frequency","Means of verification","Result"]): t.rows[0].cells[i].text=h
for r in IND:
    c=t.add_row().cells
    for i,v in enumerate([r[0],r[1],r[3],r[4],r[5],r[6],r[9],r[8]]): c[i].text=v
d.add_heading("5. Risks and assumptions",1)
for t_ in ["Risk (high): insecurity and access restrictions on roads to Bama and Monguno may delay distributions. Mitigation: pre-agreed access routes and flexible distribution days.",
"Risk (medium): price inflation reduces the purchasing power of cash transfers. Mitigation: monthly market price monitoring and transfer value review.",
"Risk (medium): flooding or early-season rains damage farm roads. Mitigation: cash-for-work prioritises drainage and irrigation channels.",
"Assumption: local authorities continue to allow humanitarian access and community targeting.",
"Assumption: functioning mobile-money agents remain available in all five local government areas."]: d.add_paragraph(t_)
d.add_heading("6. Reporting",1)
d.add_paragraph("BRRI reports monthly to the donor, with a mid-project report after three months and a final report after the end date.")
d.save(f"{out}/NG-FSL-Proposal.docx")

wb=Workbook(); ws=wb.active; ws.title="Summary Budget"
ws.append(["Budget category","Total (USD)"])
ws.append(["The budget is expressed in US dollars (USD)."])
for n,a in BUDGET: ws.append([n,a])
ws.append(["Total",900000])
wb.save(f"{out}/NG-FSL-Budget.xlsx")
wb=Workbook(); ws=wb.active; ws.title="Work plan"
ws.append(["Logframe Code","Title","Start","End","Location"])
for r in PLAN: ws.append(list(r[:5]))
wb.save(f"{out}/NG-FSL-WorkPlan.xlsx")
print("ok")
wb=Workbook(); ws=wb.active; ws.title="Logframe"
ws.append(["Level","Code","Title"])
for r in LF: ws.append(list(r))
wb.save(f"{out}/NG-FSL-Logframe.xlsx")
wb=Workbook(); ws=wb.active; ws.title="Indicators"
ws.append(["Indicator","Code","Baseline","Target","Unit","Frequency","Means of verification","Result"])
for r in IND: ws.append([r[1],r[0],r[3],r[4],r[5],r[6],r[9],r[8]])
wb.save(f"{out}/NG-FSL-Indicators.xlsx")
