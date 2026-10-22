"""Demo 11 — November 2026 evidence files (synthetic, with the month's real figures)."""
import os, sys
from datetime import date

OUT = "/tmp/kilo/dd11/evidence-nov"
os.makedirs(OUT, exist_ok=True)
use_venv = os.environ.get("USE_VENV") == "1"
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib import colors
from PIL import Image, ImageDraw
try:
    from openpyxl import Workbook
except ImportError:
    Workbook = None

OUT = os.environ.get("OUT", OUT)

ss = getSampleStyleSheet()
H1 = ParagraphStyle("h1", parent=ss["Heading1"], fontSize=15, spaceAfter=8)
H2 = ParagraphStyle("h2", parent=ss["Heading2"], fontSize=12, spaceAfter=6)
B = ss["BodyText"]
SM = ParagraphStyle("sm", parent=B, fontSize=9.5, leading=13)


def pdf(path, title, blocks):
    doc = SimpleDocTemplate(path, pagesize=A4, title=title)
    S = [Paragraph(title, H1)]
    for kind, payload in blocks:
        if kind == "h":
            S.append(Paragraph(payload, H2))
        elif kind == "p":
            S.append(Paragraph(payload, B))
        elif kind == "t":
            rows = [[Paragraph(str(c), SM) for c in r] for r in payload]
            t = Table(rows, repeatRows=1)
            t.setStyle(TableStyle([
                ("GRID", (0, 0), (-1, -1), 0.4, colors.grey),
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#e8eef7")),
                ("FONTSIZE", (0, 0), (-1, -1), 9),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 4),
                ("RIGHTPADDING", (0, 0), (-1, -1), 4),
            ]))
            S.append(t)
            S.append(Spacer(1, 8))
    doc.build(S)
    print("pdf:", path)


# ---------------------------------------------------------------- 1. BEmONC batch 1 attendance
pdf(f"{OUT}/nov-bemonc-batch1-attendance.pdf",
    "BEmONC and essential newborn care training, batch 1 — attendance sheet (Demo Zone Health Department)",
    [("p", "Trainer: Dr Sara Tesfaye (Health Advisor, South Ethiopia Health and Development Association). "
           "Venue: Basha health centre training hall. Dates: 9-14 November 2026. "
           "Participants: 24 midwives and nurses from the two supported health centres and eight health posts in Basha and Kecha woredas."),
     ("h", "Attendance"),
     ("t", [["No.", "Name (surname only)", "Woreda", "Role", "Sex", "Days attended", "Pre-test", "Post-test"],
            ["1", "A. Bekele", "Basha", "Midwife", "F", "6 of 6", "62%", "88%"],
            ["2", "F. Taye", "Basha", "Midwife", "F", "6 of 6", "58%", "85%"],
            ["3", "M. Girma", "Kecha", "Nurse", "M", "6 of 6", "55%", "82%"],
            ["4", "S. Alemu", "Kecha", "Nurse", "F", "6 of 6", "61%", "90%"],
            ["5", "H. Mengistu", "Basha", "Nurse", "M", "6 of 6", "48%", "79%"],
            ["6", "D. Wolde", "Basha", "Midwife", "F", "6 of 6", "66%", "91%"],
            ["7", "T. Fikru", "Kecha", "Nurse", "M", "6 of 6", "52%", "81%"],
            ["8", "R. Kebede", "Basha", "Midwife", "F", "6 of 6", "57%", "86%"],
            ["9", "K. Tadesse", "Kecha", "Nurse", "F", "6 of 6", "63%", "89%"],
            ["10", "Y. Bekele", "Kecha", "Nurse", "M", "5 of 6", "47%", "76%"],
            ["11", "Z. Gashaw", "Basha", "Midwife", "F", "6 of 6", "60%", "87%"],
            ["12", "B. Assefa", "Kecha", "Nurse", "M", "6 of 6", "50%", "80%"],
            ["13", "E. Solomon", "Basha", "Nurse", "F", "6 of 6", "64%", "92%"],
            ["14", "G. Mulugeta", "Kecha", "Nurse", "F", "6 of 6", "59%", "86%"],
            ["15", "W. Hailu", "Basha", "Nurse", "M", "6 of 6", "53%", "83%"],
            ["16", "P. Workinesh", "Kecha", "Midwife", "F", "6 of 6", "65%", "93%"],
            ["17", "N. Woldeyesus", "Basha", "Nurse", "M", "6 of 6", "56%", "84%"],
            ["18", "C. Girma", "Kecha", "Nurse", "F", "6 of 6", "58%", "85%"],
            ["19", "J. Abera", "Basha", "Nurse", "M", "5 of 6", "49%", "78%"],
            ["20", "L. Tesfaye", "Kecha", "Midwife", "F", "6 of 6", "67%", "94%"],
            ["21", "M. Bekele", "Basha", "Nurse", "F", "6 of 6", "60%", "88%"],
            ["22", "S. Gashaw", "Kecha", "Nurse", "M", "6 of 6", "51%", "80%"],
            ["23", "A. Dereje", "Basha", "Midwife", "F", "6 of 6", "62%", "90%"],
            ["24", "T. Dawit", "Kecha", "Nurse", "M", "6 of 6", "54%", "82%"]]),
     ("h", "Summary"),
     ("p", "24 participants were enrolled; 23 of 24 attended all six days and one participant withdrew after the first day. "
           "Participants were 17 female and 7 male. The mean pre-test score was 58 per cent and the mean post-test score 85 per cent. "
           "23 of 24 participants met the competency threshold of 80 per cent; one participant (No. 10) scored 76 per cent and was scheduled for repeat assessment in the December supervision round. "
           "The course covered basic emergency obstetric and newborn care: safe delivery, management of haemorrhage and hypertensive disorders, "
           "immediate newborn care including cord care and thermal protection, and recognition and referral of newborn danger signs."),
     ("p", "Facilitator note: participants from Kecha woreda asked for the practical delivery-station session to be repeated during the December supervision round.")])

