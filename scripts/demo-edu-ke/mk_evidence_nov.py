"""Demo 13 - November 2026 evidence files (synthetic; the month's figures from the demo-13 data plan).
Writes to /tmp/kilo/dd13/evidence-nov."""
import os
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib import colors
from PIL import Image, ImageDraw

OUT = os.environ.get("OUT", "/tmp/kilo/dd13/evidence-nov")
os.makedirs(OUT, exist_ok=True)
ss = getSampleStyleSheet()
H1 = ParagraphStyle("h1", parent=ss["Heading1"], fontSize=15, spaceAfter=8)
B = ss["BodyText"]
SM = ParagraphStyle("sm", parent=B, fontSize=9.5, leading=13)
LOC = ["Dessie", "Kombolcha", "Bati", "Kemissie", "Mille", "Awash"]
PCA = "PCA/ETCO/2026/0773"

def pdf(name, title, intro, table=None, extra=None):
    S = [Paragraph(title, H1), Paragraph(f"RWSH-ET ({PCA}) - synthetic demo record, November 2026. " + intro, B), Spacer(1, 8)]
    if table:
        t = Table([[Paragraph(str(c), SM) for c in r] for r in table], repeatRows=1)
        t.setStyle(TableStyle([("GRID", (0, 0), (-1, -1), 0.4, colors.grey), ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#e8eef7"))]))
        S += [t, Spacer(1, 8)]
    for p in extra or []:
        S.append(Paragraph(p, B))
    SimpleDocTemplate(f"{OUT}/{name}", pagesize=A4, title=title).build(S)

def png(name, caption):
    img = Image.new("RGB", (900, 560), "#eef3ee")
    d = ImageDraw.Draw(img)
    d.rectangle([20, 20, 880, 80], fill="#1f6f43")
    d.text((35, 38), "RWSH-ET (PCA/ETCO/2026/0773) - synthetic demo photo, November 2026", fill="white")
    d.rectangle([60, 140, 520, 470], outline="#444", width=3)
    d.ellipse([620, 180, 820, 380], outline="#2b6cb0", width=4)
    d.text((80, 500), caption, fill="#222")
    img.save(f"{OUT}/{name}")

pdf("nov-baseline-survey-tables.pdf", "Baseline household WASH survey - summary tables",
    "Household survey in the six woredas, 2,450 households, 24 enumerators, fieldwork 5-14 November.",
    [["Indicator", "Baseline", "Note"],
     ["Diarrhoea prevalence in children under five (GI-1)", "31 %", "Two-week recall, n = 2,450 households"],
     ["Households using an improved drinking water source (OC1a)", "42 %", "n = 2,450"],
     ["Households with a functional, unshared latrine (OC1b)", "28 %", "n = 2,450"],
     ["Households with a handwashing facility with soap and water (OC2a)", "22 %", "n = 2,450"]])
pdf("nov-enumerator-training-attendance.pdf", "Enumerator training attendance",
    "Training of 24 enumerators, Dessie, 2-4 November.",
    [["Woreda of origin", "Enumerators"]] + [[l, str(n)] for l, n in zip(LOC, [4, 4, 4, 4, 4, 4])] + [["Total", "24"]])
pdf("nov-borehole-drilling-log-dessie.pdf", "Borehole drilling and construction log - Dessie scheme",
    "Drilling of the new solar-pumped borehole at Dessie (Gendegasite kebele), 4-27 November. Depth 82 m, yield 12 l/s, solar pump installed; population served estimated 1,250 people. A second scheme at Mille began siting on 20 November.",
    [["Woreda", "Water points", "People served (estimate)"],
     ["Dessie", "1", "1,250"], ["Kombolcha", "0", "0"], ["Bati", "0", "0"], ["Kemissie", "0", "0"], ["Mille", "0", "0"], ["Awash", "0", "0"], ["Total", "1", "1,250"]])
pdf("nov-water-point-rehab-handover.pdf", "Water point rehabilitation - completion and handover",
    "Rehabilitation of two broken water points completed and handed over: Kombolcha (hand pump, 21 November, 560 people) and Mille (spring cap and pipe, 25 November, 790 people). Four more sites (Bati x2, Kemissie, Awash) are under contract.",
    [["Woreda", "Water points rehabilitated", "People served (estimate)"],
     ["Dessie", "0", "0"], ["Kombolcha", "1", "560"], ["Bati", "0", "0"], ["Kemissie", "0", "0"], ["Mille", "1", "790"], ["Awash", "0", "0"], ["Total", "2", "1,350"]])
pdf("nov-latrine-construction-register.pdf", "Household latrine construction register - November",
    "Latrines completed and inspected in November (gender-sensitive, lockable, with a handwashing station). Households are listed by code only.",
    [["Woreda", "Latrines completed"]] + [[l, str(n)] for l, n in zip(LOC, [20, 18, 12, 15, 18, 12])] + [["Total", "95"]])
pdf("nov-school-wash-block-completion.pdf", "School WASH block - completion certificate, Bati Primary School",
    "The first of eight WASH blocks was completed and handed over on 27 November: separate girls and boys blocks with a menstrual hygiene room. 640 pupils (348 girls) and 18 teachers served.",
    [["Woreda", "Blocks completed"], ["Bati", "1"], ["Other five woredas", "0"], ["Total", "1"]])
pdf("nov-water-quality-test-log.pdf", "Water quality test log - November round",
    "Monthly free chlorine residual and bacteriological testing at supported water points, 16-20 November. 48 tests at 16 water points (three per point). 62 % of water points passed the functionality spot check; two Dessie points failed bacteriological re-test and were re-chlorinated.",
    [["Woreda", "Tests", "Water points functional"], ["Dessie", "8", "yes"], ["Kombolcha", "8", "yes"], ["Bati", "8", "partly"], ["Kemissie", "8", "yes"], ["Mille", "8", "yes"], ["Awash", "8", "yes"], ["Total", "48", "62 % of 16 points functional"]])
pdf("nov-hwt-distribution-list.pdf", "Household water treatment distribution list - November",
    "Aqua tabs and clay-pot filter distribution to 380 households. Households are listed by code only.",
    [["Woreda", "Households supplied"]] + [[l, str(n)] for l, n in zip(LOC, [70, 60, 50, 60, 80, 60])] + [["Total", "380"]])
pdf("nov-hygiene-promotion-tally.pdf", "Hygiene promotion sessions - mobiliser tally, November",
    "Round 1 of hygiene promotion sessions, 9-20 November: 64 sessions, 3,400 participants (2,040 female, 1,360 male). Cholera-prevention messages included after the Awash alert.",
    [["Woreda", "Sessions", "Reached"]] + [[l, str(s), str(n)] for l, s, n in zip(LOC, [12, 11, 10, 10, 11, 10], [620, 580, 520, 560, 600, 520])] + [["Total", "64", "3,400"]])
pdf("nov-clts-triggering-report.pdf", "Community-led total sanitation - triggering report, Kemissie",
    "CLTS triggering in two kebeles of Kemissie (14-15 November, 340 households attending) and one kebele of Mille (19 November, 180 households). ODF verification is planned after the December follow-up.")
pdf("nov-wpc-training-attendance.pdf", "Water point committee training - attendance",
    "Four committees formed and trained (12 members each; at least half women), 18-19 November. Committees listed by water point code only.",
    [["Woreda", "Committees", "Members trained"], ["Dessie", "1", "12"], ["Kombolcha", "1", "12"], ["Mille", "1", "12"], ["Awash", "1", "12"], ["Total", "4", "48"]])
pdf("nov-woreda-coordination-minutes.pdf", "Woreda WASH coordination meeting - minutes",
    "Two meetings held in November (Dessie woreda water office, 24 November; zone-level review, 26 November) with the six woreda focal points. Decisions: weekly functionality reporting from December; latrine mason certification in December.")
pdf("nov-hygiene-kit-distribution.pdf", "Hygiene kit distribution list - newly displaced households",
    "250 kits (soap, jerrycans, buckets, sanitary cloths) distributed to newly displaced households in Dessie and Mille, 12-26 November. Households are listed by code only.",
    [["Woreda", "Kits distributed"], ["Dessie", "50"], ["Mille", "50"], ["Other four woredas", "150"], ["Total", "250"]])
pdf("nov-scheme-extension-workplan.pdf", "Kombolcha piped scheme extension - engineer workplan and progress",
    "Extension and chlorination of the Kombolcha piped scheme: design approved 17 November, trenching began 23 November. No people reached yet in November; first connections planned for December.")
png("nov-school-wash-block-photos.png", "Bati Primary School WASH block, handover day (no pupils photographed without consent)")
png("nov-unicef-visibility-photos.png", "UNICEF-branded drilling rig and visibility board at the Dessie site")
print("evidence files:", len(os.listdir(OUT)))
