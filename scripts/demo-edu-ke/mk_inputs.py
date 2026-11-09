"""Demo 16 inputs (Kenya Education, EU, Mar-Aug 2026). All names/figures fictional. Usage: python3 mk_inputs.py <outdir>"""
import sys, csv, os
from docx import Document
from openpyxl import Workbook
out = sys.argv[1]; os.makedirs(out, exist_ok=True)
LF = [
("GOAL","G","Children and adolescents in marginalised arid and semi-arid counties of Kenya complete quality, inclusive basic education"),
("OUTCOME","OC1","Out-of-school children enrol in, attend and stay in school or accelerated learning"),
("OUTPUT","1.1","Out-of-school children are identified and enrolled in schools and accelerated education centres"),
("ACTIVITY","A1.1.1","Community enrolment drives and back-to-school campaigns"),
("ACTIVITY","A1.1.2","Establish and run accelerated education programme (AEP) centres"),
("OUTPUT","1.2","Schools provide safe, inclusive learning environments"),
("ACTIVITY","A1.2.1","Construct and rehabilitate classrooms and WASH facilities in schools"),
("ACTIVITY","A1.2.2","Distribute scholastic kits and learning materials"),
("OUTCOME","OC2","Learners acquire foundational literacy and numeracy skills"),
("OUTPUT","2.1","Teachers are trained and coached in competency-based, inclusive teaching"),
("ACTIVITY","A2.1.1","Train teachers in the competency-based curriculum and inclusive pedagogy"),
("ACTIVITY","A2.1.2","Coaching and classroom support visits to teachers"),
("OUTPUT","2.2","Learners receive remedial reading and numeracy support"),
("ACTIVITY","A2.2.1","Set up and run remedial reading and numeracy clubs"),
("ACTIVITY","A2.2.2","Deliver radio and digital learning lessons"),
("OUTCOME","OC3","Schools and communities protect children and support girls and learners with disabilities to learn"),
("OUTPUT","3.1","School management committees and communities are mobilised for education"),
("ACTIVITY","A3.1.1","Train school management committees and develop school improvement plans"),
("ACTIVITY","A3.1.2","Community dialogues on girls' education, early marriage and child protection"),
("OUTPUT","3.2","Girls and learners with disabilities receive targeted support"),
("ACTIVITY","A3.2.1","Provide bursaries and dignity kits to girls"),
("ACTIVITY","A3.2.2","Provide assistive support to learners with disabilities and psychosocial training for teachers"),
]
IND = [
("GI-1","Net enrolment rate in target schools","PERCENTAGE","62","78","%","Quarterly","","G","School enrolment registers (NEMIS)"),
("OC1a","Average attendance rate of enrolled learners in target schools","PERCENTAGE","71","85","%","Quarterly","","OC1","School attendance registers"),
("OC1b","Learners retained to the end of the term","PERCENTAGE","78","90","%","Quarterly","","OC1","School registers"),
("OP1-1a","Out-of-school children enrolled in school or an accelerated education centre","NUMBER","0","6000","children","Monthly","","1.1","Enrolment registers"),
("OP1-1b","Communities reached through enrolment drives","NUMBER","0","120","communities","Monthly","","1.1","Campaign reports"),
("OP1-1c","Accelerated education centres established and running","NUMBER","0","24","centres","Monthly","","1.1","Centre registration records"),
("OP1-2a","Classrooms constructed or rehabilitated","NUMBER","0","40","classrooms","Monthly","","1.2","Completion certificates"),
("OP1-2b","Schools with gender-separated, functioning latrines and handwashing","NUMBER","0","30","schools","Monthly","","1.2","Handover certificates"),
("OP1-2c","Learners receiving scholastic kits","NUMBER","0","12000","learners","Monthly","","1.2","Distribution lists"),
("OC2a","Grade 3 learners reading with fluency and comprehension","PERCENTAGE","18","40","%","Quarterly","","OC2","Early grade reading assessment"),
("OC2b","Grade 3 learners meeting the numeracy benchmark","PERCENTAGE","22","42","%","Quarterly","","OC2","Early grade maths assessment"),
("OP2-1a","Teachers trained in competency-based and inclusive teaching","NUMBER","0","450","teachers","Monthly","","2.1","Training attendance sheets"),
("OP2-1b","Coaching visits made to teachers","NUMBER","0","900","visits","Monthly","","2.1","Coaching visit forms"),
("OP2-2a","Learners attending remedial reading and numeracy clubs","NUMBER","0","9000","learners","Monthly","","2.2","Club attendance registers"),
("OP2-2b","Remedial clubs established","NUMBER","0","120","clubs","Monthly","","2.2","Club registration records"),
("OP2-2c","Learners reached through radio and digital lessons","NUMBER","0","15000","learners","Monthly","","2.2","Listener and platform logs"),
("OC3a","Schools with an active management committee and a school improvement plan","PERCENTAGE","30","80","%","Quarterly","","OC3","School governance checklist"),
("OP3-1a","School management committee members trained","NUMBER","0","600","members","Monthly","","3.1","Training attendance sheets"),
("OP3-1b","Community dialogues held","NUMBER","0","150","dialogues","Monthly","","3.1","Dialogue reports"),
("OP3-1c","People reached through community dialogues","NUMBER","0","20000","people","Monthly","","3.1","Dialogue attendance sheets"),
("OP3-2a","Girls receiving bursaries","NUMBER","0","1500","girls","Monthly","","3.2","Bursary registers"),
("OP3-2b","Dignity kits distributed to girls","NUMBER","0","5000","kits","Monthly","","3.2","Distribution lists"),
("OP3-2c","Learners with disabilities receiving assistive support","NUMBER","0","400","learners","Monthly","","3.2","Support registers"),
("OP3-2d","Teachers trained in psychosocial support","NUMBER","0","240","teachers","Monthly","","3.2","Training attendance sheets"),
]
T,Gr,M,W,Ma = "Turkana","Garissa","Marsabit","Wajir","Mandera"
PLAN = [
("A1.1.1","Community enrolment drives - Turkana and Marsabit","2026-03-02","2026-03-27",T,"monthly"),
("A1.1.1","Community enrolment drives - Garissa, Wajir and Mandera","2026-03-09","2026-03-31",Gr,"monthly"),
("A1.1.2","Establish and run accelerated education centres - Turkana and Garissa","2026-03-02","2026-07-31",T,""),
("A1.1.2","Establish and run accelerated education centres - Marsabit, Wajir and Mandera","2026-03-16","2026-08-14",M,""),
("A1.2.1","Construct and rehabilitate classrooms and school WASH facilities - Turkana and Marsabit","2026-03-16","2026-08-14",T,""),
("A1.2.1","Construct and rehabilitate classrooms and school WASH facilities - Garissa, Wajir and Mandera","2026-04-01","2026-08-28",Gr,""),
("A1.2.2","Distribute scholastic kits and learning materials","2026-04-06","2026-08-14",W,""),
("A2.1.1","Train teachers in competency-based and inclusive teaching","2026-03-09","2026-07-17",Gr,""),
("A2.1.2","Coaching and classroom support visits to teachers","2026-04-01","2026-04-30",Ma,"monthly"),
("A2.2.1","Run remedial reading and numeracy clubs","2026-04-06","2026-08-21",T,""),
("A2.2.2","Deliver radio and digital learning lessons","2026-04-06","2026-08-28",W,""),
("A3.1.1","Train school management committees and develop school improvement plans","2026-03-09","2026-07-31",M,""),
("A3.1.2","Community dialogues on girls' education and child protection","2026-03-16","2026-03-27",Ma,"monthly"),
("A3.2.1","Provide bursaries and dignity kits to girls","2026-04-06","2026-08-14",Gr,""),
("A3.2.2","Assistive support for learners with disabilities and psychosocial training for teachers","2026-04-13","2026-08-14",T,""),
]
BUDGET = [("Classrooms and school WASH facilities",430000),("Enrolment drives and accelerated education centres",220000),("Teacher training and coaching",190000),
("Remedial, radio and digital learning",160000),("Girls' bursaries, dignity kits and inclusion",210000),("Monitoring, evaluation and learning",80000),("Staff and administration",160000)]
assert sum(b for _,b in BUDGET)==1450000
for n,rows,h in [("logframe",LF,["Level","Code","Title"]),("indicators",IND,["Code","Name","Type","Baseline","Target","Unit","Frequency","Disaggregated","Logframe Code","Data source"]),("workplan",PLAN,["Logframe Code","Title","Start","End","Location","Repeats"])]:
    with open(f"{out}/{n}.csv","w",newline="") as f: w=csv.writer(f); w.writerow(h); w.writerows(rows)
