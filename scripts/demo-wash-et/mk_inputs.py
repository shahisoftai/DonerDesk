"""Demo 13 setup inputs: logframe CSV, indicators CSV, two UNICEF-styled DOCX templates (WASH, Ethiopia).
All content is fictional/synthetic. Run: python3 scripts/demo-wash-et/mk_inputs.py  (needs python-docx). Writes to /tmp/kilo/dd13."""
import csv, json, os
from docx import Document

OUT = os.environ.get("OUT", "/tmp/kilo/dd13")
os.makedirs(OUT, exist_ok=True)

# Depth-first order (parent immediately before its children) - the order demo 12 proved safe for pasting.
logframe = [
    ("GOAL", "G", "Waterborne disease is reduced and health and dignity improved for displaced and host communities in six drought-affected woredas of Amhara, Afar and Oromia, Ethiopia"),
    ("OUTCOME", "OC1", "Displaced and host households in the six woredas use safe, functional drinking water and sanitation services"),
    ("OUTPUT", "1.1", "Water points are drilled, rehabilitated and solar-powered (boreholes, hand pumps and piped mini-schemes)"),
    ("ACTIVITY", "A1.1.1", "Survey, drill and construct new boreholes with solar pumping (two schemes)"),
    ("ACTIVITY", "A1.1.2", "Rehabilitate broken water points and hand pumps (six sites)"),
    ("ACTIVITY", "A1.1.3", "Extend and chlorinate the Kombolcha piped scheme"),
    ("OUTPUT", "1.2", "Displaced and host households use gender-sensitive, lockable household latrines with handwashing stations"),
    ("ACTIVITY", "A1.2.1", "Construct household latrines with displaced and host households (600 latrines)"),
    ("OUTPUT", "1.3", "Schools and health facilities have WASH blocks with handwashing and menstrual hygiene facilities"),
    ("ACTIVITY", "A1.3.1", "Construct WASH blocks in schools and health facilities (8 blocks)"),
    ("OUTPUT", "1.4", "Water is treated and quality is monitored at water points and in households"),
    ("ACTIVITY", "A1.4.1", "Monthly water quality testing and treatment at water points"),
    ("ACTIVITY", "A1.4.2", "Distribute household water treatment supplies and test kits"),
    ("OUTCOME", "OC2", "Communities and institutions in the six woredas sustain hygiene practices and manage their WASH services"),
    ("OUTPUT", "2.1", "Women, men and children practise key hygiene behaviours reached through promotion and community-led total sanitation"),
    ("ACTIVITY", "A2.1.1", "Train community hygiene promoters and run hygiene promotion sessions"),
    ("ACTIVITY", "A2.1.2", "Community-led total sanitation triggering and ODF verification"),
    ("OUTPUT", "2.2", "Water point committees manage, finance and maintain their schemes"),
    ("ACTIVITY", "A2.2.1", "Form and train water point committees and set tariffs"),
    ("ACTIVITY", "A2.2.2", "Support spare-part shops and train maintenance artisans"),
    ("OUTPUT", "2.3", "Woreda water offices plan and coordinate the WASH response with data"),
    ("ACTIVITY", "A2.3.1", "Monthly woreda WASH coordination and data review meetings"),
    ("ACTIVITY", "A2.3.2", "Baseline and endline household WASH survey"),
    ("ACTIVITY", "A2.3.3", "Hygiene kit distribution for newly displaced households"),
]
with open(f"{OUT}/logframe.csv", "w", newline="") as f:
    w = csv.writer(f); w.writerow(["Level", "Code", "Title"]); w.writerows(logframe)
print("logframe.csv", len(logframe))

