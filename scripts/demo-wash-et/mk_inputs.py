"""Demo 15 inputs (Ethiopia WASH, USAID, Jan-Jul 2026). All names/figures fictional. Usage: python3 mk_inputs.py <outdir>"""
import sys, csv, os
from docx import Document
from openpyxl import Workbook
out = sys.argv[1]; os.makedirs(out, exist_ok=True)
LF = [
("GOAL","G","Morbidity and mortality from water-related disease are reduced among drought-affected communities in Somali Region, Ethiopia"),
("OUTCOME","OC1","Households have safe and sufficient drinking water"),
("OUTPUT","1.1","Water points are rehabilitated and new solar-powered water systems are installed"),
("ACTIVITY","A1.1.1","Rehabilitate boreholes, shallow wells and hand pumps"),
("ACTIVITY","A1.1.2","Install solar-powered pumping and piped water systems"),
("OUTPUT","1.2","Water quality is monitored and water committees manage water points"),
("ACTIVITY","A1.2.1","Water chlorination and routine water quality testing"),
("ACTIVITY","A1.2.2","Train and support water point management committees and mechanics"),
("OUTCOME","OC2","Communities use safe, dignified sanitation facilities and stop open defecation"),
("OUTPUT","2.1","Latrines are constructed and communities are triggered for total sanitation"),
("ACTIVITY","A2.1.1","Construct household, communal and institutional latrines"),
("ACTIVITY","A2.1.2","Community-led total sanitation (CLTS) triggering and follow-up"),
("OUTPUT","2.2","Schools and health facilities have improved WASH facilities"),
("ACTIVITY","A2.2.1","Rehabilitate WASH facilities in schools and health centres"),
("OUTCOME","OC3","Households adopt key hygiene practices and are prepared for cholera and acute watery diarrhoea outbreaks"),
("OUTPUT","3.1","People are reached with hygiene promotion and hygiene supplies"),
("ACTIVITY","A3.1.1","Hygiene promotion through community hygiene promoters and handwashing stations"),
("ACTIVITY","A3.1.2","Distribute hygiene and menstrual hygiene kits"),
("OUTPUT","3.2","Communities and rapid response teams are prepared for cholera and acute watery diarrhoea"),
("ACTIVITY","A3.2.1","Cholera prevention messaging and pre-positioned WASH rapid response kits"),
]
# code,name,type,baseline,target,unit,frequency,disagg,result,source
IND = [
("GI-1","Prevalence of diarrhoea in children under five in the previous two weeks","PERCENTAGE","28","18","%","Quarterly","","G","Household survey"),
("OC1a","Households with at least 15 litres of water per person per day","PERCENTAGE","42","75","%","Quarterly","","OC1","Household survey"),
("OC1b","Households with safe drinking water at the point of consumption","PERCENTAGE","38","70","%","Quarterly","","OC1","Household survey and water tests"),
("OP1-1a","Water points rehabilitated and functioning","NUMBER","0","40","water points","Monthly","","1.1","Completion certificates"),
("OP1-1b","People with access to improved water through the project","NUMBER","0","60000","people","Monthly","","1.1","Water point registers"),
("OP1-1c","Solar-powered water systems installed","NUMBER","0","8","systems","Monthly","","1.1","Commissioning reports"),
("OP1-2a","Water quality tests conducted","NUMBER","0","600","tests","Monthly","","1.2","Water quality test logs"),
("OP1-2b","Water quality tests with free residual chlorine of at least 0.2 mg/L","PERCENTAGE","55","90","%","Monthly","","1.2","Water quality test logs"),
("OP1-2c","Water point management committees trained","NUMBER","0","40","committees","Monthly","","1.2","Training attendance sheets"),
("OC2a","Households using a functioning latrine shared by no more than 20 people","PERCENTAGE","20","50","%","Quarterly","","OC2","Household survey"),
("OC2b","Villages verified as free from open defecation","NUMBER","0","25","villages","Monthly","","OC2","ODF verification reports"),
("OP2-1a","Latrine stances constructed","NUMBER","0","900","stances","Monthly","","2.1","Completion certificates"),
("OP2-1b","Villages triggered through CLTS","NUMBER","0","60","villages","Monthly","","2.1","CLTS triggering reports"),
("OP2-1c","People with access to new latrines","NUMBER","0","30000","people","Monthly","","2.1","Latrine registers"),
("OP2-2a","Schools and health facilities with improved WASH facilities","NUMBER","0","25","facilities","Monthly","","2.2","Handover certificates"),
("OC3a","Households with a handwashing station with soap and water near the latrine","PERCENTAGE","25","60","%","Quarterly","","OC3","Household survey"),
("OP3-1a","People reached with hygiene promotion","NUMBER","0","90000","people","Monthly","","3.1","Hygiene session attendance sheets"),
("OP3-1b","Community hygiene promoters trained","NUMBER","0","240","promoters","Monthly","","3.1","Training attendance sheets"),
("OP3-1c","Handwashing stations installed","NUMBER","0","800","stations","Monthly","","3.1","Installation records"),
("OP3-1d","Households receiving hygiene kits","NUMBER","0","5000","households","Monthly","","3.1","Distribution lists"),
("OP3-1e","Women and girls receiving menstrual hygiene kits","NUMBER","0","3000","women and girls","Monthly","","3.1","Distribution lists"),
("OP3-2a","People reached with cholera and diarrhoea prevention messages","NUMBER","0","40000","people","Monthly","","3.2","Session attendance sheets"),
("OP3-2b","WASH rapid response kits pre-positioned","NUMBER","0","10","kits","Monthly","","3.2","Stock records"),
]
PLAN = [
("A1.1.1","Rehabilitate boreholes and hand pumps - Gode and Mustahil","2026-01-12","2026-05-29","Gode",""),
("A1.1.1","Rehabilitate boreholes and shallow wells - Kebri Dahar and Warder","2026-01-19","2026-06-12","Kebri Dahar",""),
("A1.1.2","Install solar-powered piped water systems - Dolo Ado","2026-02-02","2026-06-26","Dolo Ado",""),
("A1.2.1","Monthly water quality testing and chlorination - Gode and Mustahil","2026-01-26","2026-01-30","Gode","monthly"),
("A1.2.1","Monthly water quality testing and chlorination - Kebri Dahar, Warder and Dolo Ado","2026-01-27","2026-01-31","Kebri Dahar","monthly"),
("A1.2.2","Train water point management committees and mechanics","2026-01-19","2026-05-15","Mustahil",""),
("A2.1.1","Construct household and communal latrines - Gode and Dolo Ado","2026-01-26","2026-06-19","Dolo Ado",""),
("A2.1.1","Construct latrines - Kebri Dahar, Warder and Mustahil","2026-02-02","2026-06-26","Warder",""),
("A2.1.2","CLTS triggering and follow-up","2026-01-12","2026-06-30","Gode","monthly"),
("A2.2.1","Rehabilitate WASH facilities in schools and health centres","2026-02-16","2026-06-12","Kebri Dahar",""),
("A3.1.1","Hygiene promotion and handwashing stations - Gode and Mustahil","2026-01-12","2026-01-30","Mustahil","monthly"),
("A3.1.1","Hygiene promotion and handwashing stations - Kebri Dahar, Warder and Dolo Ado","2026-01-19","2026-01-30","Warder","monthly"),
("A3.1.2","Distribute hygiene and menstrual hygiene kits","2026-02-02","2026-06-26","Dolo Ado",""),
("A3.2.1","Cholera prevention messaging and rapid response kits","2026-01-12","2026-07-24","Kebri Dahar",""),
]
BUDGET = [("Water point rehabilitation and solar systems",420000),("Water quality, chlorination and committees",95000),("Latrine construction and CLTS",260000),
("Schools and health facility WASH",110000),("Hygiene promotion and supplies",150000),("Monitoring, evaluation and learning",55000),("Staff and administration",110000)]
assert sum(b for _,b in BUDGET)==1200000
for n,rows,h in [("logframe",LF,["Level","Code","Title"]),("indicators",IND,["Code","Name","Type","Baseline","Target","Unit","Frequency","Disaggregated","Logframe Code","Data source"]),("workplan",PLAN,["Logframe Code","Title","Start","End","Location","Repeats"])]:
    with open(f"{out}/{n}.csv","w",newline="") as f: w=csv.writer(f); w.writerow(h); w.writerows(rows)
