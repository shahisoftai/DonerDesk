"""Generate demo-11 setup inputs: logframe paste text, indicators CSV, two EU DOCX templates."""
import csv, os
from docx import Document

OUT = "/tmp/kilo/dd11"
os.makedirs(OUT, exist_ok=True)

# ---------- 1. Logframe paste text (tabular, header Level,Code,Title) ----------
logframe = [
    ("GOAL", "G", "Maternal and newborn deaths and illness are reduced among women and children in Woredas Basha and Kecha, Demo Zone"),
    ("OUTCOME", "OC1", "Women and newborns receive quality, timely maternal and newborn health services at supported facilities and in the community"),
    ("OUTCOME", "OC2", "Families and communities support safe motherhood, early care-seeking and newborn care"),
    ("OUTPUT", "1.1", "Health workers (midwives, nurses, HEWs) competent in BEmONC, essential newborn care and integrated ANC/PNC"),
    ("OUTPUT", "1.2", "Supported facilities provide round-the-clock safe delivery, newborn care and referral (maternity waiting homes, referral transport)"),
    ("OUTPUT", "1.3", "Essential MNCH medicines and supplies are continuously available at supported facilities"),
    ("OUTPUT", "1.4", "Remote kebeles are reached by monthly integrated outreach clinics (ANC, PNC, immunisation)"),
    ("OUTPUT", "2.1", "Women's Development Army volunteers identify pregnancies early and refer"),
    ("OUTPUT", "2.2", "Men, women and community leaders support facility delivery and newborn care practices"),
    ("OUTPUT", "2.3", "Woreda health offices use MNCH data to manage services"),
    ("ACTIVITY", "A1.1.1", "BEmONC and essential newborn care training for midwives and nurses (two batches)"),
    ("ACTIVITY", "A1.1.2", "Integrated ANC/PNC and danger-sign refresher training for health extension workers"),
    ("ACTIVITY", "A1.1.3", "Monthly on-the-job mentoring and supportive supervision at supported facilities"),
    ("ACTIVITY", "A1.2.1", "Rehabilitate and equip delivery and newborn care corners at 4 health posts and 2 health centres"),
    ("ACTIVITY", "A1.2.2", "Operate two maternity waiting homes and the community referral transport scheme"),
    ("ACTIVITY", "A1.3.1", "Monthly MNCH supply forecasting, ordering and last-mile delivery"),
    ("ACTIVITY", "A1.3.2", "Monthly stock and cold-chain checks at supported facilities"),
    ("ACTIVITY", "A1.4.1", "Monthly integrated outreach clinics (ANC, PNC, immunisation) in remote kebeles"),
    ("ACTIVITY", "A2.1.1", "Orient and refresh WDA team leaders (1-to-5 networks) on pregnancy identification and danger signs"),
    ("ACTIVITY", "A2.1.2", "Kebele pregnancy mapping and referral-slip distribution with HEWs"),
    ("ACTIVITY", "A2.2.1", "Community education sessions through women's groups, religious leaders and husbands' forums"),
    ("ACTIVITY", "A2.2.2", "Radio messages and community conversations on maternal and newborn danger signs"),
    ("ACTIVITY", "A2.3.1", "Monthly woreda MNCH data review and action meetings"),
    ("ACTIVITY", "A2.3.2", "Baseline and endline MNCH coverage survey"),
]
with open(f"{OUT}/logframe.csv", "w", newline="") as f:
    w = csv.writer(f)
    w.writerow(["Level", "Code", "Title"])
    w.writerows(logframe)
print("logframe.csv:", len(logframe), "rows")

