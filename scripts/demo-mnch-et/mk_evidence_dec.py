"""Demo 11 — December 2026 evidence files (synthetic; figures follow the data plan in verification-demo-11.md section 11)."""
import os
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib import colors

OUT = os.environ.get("OUT", "/tmp/kilo/dd11/evidence-dec")
os.makedirs(OUT, exist_ok=True)
ss = getSampleStyleSheet()
H1 = ParagraphStyle("h1", parent=ss["Heading1"], fontSize=15, spaceAfter=8)
H2 = ParagraphStyle("h2", parent=ss["Heading2"], fontSize=12, spaceAfter=6)
B = ss["BodyText"]
SM = ParagraphStyle("sm", parent=B, fontSize=9.5, leading=13)


def pdf(name, title, blocks):
    doc = SimpleDocTemplate(f"{OUT}/{name}", pagesize=A4, title=title)
    story = [Paragraph(title, H1)]
    for kind, payload in blocks:
        if kind == "h":
            story.append(Paragraph(payload, H2))
        elif kind == "p":
            story.append(Paragraph(payload, B))
        else:
            t = Table([[Paragraph(str(c), SM) for c in r] for r in payload], repeatRows=1)
            t.setStyle(TableStyle([("GRID", (0, 0), (-1, -1), 0.4, colors.grey),
                                   ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#e8eef7")),
                                   ("VALIGN", (0, 0), (-1, -1), "TOP")]))
            story.append(t)
            story.append(Spacer(1, 8))
    doc.build(story)
    print("pdf:", name)