# (the XLSX is written separately with the workers venv, which has openpyxl)

# ---------------------------------------------------------------- 3. Baseline survey tables
pdf(f"{OUT}/nov-baseline-household-survey-tables.pdf",
    "Baseline MNCH coverage survey, Woredas Basha and Kecha — summary tables (3-7 November 2026)",
    [("p", "Household survey carried out by 22 enumerators over five days, covering 511 households in 18 kebeles "
           "in Basha (16 kebeles) and Kecha (2 kebeles). Sampling frame: households with a woman who gave birth in the "
           "12 months before the survey or who was pregnant at the time of the visit. Interviewers used a structured "
           "questionnaire in Amharic with a Swahili version for Kecha."),
     ("h", "Table 1. Coverage of the sample"),
     ("t", [["Measure", "Basha", "Kecha", "Total"],
            ["Kebeles covered", 16, 2, 18],
            ["Households interviewed", 438, 73, 511],
            ["Women interviewed (birth in last 12 months or pregnant)", 402, 68, 470],
            ["Children under one year in the sample", 389, 64, 453]]),
     ("h", "Table 2. Newborn danger-sign knowledge"),
     ("p", "Women were asked whether they knew at least three of the following newborn danger signs: not feeding well, "
           "difficulty breathing, fever, cord infection, and convulsions."),
     ("t", [["Knowledge level", "Women", "Share of women interviewed"],
            ["Know at least three danger signs", 123, "26%"],
            ["Know one or two danger signs", 188, "40%"],
            ["Know no danger sign", 159, "34%"],
            ["Total interviewed", 470, "100%"]]),
     ("h", "Table 3. Timing of the first antenatal visit"),
     ("t", [["Timing of first ANC visit", "Women", "Share of women interviewed"],
            ["In the first trimester (before 14 weeks)", 158, "34%"],
            ["In the second trimester (14 to 27 weeks)", 141, "30%"],
            ["In the third trimester (28 weeks or later)", 171, "36%"],
            ["Total interviewed", 470, "100%"]]),
     ("h", "Table 4. Place of the last delivery and the newborn check"),
     ("t", [["Measure", "Number of last deliveries", "Share"],
            ["Delivered in a health facility", 214, "46%"],
            ["Delivered at home", 256, "54%"],
            ["Newborn checked at a health facility within 48 hours of birth", 132, "28%"],
            ["Newborn checked at home or not checked", 338, "72%"],
            ["Total last deliveries", 470, "100%"]]),
     ("h", "Table 5. Household decision making and reasons for home delivery"),
     ("t", [["Reason given for the last home delivery", "Women", "Share of home deliveries"],
            ["No transport or cost of transport", 79, "31%"],
            ["Distance from the health facility", 61, "24%"],
            ["Attended by a traditional birth attendant", 47, "18%"],
            ["Family or husband preferred a home delivery", 38, "15%"],
            ["Other reasons", 31, "12%"],
            ["Total home deliveries", 256, "100%"]]),
     ("p", "Data-quality note: 12 households were replaced because the woman was not present. Enumerator records were "
           "checked against the paper tally sheets before entry; no values were estimated. All figures in this document are "
           "counts from the survey register, not estimates.")])