H = ["Code", "Name", "Type", "Baseline", "Target", "Unit", "Frequency", "Disaggregated", "Logframe Code", "Data source"]
ind = [
    ("GI-1", "Diarrhoea prevalence in children under five (two-week recall)", "PERCENTAGE", "31", "15", "%", "Survey", "", "G", "Household WASH survey (baseline and endline)"),
    ("OC1a", "Households using an improved drinking water source", "PERCENTAGE", "42", "75", "%", "Survey", "", "OC1", "Household WASH survey"),
    ("OC1b", "Households with a functional, unshared household latrine", "PERCENTAGE", "28", "55", "%", "Survey", "", "OC1", "Household WASH survey, latrine inspection checklist"),
    ("OC1c", "Water points functional at spot check", "PERCENTAGE", "55", "90", "%", "Monthly", "", "OC1", "Water quality and functionality spot-check log"),
    ("OC2a", "Households with a handwashing facility with soap and water", "PERCENTAGE", "22", "60", "%", "Survey", "", "OC2", "Household WASH survey, spot checks"),
    ("OP1-1", "Water points constructed or rehabilitated", "NUMBER", "0", "20", "water points", "Monthly", "yes", "1.1", "Drilling logs, completion and handover certificates"),
    ("OP1-2", "People with new or improved access to safe drinking water", "NUMBER", "0", "30000", "people", "Monthly", "yes", "1.1", "Water point population estimate and handover records"),
    ("OP1-3", "Household latrines constructed", "NUMBER", "0", "600", "latrines", "Monthly", "yes", "1.2", "Latrine completion register and inspection checklists"),
    ("OP1-4", "School and health-facility WASH blocks constructed", "NUMBER", "0", "8", "blocks", "Monthly", "yes", "1.3", "Completion certificates"),
    ("OP1-5", "Handwashing facilities installed at institutions and water points", "NUMBER", "0", "340", "facilities", "Monthly", "yes", "1.3", "Installation register, photographs"),
    ("OP1-6", "Water quality tests conducted", "NUMBER", "0", "320", "tests", "Monthly", "", "1.4", "Water quality test logs"),
    ("OP1-7", "Households supplied with household water treatment supplies", "NUMBER", "0", "2500", "households", "Monthly", "yes", "1.4", "Distribution registers"),
    ("OP2-1", "People reached by hygiene promotion sessions", "NUMBER", "0", "24000", "people", "Monthly", "yes", "2.1", "Session attendance registers"),
    ("OP2-2", "Hygiene promotion sessions held", "NUMBER", "0", "480", "sessions", "Monthly", "", "2.1", "Session registers, mobiliser daily logs"),
    ("OP2-3", "Water point committees established and trained", "NUMBER", "0", "16", "committees", "Monthly", "yes", "2.2", "Training attendance sheets, committee minutes"),
    ("OP2-4", "Hygiene kits distributed to newly displaced households", "NUMBER", "0", "1800", "kits", "Monthly", "yes", "2.3", "Distribution lists"),
    ("OP2-5", "Woreda WASH coordination meetings held", "NUMBER", "0", "12", "meetings", "Monthly", "", "2.3", "Meeting minutes"),
]
with open(f"{OUT}/indicators.csv", "w", newline="") as f:
    w = csv.writer(f); w.writerow(H); w.writerows(ind)
print("indicators.csv", len(ind))

# Illustrative square boundaries (about 0.5 degree) around the six woredas. NOT real administrative boundaries.
SITES = {"Dessie": (39.63, 11.13), "Kombolcha": (39.74, 11.10), "Bati": (40.02, 11.19),
         "Kemissie": (39.87, 10.72), "Mille": (40.73, 11.93), "Awash": (40.16, 10.17)}
feats = []
for name, (x, y) in SITES.items():
    d = 0.3
    ring = [[x-d, y-d], [x+d, y-d], [x+d, y+d], [x-d, y+d], [x-d, y-d]]
    feats.append({"type": "Feature", "properties": {"name": name}, "geometry": {"type": "Polygon", "coordinates": [ring]}})
with open(f"{OUT}/ethiopia-six-woredas.geojson", "w") as f:
    json.dump({"type": "FeatureCollection", "features": feats}, f)

def mk(path, title, intro, sections):
    d = Document(); d.add_heading(title, 0); d.add_paragraph(intro)
    for lvl, h, ins, qs, ev in sections:
        d.add_heading(h, lvl); d.add_paragraph(ins)
        for q in qs: d.add_paragraph(q, style="List Bullet")
        if ev: d.add_paragraph("Evidence needed: " + "; ".join(ev))
    d.save(path)

PCA = "PCA/ETCO/2026/0773"
VIS = ("Quote the UNICEF acknowledgement: This publication was made possible with funding from UNICEF. The views expressed are those of the partner and do not necessarily reflect the views of UNICEF.")
mk(f"{OUT}/UNICEF-PCA-Monthly-WASH-Progress-Report-RWSH-ET.docx",
   f"UNICEF Ethiopia Country Office - Monthly WASH Progress Report, Resilient WASH Services in Six Woredas (Programme Cooperation Agreement {PCA})",
   "The partner submits this report to the UNICEF Ethiopia WASH section within 15 days of the end of each month. Report only verified results against the results framework. Write in plain, factual English in the third person. Disaggregate people-level results by sex and by woreda. Figures that were not measured must be stated as not measured, never as zero.",
   [
    (1, "1. Summary of the Month", "Summarise the month in no more than 250 words: the main results, the main problem and the main decision needed.", ["What was the most important result of the month for the communities served?"], ["Monthly summary approved by the project manager"]),
    (1, "2. Progress Against Expected Results", "Report progress against the indicators of the results framework.", ["Provide a results table: indicator, this month, cumulative, target, percent of target.", "Explain any indicator behind plan and the corrective action."], ["Verified indicator table from the reporting period"]),
    (1, "3. Activities Implemented by Woreda", "List the activities implemented in each of the six woredas with dates and participants.", ["Which planned activities were not carried out, and why?"], ["Activity records", "Attendance sheets"]),
    (1, "4. Water Quality and Data Quality", "Comment on water quality monitoring results and on the quality and completeness of the programme data (test logs, construction registers, surveys), including known gaps by woreda.", ["State the source and period of every coverage figure."], ["Water quality test logs", "Supervision notes"]),
    (1, "5. Access, Risks and Mitigation", "Describe access and security constraints, supply-chain problems and how the programme adapted, in no more than 400 words.", ["Which risk materialised this month and what was done?"], []),
    (1, "6. Protection, Gender and Accountability to Affected Populations", "Describe how protection from sexual exploitation and abuse, gender equality and accountability to affected populations were applied this month, and report feedback received and resolved.", ["Any safeguarding or protection concern this month? How was it referred?", "Provide sex-disaggregated results where applicable."], ["Feedback log", "Protection referral records (no personal names)"]),
    (1, "7. Visibility and Communication", "Report UNICEF visibility measures for the month. Use the acknowledgement statement in exactly one section of every report.", ["State where the UNICEF logo and funding acknowledgement appeared this month.", VIS], ["Photos with consent", "Radio log"]),
    (1, "8. Plan for the Next Month", "State the planned activities and expected results for the coming month.", [], []),
   ])
