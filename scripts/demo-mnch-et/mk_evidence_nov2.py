"""Demo 11 — remaining November 2026 evidence files (synthetic)."""
import os
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib import colors

OUT = os.environ.get("OUT", "/tmp/kilo/dd11/evidence-nov")
os.makedirs(OUT, exist_ok=True)
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
            ]))
            S.append(t); S.append(Spacer(1, 8))
    doc.build(S)
    print("pdf:", path)


# --- supervision round 1 checklist
pdf(f"{OUT}/nov-supervision-round1-checklist.pdf",
    "Supportive supervision round 1 — checklist, 6 supported facilities, 16 November 2026",
    [("p", "Supervisor: Dr Sara Tesfaye (Health Advisor). Facilities visited on 16 November 2026: "
           "Basha health centre, Kecha health centre, and health posts 2, 4, 7 and 9. "
           "Eighteen health workers were observed (11 midwives and nurses, 7 health extension workers)."),
     ("h", "Checklist summary"),
     ("t", [["Item observed", "Met", "Partly met", "Not met"],
            ["Antenatal care history and danger signs asked at every booking", 6, 0, 0],
            ["Partograph used during labour", 4, 2, 0],
            ["Immediate newborn care and cord care practised", 5, 1, 0],
            ["Newborn danger signs taught to the mother before discharge", 3, 3, 0],
            ["Referral slip available and used", 6, 0, 0],
            ["Tracer medicines available in the facility store", 3, 2, 1],
            ["Register up to date and no identifiers left in the tally", 6, 0, 0]]),
     ("h", "Actions agreed"),
     ("p", "The two health centres are to introduce the partograph for every delivery from December. The four health posts that do not "
           "teach newborn danger signs before discharge will have the session at the December supervision round. The one facility with no "
           "misoprostol in store has an order raised with the woreda store.")])

# --- referral transport log
pdf(f"{OUT}/nov-referral-transport-log.pdf",
    "Community referral transport log, 15-30 November 2026 (project-supported transport)",
    [("p", "The Action started the community referral transport scheme on 15 November 2026. The scheme covers the stretch from the "
           "three kebeles with no all-weather road to the health centre, and uses one ambulance with a driver and two volunteer stretcher teams."),
     ("h", "Log of completed referrals"),
     ("t", [["Date", "From", "To", "Reason", "Transport", "Outcome"],
            ["18 Nov", "HP 3, Basha", "Basha HC", "Prolonged second stage of labour", "Ambulance", "Delivered, live baby"],
            ["21 Nov", "HP 7, Kecha", "Kecha HC", "Suspected haemorrhage", "Ambulance", "Delivered, mother stabilised"],
            ["24 Nov", "HP 2, Basha", "Basha HC", "Premature labour at 34 weeks", "Stretcher team", "Delivered, mother and baby referred on for care"],
            ["26 Nov", "HP 9, Kecha", "Kecha HC", "Obstructed labour", "Ambulance", "Delivered by caesarean section"],
            ["28 Nov", "HP 4, Basha", "Basha HC", "Eclampsia", "Ambulance", "Delivered, mother stabilised"],
            ["30 Nov", "HP 5, Kecha", "Basha HC", "Post-partum haemorrhage", "Ambulance", "Mother stabilised and transferred"]]),
     ("p", "Six emergency obstetric and newborn referrals were completed with project-supported transport in November. "
           "The average time from the decision to refer to arrival at the health centre was two hours and twenty minutes. "
           "Two of the six journeys were over a road that the ambulance could not use, so the stretcher teams carried the mother "
           "for the last kilometre.")])

# --- community education register
pdf(f"{OUT}/nov-community-education-register.pdf",
    "Community education sessions on maternal and newborn health — register, 16-18 November 2026",
    [("p", "Facilitators: Aster Girma (Field Officer) and two Women's Development Army team leaders. "
           "Sessions ran in 12 of the 18 kebeles during 16 to 18 November 2026, at the times the women's groups asked for "
           "(after market prayers and in the afternoon). Topics: antenatal care and its timing, facility delivery, the danger "
           "signs in pregnancy and after birth, the referral slip, and the maternity waiting home."),
     ("h", "Register"),
     ("t", [["Kebele", "Date", "Session", "People reached", "Women", "Men"],
            ["Basha 1", "16 Nov", "Evening", 74, 44, 30],
            ["Basha 2", "16 Nov", "Afternoon", 61, 36, 25],
            ["Basha 3", "16 Nov", "Evening", 58, 35, 23],
            ["Basha 4", "17 Nov", "Afternoon", 55, 33, 22],
            ["Basha 5", "17 Nov", "Evening", 49, 29, 20],
            ["Basha 6", "17 Nov", "Afternoon", 52, 31, 21],
            ["Kecha 1", "18 Nov", "Afternoon", 63, 37, 26],
            ["Kecha 2", "18 Nov", "Evening", 58, 34, 24],
            ["Kecha 3", "18 Nov", "Afternoon", 47, 28, 19],
            ["Kecha 4", "18 Nov", "Evening", 44, 26, 18],
            ["Kecha 5", "18 Nov", "Afternoon", 39, 23, 16],
            ["Total", "", "24 sessions", 640, 377, 263]]),
     ("p", "640 people were reached in 24 sessions, of whom 377 were women and 263 were men. Six kebeles were not covered in "
           "November because the road to them was closed for four days after the first rains; they are scheduled for December. "
           "Each session repeated the three newborn danger signs that the baseline survey found the community knows least well.")])