d=Document()
d.add_heading("Inclusive Quality Education for Out-of-School and Marginalised Children in Kenya's Arid Counties (IQE-KE)",0)
d.add_paragraph("Project proposal to the European Union (EU) Delegation to Kenya. Implementing organisation: Africa Learning Partnership (ALP). All organisations, people and figures in this document are fictional.")
d.add_heading("1. Project summary",1)
for t in ["Project code: KE-EDU-20260301. Contract number (fictional): FED/2026/410-221. Donor: European Union. Sector: Education. Country: Kenya. Duration: 1 March 2026 to 31 August 2026 (six months). Budget: EUR 1,450,000, expressed in euros.",
"ALP enrols out-of-school children through accelerated education centres and enrolment drives, improves classrooms and school WASH facilities, trains and coaches teachers, runs remedial reading and numeracy clubs and radio lessons, strengthens school management committees and supports girls and learners with disabilities in five counties: Turkana, Garissa, Marsabit, Wajir and Mandera."]: d.add_paragraph(t)
d.add_heading("2. Context and needs",1)
d.add_paragraph("In Kenya's arid and semi-arid counties, drought, displacement, distance to school, early marriage and poverty keep many children out of school. Classrooms are overcrowded, teachers are few and many learners cannot read or do basic arithmetic by Grade 3. Girls and children with disabilities are the most excluded. The figures in this scenario are illustrative.")
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
for t_ in ["Risk (high): drought, flooding and displacement interrupt schooling and school attendance. Mitigation: flexible school calendars, accelerated learning and radio lessons.",
"Risk (high): insecurity and inter-communal conflict restrict access to some sub-counties. Mitigation: community acceptance, flexible scheduling and remote monitoring.",
"Risk (medium): teacher strikes or posting changes reduce the effect of teacher training. Mitigation: train several teachers per school and involve head teachers.",
"Risk (medium): delays in construction materials and contractors. Mitigation: pre-qualified local contractors and early procurement.",
"Assumption: the Ministry of Education and county education offices continue to support schools and teacher deployment.",
"Assumption: communities and parents support girls' education and release children for school."]: d.add_paragraph(t_)
d.add_heading("6. Reporting",1)
d.add_paragraph("ALP reports to the EU at the end of the project; this scenario produces the final report only.")
d.save(f"{out}/KE-Proposal.docx")
wb=Workbook(); ws=wb.active; ws.title="Summary Budget"
ws.append(["Budget category","Total (EUR)"]); ws.append(["The budget is expressed in euros (EUR)."])
for n,a in BUDGET: ws.append([n,a])
ws.append(["Total",1450000]); wb.save(f"{out}/KE-Budget.xlsx")
wb=Workbook(); ws=wb.active; ws.title="Work plan"; ws.append(["Logframe Code","Title","Start","End","Location"])
for r in PLAN: ws.append(list(r[:5]))
wb.save(f"{out}/KE-WorkPlan.xlsx")
wb=Workbook(); ws=wb.active; ws.title="Logframe"; ws.append(["Level","Code","Title"])
for r in LF: ws.append(list(r))
wb.save(f"{out}/KE-Logframe.xlsx")
wb=Workbook(); ws=wb.active; ws.title="Indicators"; ws.append(["Indicator","Code","Baseline","Target","Unit","Frequency","Means of verification","Result"])
for r in IND: ws.append([r[1],r[0],r[3],r[4],r[5],r[6],r[9],r[8]])
wb.save(f"{out}/KE-Indicators.xlsx"); print("ok", len(IND), len(PLAN))