ORG = "South Ethiopia Health and Development Association (SEHDA)"
pdf("dec-mwh-opening-and-register-extract.pdf", "Maternity waiting homes — opening record and register extract, December 2026 (restricted)", [
    ("p", f"Prepared by {ORG} with the Demo Zone Health Department. Both homes opened on 1 December 2026. Patient-level register: case codes only, no names."),
    ("t", [["Home", "Opened", "Beds", "Stays in December", "Average stay (days)"],
           ["Basha health centre", "1 Dec 2026", "8", "13", "3.8"], ["Kecha health centre", "1 Dec 2026", "6", "9", "4.1"], ["Total", "", "14", "22", ""]]),
    ("p", "All 22 stays are women admitted in the last weeks of pregnancy; 20 delivered at the attached health centre, 2 were referred onward."),
])
pdf("dec-tracer-stock-cards-all-facilities.pdf", "Tracer medicine stock cards — all 12 supported facilities, December 2026", [
    ("p", "Tracer items: oxytocin, magnesium sulphate, misoprostol, amoxicillin, ORS, zinc, vaccine carrier supplies. Checked 14-18 December."),
    ("t", [["Facility", "Stock-out days (all tracers, month)", "Note"],
           ["Basha health centre", "1", ""], ["Kecha health centre", "2", "magnesium sulphate, 2 days"], ["Health post 1", "2", ""], ["Health post 2", "2", ""],
           ["Health post 3", "3", "misoprostol"], ["Health post 4", "1", ""], ["Health post 5", "2", ""], ["Health post 6", "2", ""],
           ["Health post 7", "3", "ORS"], ["Health post 8", "2", ""], ["Health post 9", "2", ""], ["Health post 10", "2", ""],
           ["Average across 12 facilities", "2.0 days", "Target 2 days or fewer"]]),
])
pdf("dec-wda-orientation-rounds-2-3-attendance.pdf", "Women's Development Army team-leader orientation, rounds 2 and 3 — attendance (confidential: names)", [
    ("p", "Round 2: 7-9 December, Basha woreda. Round 3: 14-16 December, Kecha woreda. 60 team leaders per round, 120 in December. Of the 120, 116 were women."),
    ("t", [["Round", "Venue", "Leaders oriented", "Women", "Men"], ["2", "Aba Women's Development Association hall, Basha", "60", "58", "2"], ["3", "Kecha woreda health office hall", "60", "58", "2"], ["Total", "", "120", "116", "4"]]),
])
pdf("dec-pregnancy-mapping-summary.pdf", "Kebele pregnancy mapping and referral slips — summary, 7-18 December 2026", [
    ("p", "Health extension workers and WDA leaders mapped pregnancies in 14 of 18 kebeles. 926 pregnancies were registered; referral slips were handed to every registered woman. The four kebeles not yet covered (11, 12, 15 and 17) are first in January."),
    ("t", [["Woreda", "Kebeles mapped", "Pregnancies registered"], ["Basha", "9 of 11", "611"], ["Kecha", "5 of 7", "315"], ["Total", "14 of 18", "926"]]),
])
pdf("dec-outreach-tally-kebeles-5-8.pdf", "Integrated outreach clinics, kebeles 5 to 8 — tally sheet, 8-11 December 2026", [
    ("t", [["Kebele", "ANC contacts", "PNC contacts", "Children vaccinated", "Women reached"], ["5", "58", "31", "74", "96"], ["6", "71", "38", "92", "118"],
           ["7", "64", "29", "81", "104"], ["8", "52", "27", "68", "92"], ["Total", "245", "125", "315", "410"]]),
    ("p", "410 women reached with ANC, PNC or immunisation services in the month's outreach clinics."),
])
pdf("dec-community-education-register.pdf", "Community education sessions — register, December 2026", [
    ("p", "36 sessions in 14 kebeles through women's groups, religious leaders and husbands' forums."),
    ("t", [["Group", "Sessions", "People reached", "Women", "Men"], ["Women's groups", "18", "1,030", "1,030", "0"], ["Religious leaders", "8", "380", "30", "350"],
           ["Husbands' forums", "10", "440", "30", "410"], ["Total", "36", "1,850", "1,090", "760"]]),
])
pdf("dec-referral-transport-log.pdf", "Community referral transport — log summary, December 2026 (confidential)", [
    ("p", "14 completed referrals to Basha or Kecha health centre by ambulance support or stretcher team. Case codes only."),
    ("t", [["Week", "Referrals completed", "Median time to facility (hours)"], ["1", "3", "1.5"], ["2", "4", "1.8"], ["3", "4", "1.6"], ["4", "3", "2.0"], ["Total", "14", ""]]),
])
pdf("dec-woreda-mnch-review-minutes.pdf", "Woreda MNCH data review and action meetings — minutes, December 2026", [
    ("p", "Two meetings held: Basha woreda health office on 28 December and Kecha woreda health office on 29 December, 11 participants each. Reviewed: delivery registers, stock cards and the pregnancy map. Actions: pre-position oxytocin and magnesium sulphate at both health centres by mid-January; extend mapping to kebeles 11, 12, 15 and 17."),
])
pdf("dec-supervision-round2-checklist.pdf", "Supportive supervision round 2 — checklist summary, 15 December 2026", [
    ("p", "Six facilities visited (Basha and Kecha health centres, health posts 2, 4, 7 and 9). Mentors observed 11 deliveries and 14 antenatal visits. Partograph used correctly in 9 of 11 deliveries; active management of the third stage in 10 of 11."),
])
pdf("dec-supply-delivery-notes.pdf", "MNCH supply order and last-mile delivery notes — December 2026", [
    ("p", "Forecast and order placed 1 December; delivered to all 12 supported facilities between 2 and 4 December. Delivered: delivery kits (120), clean-birth kits (400), oxytocin (600 ampoules), magnesium sulphate (300), ORS (2,000), zinc (1,500), vaccine carriers (6)."),
])
pdf("dec-radio-spots-log.pdf", "Radio messages on danger signs — broadcast log, December 2026", [
    ("p", "Two radio spots on pregnancy and newborn danger signs broadcast twice a week from 1 December on the zonal radio station, in Amharic and Wolayttatto. Each spot carries the EU funding statement."),
])
pdf("dec-maternal-death-notification.pdf", "Maternal death notification and facility review — Kecha health centre, December 2026 (restricted)", [
    ("p", "One maternal death notified to the woreda health office on 22 December 2026 (case code KEC-D-01). Facility review held on 23 December. Finding: delay in the decision to seek care at home, not a referral delay. Actions agreed: extend danger-sign messages through husbands' forums in the kebele."),
])