# ---------------------------------------------------------------- 4. Enumerator training attendance
pdf(f"{OUT}/nov-enumerator-training-attendance.pdf",
    "Enumerator training for the baseline MNCH coverage survey — attendance (2-4 November 2026)",
    [("p", "Venue: Demo Zone Health Department training room. Facilitator: Lensa Ahmed, M&E Officer. "
           "22 enumerators and 4 supervisors attended. Fieldwork ran from 3 to 7 November 2026."),
     ("h", "Attendance"),
     ("t", [["Role", "Number", "Women", "Men", "Days"],
            ["Enumerators", 22, 11, 11, "3 of 3"],
            ["Supervisors", 4, 2, 2, "3 of 3"],
            ["Total", 26, 13, 13, "3 of 3"]]),
     ("h", "Content"),
     ("p", "The training covered the consent script, the household questionnaire, the anthropometric and MUAC "
           "measurement protocol, how to record a newborn danger sign without leading the answer, and the daily tally "
           "sheet. Enumerators practised on each other and then on 5 households per supervisor in the training area."),
     ("p", "A consent form was signed by every household before the interview. No personal names are copied into the "
           "summary tables; households are numbered from HB-0001 to HB-0511.")])

# ---------------------------------------------------------------- 5. WDA orientation attendance
pdf(f"{OUT}/nov-wda-orientation-round1-attendance.pdf",
    "Women's Development Army team-leader orientation, round 1 — attendance (30 November 2026)",
    [("p", "Venue: Aba Women's Development Association hall, Basha. Facilitators: Aster Girma (Field Officer, Kecha) "
           "and two health extension workers. 60 team leaders attended, one from each of the 18 kebeles in the two woredas "
           "and the three health centres."),
     ("h", "Attendance"),
     ("t", [["Measure", "Number", "Share"],
            ["Team leaders oriented", 60, "100%"],
            ["Women", 58, "97%"],
            ["Men", 2, "3%"],
            ["From Basha woreda", 42, "70%"],
            ["From Kecha woreda", 18, "30%"],
            ["Team leaders with a mobile phone", 47, "78%"]]),
     ("h", "Content"),
     ("p", "The orientation covered the 1-to-5 network structure, identification of pregnancy in the household, "
           "the referral slip, the danger signs that require a referral to a health post or health centre, and how to "
           "record a pregnancy in the register. Each team leader received 20 referral slips and the danger-sign card in "
           "Amharic."),
     ("p", "The next round of orientation is planned for late December 2026 in Kecha woreda. Participation is voluntary "
           "and the names of participants are held by the association only.")])

# ---------------------------------------------------------------- 6. Delivery corner photo (JPEG, consent)
img = Image.new("RGB", (1200, 800), "#dfe6ef")
d = ImageDraw.Draw(img)
d.rectangle([60, 60, 1140, 740], outline="#33445c", width=6)
d.rectangle([120, 180, 520, 620], fill="#eef3f9", outline="#33445c", width=3)
d.rectangle([560, 300, 1080, 620], fill="#eef3f9", outline="#33445c", width=3)
d.text((90, 100), "DELIVERY AND NEWBORN CARE CORNER - BASHA HEALTH POST", fill="#1b2a3d")
d.text((90, 140), "Rehabilitation completed 24 November 2026 - SEHDA / EU ECHO Action EMNCH-SE", fill="#33445c")
d.text((140, 210), "Delivery bed", fill="#1b2a3d")
d.text((140, 640), "Newborn corner: warm bag, cord care kit,", fill="#1b2a3d")
d.text((140, 665), "resuscitation trolley, solar lamp, steriliser", fill="#1b2a3d")
d.text((580, 340), "Solar lamp and resuscitation trolley", fill="#1b2a3d")
d.text((90, 700), "No patient identifiable. Consent for use of this photograph obtained.", fill="#33445c")
img.save(f"{OUT}/nov-healthpost-delivery-corner-photos-consent.jpg", quality=88)
print("jpg:", f"{OUT}/nov-healthpost-delivery-corner-photos-consent.jpg")