# --- outreach tally
pdf(f"{OUT}/nov-outreach-tally-kebeles-1-4.pdf",
    "Integrated outreach clinic tally sheet, kebeles 1 to 4, 9-12 November 2026",
    [("p", "A mobile team of one midwife, one nurse and two health extension workers ran an integrated outreach clinic in four "
           "remote kebeles on 9, 10, 11 and 12 November 2026. Each clinic offered antenatal care, postnatal check for newborns "
           "under two weeks old, and childhood immunisation."),
     ("h", "Tally"),
     ("t", [["Kebele", "Date", "Women attending ANC", "Newborns checked within 48 hours", "Children immunised"],
            ["Kebele 1", "9 Nov", 84, 21, 63],
            ["Kebele 2", "10 Nov", 76, 18, 58],
            ["Kebele 3", "11 Nov", 69, 15, 51],
            ["Kebele 4", "12 Nov", 61, 12, 44],
            ["Total", "", 290, 66, 216]]),
     ("p", "290 women attended antenatal care at the four outreach clinics, 66 newborns were checked within 48 hours of birth and "
           "216 children were immunised. Thirty-one women were referred to the health centre for a first antenatal visit before "
           "the fourth month of pregnancy; seven of them were accompanied by the health extension worker the same day.")])

# --- woreda data review minutes
pdf(f"{OUT}/nov-woreda-mnch-review-minutes.pdf",
    "Woreda MNCH data review and action meeting — minutes, 27 November 2026 (Basha) and 29 November 2026 (Kecha)",
    [("p", "Present: the woreda health office of Basha (health management team, 11 people) and of Kecha (11 people), "
           "the Action's M&E Officer and the Health Advisor. Two meetings were held, one in each woreda, in the last week of "
           "November 2026, to review the October and November registers and to agree actions for December."),
     ("h", "Basha woreda, 27 November 2026"),
     ("t", [["Indicator", "Baseline", "November value", "Comment"],
            ["Deliveries attended by a skilled birth attendant", "46%", "47%", "Little change; two health posts had no midwife in the week of 9 November"],
            ["Newborns with a postnatal check within 48 hours", "28%", "30%", "Better, but the discharge round at Kecha was cancelled once"],
            ["Pregnant women with four or more ANC visits", "37%", "38%", "The outreach clinics in kebeles 1 to 4 are the main source of new bookings"],
            ["Children under one year receiving Penta3", "62%", "63%", "Two health posts have no vaccine carrier; the solar fridges arrive in December"],
            ["Tracer medicine stock-out days", "4 days", "2.5 days", "Oxytocin was out of stock at one health post for five days"]]),
     ("h", "Kecha woreda, 29 November 2026"),
     ("t", [["Indicator", "Baseline", "November value", "Comment"],
            ["Deliveries attended by a skilled birth attendant", "46%", "47%", "The maternity waiting home opens in December and should raise this"],
            ["Newborns with a postnatal check within 48 hours", "28%", "30%", "Community health workers do not yet carry a newborn check card"],
            ["Pregnant women with four or more ANC visits", "37%", "38%", "Pregnancy mapping in December will raise the number of known pregnancies"],
            ["Children under one year receiving Penta3", "62%", "63%", "Kecha catches up in December once the outreach rounds are regular"],
            ["Tracer medicine stock-out days", "4 days", "2.5 days", "Amoxicillin is the tracer medicine most often missing"]]),
     ("h", "Actions for December"),
     ("p", "1. Deliver the newborn check card to every health extension worker in Kecha before the December outreach round. "
           "2. Move the second tracer medicine order to the first week of the month to protect the buffer stock. "
           "3. Report the two health posts without a vaccine carrier to the woreda logistics officer by 3 December. "
           "4. The team agreed that the maternal death review minutes are held by the Action and are not circulated in the monthly report.")])

print("done")