# ---------- 2. Indicators CSV ----------
indicators = [
    # Code, Name, Type, Baseline, Target, Unit, Frequency, Disaggregated, Logframe Code, Data source
    ("GI-1", "Institutional maternal deaths at supported facilities", "NUMBER", "4", "2", "deaths", "Final", "", "G", "Facility registers, maternal death review minutes"),
    ("OC1a", "Deliveries at supported facilities attended by a skilled birth attendant", "PERCENTAGE", "46", "65", "%", "Monthly", "", "OC1", "Delivery registers"),
    ("OC1b", "Newborns with a postnatal care check within 48 hours of birth", "PERCENTAGE", "28", "55", "%", "Monthly", "", "OC1", "PNC registers"),
    ("OC1c", "Pregnant women attending four or more ANC visits", "PERCENTAGE", "37", "55", "%", "Monthly", "", "OC1", "ANC registers"),
    ("OC1d", "Children under one year receiving Penta3 vaccine", "PERCENTAGE", "62", "78", "%", "Monthly", "", "OC1", "EPI registers"),
    ("OP1-1", "Health workers and HEWs trained in BEmONC, ENC and ANC/PNC", "NUMBER", "0", "132", "people", "Monthly", "yes", "1.1", "Training attendance sheets"),
    ("OP1-2a", "Women staying at a maternity waiting home before delivery", "NUMBER", "0", "240", "women", "Monthly", "", "1.2", "MWH registers"),
    ("OP1-2b", "Emergency obstetric and newborn referrals completed by project-supported transport", "NUMBER", "0", "120", "referrals", "Monthly", "", "1.2", "Referral slips, transport log"),
    ("OP1-3", "Tracer MNCH medicine stock-out days (average per supported facility in the month)", "NUMBER", "4", "2", "days", "Monthly", "", "1.3", "Stock cards (oxytocin, misoprostol, amoxicillin, RDT)"),
    ("OP1-4", "Women reached by integrated outreach clinics (ANC, PNC, immunisation)", "NUMBER", "0", "3600", "women", "Monthly", "", "1.4", "Outreach tally sheets"),
    ("OP2-1", "WDA team leaders oriented and active", "NUMBER", "0", "360", "people", "Monthly", "", "2.1", "Orientation attendance"),
    ("OP2-2", "People reached by community education on maternal and newborn health", "NUMBER", "0", "12000", "people", "Monthly", "yes", "2.2", "Session registers, radio log"),
    ("OP2-3", "Woreda MNCH data review meetings held", "NUMBER", "0", "12", "meetings", "Monthly", "", "2.3", "Meeting minutes"),
    ("OC2a", "Recently delivered women who know at least three newborn danger signs", "PERCENTAGE", "24", "45", "%", "Survey", "", "OC2", "Household survey"),
    ("OC2b", "Mothers who attended ANC in the first trimester (most recent birth)", "PERCENTAGE", "31", "50", "%", "Survey", "", "OC2", "Household survey"),
]
with open(f"{OUT}/indicators.csv", "w", newline="") as f:
    w = csv.writer(f)
    w.writerow(["Code", "Name", "Type", "Baseline", "Target", "Unit", "Frequency", "Disaggregated", "Logframe Code", "Data source"])
    w.writerows(indicators)
print("indicators.csv:", len(indicators), "rows")

# ---------- 3. Donor template DOCX files ----------
def mk(path, title, intro, sections):
    d = Document()
    d.add_heading(title, 0)
    d.add_paragraph(intro)
    for lvl, h, ins, qs, ev in sections:
        d.add_heading(h, lvl)
        d.add_paragraph(ins)
        for q in qs:
            d.add_paragraph(q, style="List Bullet")
        if ev:
            d.add_paragraph("Evidence needed: " + "; ".join(ev))
    d.save(path)

GRANT = "ECHO/ET/BUD/2026/91066"

mk(f"{OUT}/EU-ECHO-Monthly-Progress-Report-EMNCH-SE.docx",
   f"European Union (ECHO) — Monthly Progress Report, Emergency MNCH Response, Demo Zone (Grant {GRANT})",
   "The partner sends this monthly progress report to the ECHO field office within 15 days of the end of each month of the Action. Report only verified results against the logframe of the Action. Write in plain, factual English in the third person, refer to 'the Action', and do not use promotional language. Disaggregate people-level results by sex. Figures that were not measured must be stated as not measured, never as zero.",
   [
    (1, "1. Summary of the Month", "Summarise the month in no more than 250 words: the main results, the main problem and the main decision needed.",
     ["What was the most important result of the month for mothers and newborns?"],
     ["Monthly summary approved by the project manager"]),
    (1, "2. Progress Against Expected Results", "Report progress against the logframe indicators of the Action.",
     ["Provide a results table: indicator, this month, cumulative, target, percent of target.",
      "Explain any indicator behind plan and the corrective action."],
     ["Verified indicator table from the reporting period"]),
    (1, "3. Activities Implemented", "List the activities implemented by woreda with dates and participants.",
     ["Which planned activities were not carried out, and why?"],
     ["Activity records", "Attendance sheets"]),
    (1, "4. Outcome Indicators and Data Quality", "Comment on the quality and completeness of the data behind the outcome indicators (registers, surveys), including any known gaps.",
     ["State the source and period of every outcome figure."],
     ["Register quality checks", "Supervision notes"]),
    (1, "5. Challenges, Risks and Mitigation", "Describe implementation challenges, security and access constraints and how the Action adapted, in no more than 400 words.",
     ["Which risk materialised this month and what was done?"], []),
    (1, "6. Protection, Gender and Accountability to Affected Populations", "Describe how protection mainstreaming, gender equality and accountability to affected populations were applied this month, and report complaints received and resolved.",
     ["Any safeguarding or protection concern this month? How was it referred?",
      "Provide sex-disaggregated results where applicable."],
     ["Feedback log", "Protection referral records (no personal names)"]),
    (1, "7. Visibility and Communication", "Report EU visibility measures for the month. Use the visibility statement in exactly one section of every report.",
     ["State where the EU emblem and 'Funded by the European Union' appeared this month.",
      "Quote the EU disclaimer: The funded by the European Union. Views and opinions expressed are however those of the partner and do not necessarily reflect those of the European Union. Neither the European Union nor the granting authority can be held responsible for them."],
     ["Photos with consent", "Radio log"]),
    (1, "8. Plan for the Next Month", "State the planned activities and expected results for the coming month.",
     [], []),
   ])

