"""Generate demo-12 setup inputs: logframe CSV, indicators CSV, two UNICEF-styled DOCX templates, illustrative state boundaries (GeoJSON).
All content is fictional/synthetic. Run: python3 scripts/demo-mnch-sd/mk_inputs.py  (needs python-docx). Writes to /tmp/kilo/dd12."""
import csv, json, os
from docx import Document

OUT = os.environ.get("OUT", "/tmp/kilo/dd12")
os.makedirs(OUT, exist_ok=True)

logframe = [
    ("GOAL", "G", "Maternal, newborn and child deaths and illness are reduced among displaced and host communities in six localities of Kassala, Gedaref, Blue Nile, White Nile, Sennar and Red Sea States, Sudan"),
    ("OUTCOME", "OC1", "Women, newborns and children under five in the six localities use quality, timely maternal, newborn and child health, immunisation and nutrition-screening services at supported primary health care centres and through mobile teams"),
    ("OUTCOME", "OC2", "Caregivers and communities in the six localities practise safe motherhood, early care-seeking and optimal infant and young child feeding"),
    ("OUTPUT", "1.1", "Midwives, nurses and community health workers are competent in emergency obstetric and newborn care, IMNCI and immunisation"),
    ("OUTPUT", "1.2", "Supported primary health care centres provide safe delivery, newborn care and referral (rehabilitated delivery rooms, referral transport)"),
    ("OUTPUT", "1.3", "Essential MNCH medicines, vaccines and nutrition supplies are continuously available at supported facilities with a working cold chain"),
    ("OUTPUT", "1.4", "Displaced and remote communities are reached by monthly mobile integrated outreach (ANC, PNC, immunisation, malnutrition screening)"),
    ("OUTPUT", "2.1", "Community health volunteers identify pregnancies, sick children and malnutrition early and refer"),
    ("OUTPUT", "2.2", "Caregivers, men and community leaders support facility delivery, immunisation and infant and young child feeding practices"),
    ("OUTPUT", "2.3", "State ministries of health use MNCH data to manage services"),
    ("ACTIVITY", "A1.1.1", "Emergency obstetric and newborn care (EmONC) training for midwives and nurses (two batches)"),
    ("ACTIVITY", "A1.1.2", "IMNCI, immunisation and nutrition-screening refresher for primary health care staff"),
    ("ACTIVITY", "A1.1.3", "Monthly on-the-job mentoring and supportive supervision at supported facilities"),
    ("ACTIVITY", "A1.2.1", "Rehabilitate and equip delivery rooms and newborn corners at 12 primary health care centres (two per locality)"),
    ("ACTIVITY", "A1.2.2", "Operate the community referral transport scheme (ambulances and motorcycle-ambulances)"),
    ("ACTIVITY", "A1.3.1", "Monthly MNCH supply forecasting, ordering and last-mile delivery"),
    ("ACTIVITY", "A1.3.2", "Monthly stock and cold-chain checks at supported facilities"),
    ("ACTIVITY", "A1.4.1", "Monthly mobile integrated outreach in displacement gathering sites and remote villages"),
    ("ACTIVITY", "A1.4.2", "Catch-up vaccination rounds for zero-dose and under-vaccinated children"),
    ("ACTIVITY", "A2.1.1", "Train community health volunteers on pregnancy identification, danger signs and referral"),
    ("ACTIVITY", "A2.1.2", "Village pregnancy and under-five registration with referral cards"),
    ("ACTIVITY", "A2.2.1", "Mother support groups and community education sessions (feeding, danger signs, immunisation)"),
    ("ACTIVITY", "A2.2.2", "Radio messages and community dialogues on maternal and child danger signs"),
    ("ACTIVITY", "A2.3.1", "Monthly state MNCH data review and action meetings"),
    ("ACTIVITY", "A2.3.2", "Baseline and endline MNCH coverage survey"),
]
with open(f"{OUT}/logframe.csv", "w", newline="") as f:
    w = csv.writer(f); w.writerow(["Level", "Code", "Title"]); w.writerows(logframe)
print("logframe.csv", len(logframe))