mk(f"{OUT}/UNICEF-PCA-Final-WASH-Programme-Report-RWSH-ET.docx",
   f"UNICEF Ethiopia Country Office - Final Programme and Financial Report, Resilient WASH Services in Six Woredas (Programme Cooperation Agreement {PCA})",
   "The final report covers the whole duration of the agreement and is submitted within 60 days of its end date. Assess the programme against its results framework and the OECD-DAC criteria. Use a factual, evidence-based register, report life-of-project figures from verified records, state plainly which targets were not met and why. Disaggregate people-level results by sex and woreda.",
   [
    (1, "1. Executive Summary", "Summarise the programme, its main results and overall performance in no more than 400 words.", [], []),
    (1, "2. Context and Description of the Programme", "Describe the context and the design of the programme.", [], []),
    (2, "2.1 Context Update", "Describe the situation in the six woredas and any significant change during implementation, including displacement movements.", ["Who were the people reached and how were they identified?"], []),
    (2, "2.2 Intervention Logic", "Describe how the outputs were expected to lead to the outcomes and impact, and whether the logic held.", [], []),
    (1, "3. Assessment of Implementation", "Assess the implementation of the programme against the work plan.", [], []),
    (2, "3.1 Outcome Results", "Report the outcome and impact indicators.", ["Provide an indicator table: baseline, target, achieved, percent of target.", "Explain any target that was not met."], ["Verified indicator table", "Survey tables"]),
    (2, "3.2 Output Delivery by Woreda", "Report delivery of every output, by woreda and disaggregated by sex where applicable.", ["Provide a table of output indicators: target, achieved, percent of target."], []),
    (2, "3.3 Activities", "Summarise the activities carried out over the whole programme with dates and reach.", [], ["Activity records"]),
    (2, "3.4 Deviations from Plan", "Explain deviations from the work plan and any variance in results.", ["What caused each deviation and what was done about it?"], []),
    (1, "4. Assessment Against Evaluation Criteria", "Assess the programme against the OECD-DAC criteria.", [], []),
    (2, "4.1 Relevance", "To what extent did the programme address the identified needs?", [], []),
    (2, "4.2 Effectiveness", "To what extent were the intended results achieved?", [], []),
    (2, "4.3 Efficiency", "How well were resources used to deliver the results?", [], []),
    (2, "4.4 Sustainability", "What will continue after the programme, and how?", [], []),
    (2, "4.5 Impact", "What real difference did the programme make to health and dignity in the six woredas?", [], []),
    (1, "5. Cross-Cutting Issues: Gender, Protection and Accountability", "Report on gender equality, protection and accountability to affected populations.", ["Provide sex-disaggregated results and explain gender gaps."], []),
    (1, "6. Risks and Assumptions", "State which risks materialised, how the programme adapted, and any change that needed UNICEF's agreement.", [], []),
    (1, "7. Visibility and Communication", "Report UNICEF visibility over the whole programme. Keep the acknowledgement statement in exactly one section.", [VIS], ["Radio log", "Photos with consent"]),
    (1, "8. Lessons Learned", "State the main lessons for future WASH programming in drought-affected Ethiopia.", ["What would the partner do differently?"], []),
    (1, "9. Sustainability and Exit Strategy", "Describe the handover of water schemes to woreda water offices and communities.", [], []),
    (1, "10. Financial Report", "Report expenditure against the budget by line. Explain any variance above 10 percent of the line.", ["Provide a table: budget line, budget, expenditure, balance."], ["Statement of expenditure"]),
    (1, "11. Recommendations", "State the recommendations to UNICEF and to future programming.", [], []),
   ])
print("templates written")
