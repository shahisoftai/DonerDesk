"""Demo 12 - November 2026 evidence files (synthetic; the month's figures from verification-demo-12.md section 11). Writes to /tmp/kilo/dd12/evidence-nov."""
import os
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib import colors
from PIL import Image, ImageDraw

OUT = os.environ.get("OUT", "/tmp/kilo/dd12/evidence-nov")
os.makedirs(OUT, exist_ok=True)
ss = getSampleStyleSheet()
H1 = ParagraphStyle("h1", parent=ss["Heading1"], fontSize=15, spaceAfter=8)
B = ss["BodyText"]
SM = ParagraphStyle("sm", parent=B, fontSize=9.5, leading=13)
LOC = ["Kassala", "Gedaref", "Ed Damazin", "Rabak", "Sinja", "Port Sudan"]

def pdf(name, title, intro, table=None, extra=None):
    S = [Paragraph(title, H1), Paragraph("SMNCH-SD (PCA/SDCO/2026/0412) - synthetic demo record, November 2026. " + intro, B), Spacer(1, 8)]
    if table:
        t = Table([[Paragraph(str(c), SM) for c in r] for r in table], repeatRows=1)
        t.setStyle(TableStyle([("GRID", (0, 0), (-1, -1), 0.4, colors.grey), ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#e8eef7"))]))
        S += [t, Spacer(1, 8)]
    for p in extra or []:
        S.append(Paragraph(p, B))
    SimpleDocTemplate(f"{OUT}/{name}", pagesize=A4, title=title).build(S)

def split(total, parts):
    return list(zip(LOC, parts)) + [("Total", total)]

pdf("nov-baseline-survey-tables.pdf", "Baseline coverage survey - summary tables", "Household survey in the six localities, 2,610 households, 27 enumerators, fieldwork 3-12 November.",
    [["Indicator", "Baseline", "Note"], ["Women knowing at least three newborn danger signs (OC2a)", "21 %", "Recently delivered women, n = 612"], ["Infants under six months exclusively breastfed (OC2b)", "38 %", "n = 540"]])
pdf("nov-enumerator-training-attendance.pdf", "Enumerator training attendance", "Training of 27 enumerators, Kassala, 2-4 November.",
    [["Locality of origin", "Enumerators"]] + [[l, str(n)] for l, n in zip(LOC, [5, 5, 4, 5, 4, 4])] + [["Total", "27"]])
pdf("nov-emonc-batch1-attendance-kassala.pdf", "EmONC and essential newborn care - batch 1 attendance", "Six-day training, Kassala, 9-14 November. Participants are listed by chart number only.",
    [["Facility locality", "Female", "Male", "Total"], ["Kassala", "5", "1", "6"], ["Gedaref", "5", "1", "6"], ["Ed Damazin", "4", "1", "5"], ["Rabak", "4", "1", "5"], ["Sinja", "3", "1", "4"], ["Port Sudan", "3", "1", "4"], ["Total", "24", "6", "30"]])
pdf("nov-imnci-refresher-prepost-gedaref.pdf", "IMNCI, immunisation and nutrition-screening refresher - pre/post test", "Five-day refresher, Gedaref, 16-20 November, 24 primary health care staff (17 female, 7 male); 22 of 24 passed the post-test.",
    [["Locality", "Staff"], ["Kassala", "4"], ["Gedaref", "4"], ["Ed Damazin", "4"], ["Rabak", "4"], ["Sinja", "4"], ["Port Sudan", "4"], ["Total", "24"]])
pdf("nov-chv-round1-attendance.pdf", "Community health volunteer training - round 1 attendance", "Three-day rounds in each locality, 23-25 November. 60 volunteers: 44 female, 16 male; ten per locality. Volunteers are listed by code only.",
    [["Locality", "Female", "Male", "Total"]] + [[l, str(f), str(m), "10"] for l, f, m in zip(LOC, [8, 7, 7, 8, 7, 7], [2, 3, 3, 2, 3, 3])] + [["Total", "44", "16", "60"]])
pdf("nov-handover-certificate-kassala-phc1.pdf", "Handover certificate - delivery room, Kassala PHC 1", "Rehabilitation and equipment of the delivery room and newborn corner completed and handed over to the State Ministry of Health on 27 November. Three centres were handed over in November: Kassala, Gedaref and Port Sudan.",
    [["Locality", "Centres handed over (November)"], ["Kassala", "1"], ["Gedaref", "1"], ["Ed Damazin", "0"], ["Rabak", "0"], ["Sinja", "0"], ["Port Sudan", "1"], ["Total", "3"]])
pdf("nov-referral-slips-log.pdf", "Referral transport log - November", "Referrals completed by project-supported transport. Chart numbers only; patient-level extract - highly sensitive.",
    [["Locality", "Referrals completed"]] + [[l, str(n)] for l, n in zip(LOC, [8, 7, 5, 6, 5, 7])] + [["Total", "38"]])
pdf("nov-supply-delivery-notes.pdf", "Supply delivery notes - November order", "Monthly order of tracer medicines and vaccines. The Port Sudan convoy arrived four days late (6 November instead of 2 November) because of a road delay.",
    [["Item", "Ordered", "Delivered"], ["Oxytocin", "1,200", "1,200"], ["Magnesium sulphate", "600", "600"], ["Amoxicillin", "5,000", "5,000"], ["ORS sachets", "8,000", "8,000"], ["RUTF cartons", "400", "400"]])
pdf("nov-stock-cards-tracer-medicines.pdf", "Stock cards - tracer medicines", "Stock-out days per supported facility in November (12 facilities), average 3.1 days.",
    [["Locality", "Average stock-out days"]] + [[l, str(d)] for l, d in zip(LOC, [2.4, 2.8, 3.6, 3.0, 3.2, 3.6])] + [["All facilities (average)", "3.1"]])
pdf("nov-supervision-checklists.pdf", "Supportive supervision checklists - round 1", "Supervision of 12 supported facilities, 16-20 November. Registers complete in 10 of 12; cold-chain temperature logs complete in 11 of 12.")
pdf("nov-outreach-tally-six-localities.pdf", "Mobile outreach tally sheets - November", "One round per locality, 9-13 November (ANC, PNC, immunisation, malnutrition screening). Women and children reached: 1,420 (860 female, 560 male).",
    [["Locality", "Reached"]] + [[l, str(n)] for l, n in zip(LOC, [260, 240, 210, 250, 190, 270])] + [["Total", "1,420"]])
pdf("nov-catchup-vaccination-tally.pdf", "Catch-up vaccination tally - November", "Zero-dose children identified and vaccinated, 23-27 November: 410 (215 female, 195 male).",
    [["Locality", "Zero-dose children vaccinated"]] + [[l, str(n)] for l, n in zip(LOC, [70, 65, 60, 75, 55, 85])] + [["Total", "410"]])
pdf("nov-education-sessions-register.pdf", "Community education sessions register - November", "Mother support groups and education sessions, 16-27 November: 2,100 caregivers (1,390 female, 710 male).",
    [["Locality", "Caregivers reached"]] + [[l, str(n)] for l, n in zip(LOC, [380, 350, 310, 390, 300, 370])] + [["Total", "2,100"]])
pdf("nov-state-data-review-minutes.pdf", "State MNCH data review meeting - minutes", "Two review meetings held in Kassala on 26 and 27 November with the six state focal points. Decisions: weekly stock reporting from Port Sudan; evening sessions in Rabak.")

pdf("nov-facility-registers-extract.pdf", "Facility register extract - service coverage, November", "Rates computed from the ANC, delivery, PNC and EPI registers of the 12 supported facilities. Women and children are identified by chart number only.",
    [["Indicator", "November"], ["Deliveries attended by a skilled birth attendant (OC1a)", "42 %"], ["Newborns with PNC check within 48 hours (OC1b)", "24 %"], ["Pregnant women with 4+ ANC visits (OC1c)", "30 %"], ["Children under one with Penta3 (OC1d)", "59 %"], ["SAM children referred and admitted (OC1f)", "55 %"], ["Institutional maternal deaths (GI-1)", "0"]])

def png(name, caption, color):
    im = Image.new("RGB", (900, 600), color); d = ImageDraw.Draw(im)
    d.rectangle([40, 40, 860, 560], outline=(255, 255, 255), width=4)
    d.text((70, 80), caption, fill=(255, 255, 255)); d.text((70, 120), "Synthetic demo image - no faces, no personal data", fill=(255, 255, 255))
    im.save(f"{OUT}/{name}")

png("nov-rehab-site-photos-6-centres.png", "Rehabilitation sites - 6 centres, November 2026", (70, 110, 150))
png("nov-unicef-visibility-photos.png", "UNICEF acknowledgement on training folders and facility signs", (30, 120, 90))
print(sorted(os.listdir(OUT)), len(os.listdir(OUT)))