d=Document()
d.add_heading("Safe Water, Sanitation and Hygiene for Drought-Affected Communities in Somali Region, Ethiopia (SWASH-ET)",0)
d.add_paragraph("Project proposal to USAID Bureau for Humanitarian Assistance (BHA). Implementing organisation: Horn Water and Sanitation Alliance (HWSA). All organisations, people and figures in this document are fictional.")
d.add_heading("1. Project summary",1)
for t in ["Project code: ET-WASH-20260101. Agreement number (fictional): 720BHA26GR00041. Donor: USAID. Sector: Water, sanitation and hygiene. Country: Ethiopia. Duration: 1 January 2026 to 31 July 2026 (seven months). Budget: USD 1,200,000, expressed in US dollars.",
"HWSA rehabilitates water points, installs solar-powered water systems, constructs latrines, triggers community-led total sanitation and promotes hygiene in five woredas of Somali Region: Gode, Mustahil, Kebri Dahar, Warder and Dolo Ado. Targets follow the Sphere standards (at least 15 litres per person per day, a water point within 500 metres, one toilet for at most 20 people)."]: d.add_paragraph(t)
d.add_heading("2. Context and needs",1)
d.add_paragraph("Successive failed rainy seasons have dried up shallow wells and boreholes in Somali Region, forcing households to walk long distances for unsafe water and increasing the risk of acute watery diarrhoea and cholera. Open defecation remains common and few households have a handwashing station. The figures in this scenario are illustrative.")
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
for t_ in ["Risk (high): insecurity and inter-communal conflict restrict access to some kebeles. Mitigation: community acceptance, flexible scheduling and remote monitoring.",
"Risk (high): a cholera or acute watery diarrhoea outbreak overloads water and sanitation services. Mitigation: pre-positioned WASH rapid response kits and chlorination.",
"Risk (medium): flash floods damage latrines and water points. Mitigation: raised latrine platforms and flood-resistant designs.",
"Risk (medium): fuel and spare-part shortages delay pumping and borehole work. Mitigation: solar systems and pre-purchased spare parts.",
"Assumption: woreda water offices continue to support committees and maintenance.",
"Assumption: communities contribute labour and local materials for latrine construction."]: d.add_paragraph(t_)
d.add_heading("6. Reporting",1)
d.add_paragraph("HWSA reports to USAID at the end of the project; this scenario produces the final report only.")
d.save(f"{out}/ET-Proposal.docx")
wb=Workbook(); ws=wb.active; ws.title="Summary Budget"
ws.append(["Budget category","Total (USD)"]); ws.append(["The budget is expressed in US dollars (USD)."])
for n,a in BUDGET: ws.append([n,a])
ws.append(["Total",1200000]); wb.save(f"{out}/ET-Budget.xlsx")
wb=Workbook(); ws=wb.active; ws.title="Work plan"; ws.append(["Logframe Code","Title","Start","End","Location"])
for r in PLAN: ws.append(list(r[:5]))
wb.save(f"{out}/ET-WorkPlan.xlsx")
wb=Workbook(); ws=wb.active; ws.title="Logframe"; ws.append(["Level","Code","Title"])
for r in LF: ws.append(list(r))
wb.save(f"{out}/ET-Logframe.xlsx")
wb=Workbook(); ws=wb.active; ws.title="Indicators"; ws.append(["Indicator","Code","Baseline","Target","Unit","Frequency","Means of verification","Result"])
for r in IND: ws.append([r[1],r[0],r[3],r[4],r[5],r[6],r[9],r[8]])
wb.save(f"{out}/ET-Indicators.xlsx"); print("ok", len(IND), len(PLAN))