H = ["Code", "Name", "Type", "Baseline", "Target", "Unit", "Frequency", "Disaggregated", "Logframe Code", "Data source"]
ind = [
    ("GI-1", "Institutional maternal deaths at supported facilities", "NUMBER", "6", "3", "deaths", "Final", "", "G", "Facility registers, maternal death review minutes"),
    ("OC1a", "Deliveries at supported facilities attended by a skilled birth attendant", "PERCENTAGE", "41", "60", "%", "Monthly", "", "OC1", "Delivery registers"),
    ("OC1b", "Newborns with a postnatal care check within 48 hours of birth", "PERCENTAGE", "22", "45", "%", "Monthly", "", "OC1", "PNC registers"),
    ("OC1c", "Pregnant women attending four or more ANC visits", "PERCENTAGE", "29", "48", "%", "Monthly", "", "OC1", "ANC registers"),
    ("OC1d", "Children under one year receiving Penta3 vaccine", "PERCENTAGE", "58", "75", "%", "Monthly", "", "OC1", "EPI registers"),
    ("OC1e", "Zero-dose children identified and vaccinated", "NUMBER", "0", "6000", "children", "Monthly", "yes", "OC1", "EPI catch-up tally sheets"),
    ("OC1f", "Children 6-59 months with severe acute malnutrition referred and admitted to treatment", "PERCENTAGE", "52", "80", "%", "Monthly", "", "OC1", "Nutrition screening and admission registers"),
    ("OP1-1", "Midwives, nurses and community health workers trained (EmONC, IMNCI, immunisation)", "NUMBER", "0", "180", "people", "Monthly", "yes", "1.1", "Training attendance sheets"),
    ("OP1-2a", "Primary health care centres with rehabilitated and equipped delivery rooms", "NUMBER", "0", "12", "facilities", "Monthly", "yes", "1.2", "Handover certificates, site inspection reports"),
    ("OP1-2b", "Emergency obstetric and newborn referrals completed by project-supported transport", "NUMBER", "0", "300", "referrals", "Monthly", "yes", "1.2", "Referral slips, transport log"),
    ("OP1-3", "Tracer MNCH medicine stock-out days (average per supported facility in the month)", "NUMBER", "5", "2", "days", "Monthly", "", "1.3", "Stock cards (oxytocin, magnesium sulphate, amoxicillin, ORS, RUTF)"),
    ("OP1-4", "Women and children reached by mobile integrated outreach", "NUMBER", "0", "18000", "people", "Monthly", "yes", "1.4", "Outreach tally sheets"),
    ("OP2-1", "Community health volunteers trained and active", "NUMBER", "0", "300", "people", "Monthly", "yes", "2.1", "Training attendance sheets, volunteer activity log"),
    ("OP2-2", "Caregivers reached by community education on maternal and child health and feeding", "NUMBER", "0", "24000", "people", "Monthly", "yes", "2.2", "Session registers, radio log"),
    ("OP2-3", "State MNCH data review meetings held", "NUMBER", "0", "12", "meetings", "Monthly", "", "2.3", "Meeting minutes"),
    ("OC2a", "Recently delivered women who know at least three newborn danger signs", "PERCENTAGE", "21", "40", "%", "Survey", "", "OC2", "Household survey"),
    ("OC2b", "Infants under six months exclusively breastfed", "PERCENTAGE", "38", "55", "%", "Survey", "", "OC2", "Household survey"),
]
with open(f"{OUT}/indicators.csv", "w", newline="") as f:
    w = csv.writer(f); w.writerow(H); w.writerows(ind)
print("indicators.csv", len(ind))

# Illustrative square boundaries (about 1 degree) around the six localities. NOT real administrative boundaries.
SITES = {"Kassala": (36.40, 15.45), "Gedaref": (35.38, 14.03), "Ed Damazin": (34.36, 11.79),
         "Rabak": (32.74, 13.17), "Sinja": (33.93, 13.15), "Port Sudan": (37.22, 19.62)}
feats = []
for name, (x, y) in SITES.items():
    d = 0.45
    ring = [[x-d, y-d], [x+d, y-d], [x+d, y+d], [x-d, y+d], [x-d, y-d]]
    feats.append({"type": "Feature", "properties": {"name": name}, "geometry": {"type": "Polygon", "coordinates": [ring]}})
with open(f"{OUT}/sudan-six-localities.geojson", "w") as f:
    json.dump({"type": "FeatureCollection", "features": feats}, f)

def mk(path, title, intro, sections):
    d = Document(); d.add_heading(title, 0); d.add_paragraph(intro)
    for lvl, h, ins, qs, ev in sections:
        d.add_heading(h, lvl); d.add_paragraph(ins)
        for q in qs: d.add_paragraph(q, style="List Bullet")
        if ev: d.add_paragraph("Evidence needed: " + "; ".join(ev))
    d.save(path)