mk(f"{OUT}/EU-ECHO-Final-Narrative-and-Financial-Report-EMNCH-SE.docx",
   f"European Union (ECHO) — Final Narrative and Financial Report, Emergency MNCH Response, Demo Zone (Grant {GRANT})",
   "The final report covers the whole duration of the Action and is submitted within 60 days of its end date. Assess the Action against its logframe and the OECD-DAC evaluation criteria. Use a factual, evidence-based register, report life-of-project figures from verified records, and state plainly which targets were not met and why. Disaggregate people-level results by sex.",
   [
    (1, "1. Executive Summary", "Summarise the Action, its main results and overall performance in no more than 400 words.", [], []),
    (1, "2. Context and Description of the Action", "Describe the context and the design of the Action.", [], []),
    (2, "2.1 Context Update", "Describe the situation in Woredas Basha and Kecha and any significant change during implementation, including the January displacement influx.",
     ["Who were the people reached and how were they identified?"], []),
    (2, "2.2 Intervention Logic", "Describe how the outputs were expected to lead to the outcomes and impact, and whether the logic held.", [], []),
    (1, "3. Assessment of Implementation", "Assess the implementation of the Action against the work plan.", [], []),
    (2, "3.1 Outcome Results", "Report the outcome and impact indicators.",
     ["Provide an indicator table: baseline, target, achieved, percent of target.",
      "Explain any target that was not met."], ["Verified indicator table", "Survey tables"]),
    (2, "3.2 Output Delivery", "Report delivery of every output, disaggregated by sex where applicable.",
     ["Provide a table of output indicators: target, achieved, percent of target."], []),
    (2, "3.3 Activities", "Summarise the activities carried out over the whole Action with dates and reach.", [], ["Activity records"]),
    (2, "3.4 Deviations from Plan", "Explain deviations from the work plan and any variance in results.",
     ["What caused each deviation and what was done about it?"], []),
    (1, "4. Assessment Against Evaluation Criteria", "Assess the Action against the OECD-DAC criteria.", [], []),
    (2, "4.1 Relevance", "To what extent did the Action address the identified needs?", [], []),
    (2, "4.2 Effectiveness", "To what extent were the intended results achieved?", [], []),
    (2, "4.3 Efficiency", "How well were resources used to deliver the results?", [], []),
    (2, "4.4 Sustainability", "What will continue after the Action, and how?", [], []),
    (2, "4.5 Impact", "What real difference did the Action make to maternal and newborn survival?", [], []),
    (1, "5. Cross-Cutting Issues: Gender, Environment and Do-No-Harm", "Report on gender equality, environmental considerations and the do-no-harm approach.",
     ["Provide sex-disaggregated results and explain gender gaps."], []),
    (1, "6. Risks and Assumptions", "State which risks materialised, how the Action adapted, and any change that needed the donor's agreement.", [], []),
    (1, "7. Visibility and Communication", "Report EU visibility over the whole Action. Keep the visibility statement in exactly one section of the report.",
     ["Quote the EU disclaimer: The funded by the European Union. Views and opinions expressed are however those of the partner and do not necessarily reflect those of the European Union. Neither the European Union nor the granting authority can be held responsible for them."], ["Radio log", "Photos with consent"]),
    (1, "8. Lessons Learned", "State the main lessons for future humanitarian MNCH programming.",
     ["What would the partner do differently?"], []),
    (1, "9. Sustainability and Exit Strategy", "Explain what was handed over to the woreda health offices and how services will continue.", [], ["Handover certificates"]),
    (1, "10. Financial Report", "Provide the budget and expenditure of the Action by budget line.",
     ["Include a table: budget line, budget, expended, balance.",
      "Explain any variance above ten percent."], ["Statement of expenditure"]),
    (1, "11. Recommendations", "Recommend priorities for the donor, the regional health bureau and implementing partners.", [], []),
   ])

print("Templates written to", OUT)