PCA = "PCA/SDCO/2026/0412"
VIS = ("Quote the UNICEF acknowledgement: This publication was made possible with funding from UNICEF. The views expressed are those of the partner and do not necessarily reflect the views of UNICEF.")
mk(f"{OUT}/UNICEF-PCA-Monthly-Progress-Report-SMNCH-SD.docx",
   f"UNICEF Sudan Country Office - Monthly Programme Progress Report, Strengthening MNCH Services in Six Localities (Programme Cooperation Agreement {PCA})",
   "The partner submits this report to the UNICEF Sudan health section within 15 days of the end of each month. Report only verified results against the results framework. Write in plain, factual English in the third person. Disaggregate people-level results by sex and by locality. Figures that were not measured must be stated as not measured, never as zero.",
   [
    (1, "1. Summary of the Month", "Summarise the month in no more than 250 words: the main results, the main problem and the main decision needed.", ["What was the most important result of the month for mothers, newborns and children?"], ["Monthly summary approved by the project manager"]),
    (1, "2. Progress Against Expected Results", "Report progress against the indicators of the results framework.", ["Provide a results table: indicator, this month, cumulative, target, percent of target.", "Explain any indicator behind plan and the corrective action."], ["Verified indicator table from the reporting period"]),
    (1, "3. Activities Implemented by Locality", "List the activities implemented in each of the six localities with dates and participants.", ["Which planned activities were not carried out, and why?"], ["Activity records", "Attendance sheets"]),
    (1, "4. Service Coverage and Data Quality", "Comment on the quality and completeness of the facility and outreach data (registers, tally sheets, surveys), including known gaps by locality.", ["State the source and period of every coverage figure."], ["Register quality checks", "Supervision notes"]),
    (1, "5. Access, Security, Risks and Mitigation", "Describe access and security constraints, supply-chain problems and how the programme adapted, in no more than 400 words.", ["Which risk materialised this month and what was done?"], []),
    (1, "6. Protection, Gender and Accountability to Affected Populations", "Describe how protection from sexual exploitation and abuse, gender equality and accountability to affected populations were applied this month, and report feedback received and resolved.", ["Any safeguarding or protection concern this month? How was it referred?", "Provide sex-disaggregated results where applicable."], ["Feedback log", "Protection referral records (no personal names)"]),
    (1, "7. Visibility and Communication", "Report UNICEF visibility measures for the month. Use the acknowledgement statement in exactly one section of every report.", ["State where the UNICEF logo and funding acknowledgement appeared this month.", VIS], ["Photos with consent", "Radio log"]),
    (1, "8. Plan for the Next Month", "State the planned activities and expected results for the coming month.", [], []),
   ])
mk(f"{OUT}/UNICEF-PCA-Final-Programme-Report-SMNCH-SD.docx",
   f"UNICEF Sudan Country Office - Final Programme and Financial Report, Strengthening MNCH Services in Six Localities (Programme Cooperation Agreement {PCA})",
   "The final report covers the whole duration of the agreement and is submitted within 60 days of its end date. Assess the programme against its results framework and the OECD-DAC criteria. Use a factual, evidence-based register, report life-of-project figures from verified records, state plainly which targets were not met and why. Disaggregate people-level results by sex and locality.",
   [
    (1, "1. Executive Summary", "Summarise the programme, its main results and overall performance in no more than 400 words.", [], []),
    (1, "2. Context and Description of the Programme", "Describe the context and the design of the programme.", [], []),
    (2, "2.1 Context Update", "Describe the situation in the six localities and any significant change during implementation, including the February displacement influx.", ["Who were the people reached and how were they identified?"], []),
    (2, "2.2 Intervention Logic", "Describe how the outputs were expected to lead to the outcomes and impact, and whether the logic held.", [], []),
    (1, "3. Assessment of Implementation", "Assess the implementation of the programme against the work plan.", [], []),
    (2, "3.1 Outcome Results", "Report the outcome and impact indicators.", ["Provide an indicator table: baseline, target, achieved, percent of target.", "Explain any target that was not met."], ["Verified indicator table", "Survey tables"]),
    (2, "3.2 Output Delivery by Locality", "Report delivery of every output, by locality and disaggregated by sex where applicable.", ["Provide a table of output indicators: target, achieved, percent of target."], []),
    (2, "3.3 Activities", "Summarise the activities carried out over the whole programme with dates and reach.", [], ["Activity records"]),
    (2, "3.4 Deviations from Plan", "Explain deviations from the work plan and any variance in results.", ["What caused each deviation and what was done about it?"], []),
    (1, "4. Assessment Against Evaluation Criteria", "Assess the programme against the OECD-DAC criteria.", [], []),
    (2, "4.1 Relevance", "To what extent did the programme address the identified needs?", [], []),
    (2, "4.2 Effectiveness", "To what extent were the intended results achieved?", [], []),
    (2, "4.3 Efficiency", "How well were resources used to deliver the results?", [], []),
    (2, "4.4 Sustainability", "What will continue after the programme, and how?", [], []),
    (2, "4.5 Impact", "What real difference did the programme make to maternal, newborn and child survival?", [], []),
    (1, "5. Cross-Cutting Issues: Gender, Protection and Accountability", "Report on gender equality, protection and accountability to affected populations.", ["Provide sex-disaggregated results and explain gender gaps."], []),
    (1, "6. Risks and Assumptions", "State which risks materialised, how the programme adapted, and any change that needed UNICEF's agreement.", [], []),
    (1, "7. Visibility and Communication", "Report UNICEF visibility over the whole programme. Keep the acknowledgement statement in exactly one section.", [VIS], ["Radio log", "Photos with consent"]),
    (1, "8. Lessons Learned", "State the main lessons for future humanitarian MNCH programming in Sudan.", ["What would the partner do differently?"], []),
    (1, "9. Sustainability and Exit Strategy", "Explain what was handed over to the state ministries of health and how services will continue.", [], ["Handover certificates"]),
    (1, "10. Financial Report", "Provide the budget and expenditure of the programme by budget line.", ["Include a table: budget line, budget, expended, balance.", "Explain any variance above ten percent."], ["Statement of expenditure"]),
    (1, "11. Recommendations", "Recommend priorities for UNICEF, the state ministries of health and implementing partners.", [], []),
   ])
print("written to", OUT)
