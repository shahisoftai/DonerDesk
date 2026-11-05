"""Month-1 (Nov 2026) completed-activity plan + synthetic evidence files. Usage: python3 gen_evidence.py <outdir>. All names fictional."""
import sys, os, csv, json, random
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas
random.seed(13)
OUT = os.path.abspath(sys.argv[1]); os.makedirs(OUT, exist_ok=True)
FN = ["Fatima","Aisha","Ibrahim","Musa","Hauwa","Kaka","Abba","Zara","Bukar","Modu","Maryam","Adamu","Falmata","Yagana","Lawan","Hadiza","Babagana","Amina","Kyari","Mairo"]
LN = ["Bukar","Modu","Kyari","Gana","Mustapha","Lawan","Bello","Abdullahi","Zannah","Shettima","Umar","Ali","Tijani","Garba"]
def pdf(name, title, lines):
    p = os.path.join(OUT, name); c = canvas.Canvas(p, pagesize=A4); w, h = A4; y = h - 60
    c.setFont("Helvetica-Bold", 14); c.drawString(50, y, title[:80]); y -= 28; c.setFont("Helvetica", 10)
    for ln in lines + ["", "DEMO DOCUMENT - synthetic, fictional organisations and people (Demo 13)."]:
        c.drawString(50, y, ln[:105]); y -= 15
    c.save(); return p
def roll(name, n, fem, loc, cols=("No","Name","Sex","Community","Signature")):
    p = os.path.join(OUT, name)
    with open(p, "w", newline="") as f:
        w = csv.writer(f); w.writerow(cols)
        for i in range(n): w.writerow([i+1, f"{random.choice(FN)} {random.choice(LN)}", "F" if i < fem else "M", loc, "signed"])
    return p
# activity records: node, title, date, location, total, male, female, summary, achievements, challenges, lessons, next, evidence[(file, type, indicator)]
A = []
def add(node, title, date, loc, total, fem, summ, ach, chal, les, nxt, ev): A.append(dict(node=node, title=title, date=date, loc=loc, total=total, female=fem, male=total-fem, summary=summ, achievements=ach, challenges=chal, lessons=les, next=nxt, ev=ev))
add("A1.1.1","Community targeting, registration and verification of households","2026-11-27","Maiduguri",2200,1320,
 "Community committees and BRRI field teams registered and verified vulnerable households in Maiduguri, Bama, Monguno, Mubi and Potiskum using the agreed vulnerability criteria.",
 "2,200 households registered and verified (60% female-headed), against a monthly plan of 2,000.","Verification visits in Bama were delayed two days by a road closure.","Community committees reduced inclusion errors when they reviewed lists in public.","Complete Mubi and Potiskum verification in December.",
 [(roll("ev01-registration-database-export.csv",2200,1320,"North-east LGAs",("No","Head of household","Sex","LGA","Verified")),"Beneficiary list","OP1-1a")])
dist = roll("ev02-distribution-list-nov.csv",1640,980,"Maiduguri/Bama/Monguno",("No","Beneficiary","Sex","Site","Signature"))
pay = pdf("ev03-mobile-money-payment-report-nov.pdf","Mobile money payment report - November 2026 cycle",["Provider: (fictional) NorthPay.","Households paid: 1,640","Total value transferred: USD 62,300 (average USD 38 per household).","Failed transactions re-processed: 31","Prepared by: Fatima Musa, Grants officer"])
add("A1.1.2","Monthly cash and food distribution - Maiduguri","2026-11-20","Maiduguri",720,430,"November cash transfer cycle in Maiduguri through mobile money agents and a food fair.","720 households received the November transfer.","Network outages at two agent points; queues managed by staggering time slots.","Pre-notifying households by SMS cut waiting time.","Repeat in December.",[(dist,"Distribution list","OP1-1b"),(pay,"Financial document","OP1-1c")])
add("A1.1.2","Monthly cash and food distribution - Bama","2026-11-21","Bama",540,320,"November transfer cycle in Bama.","540 households received the November transfer.","Escort required for the last 12 km; distribution shortened to one day.","Joint security briefing before each cycle is essential.","Repeat in December.",[])
add("A1.1.2","Monthly cash and food distribution - Monguno","2026-11-22","Monguno",380,230,"November transfer cycle in Monguno.","380 households received the November transfer.","Agent float shortfall delayed 40 households by one day.","Agree float limits with the agent in advance.","Repeat in December.",[])
pdm = pdf("ev04-post-distribution-monitoring-nov.pdf","Post-distribution monitoring - November 2026",["Respondents: 214 (randomly selected, 3 LGAs).","Satisfied or very satisfied with assistance: 82% (175 of 214).","Safety concerns reported: 4%.","Complaints received: 19, all resolved within 5 days.","Prepared by: Emeka Okafor, M&E officer"])
add("A1.1.3","Post-distribution monitoring - November cycle","2026-11-27","Maiduguri",214,121,"Phone and face-to-face PDM survey of 214 respondents across three LGAs after the November transfer.","82% of respondents were satisfied with the assistance.","Phone reach lower for female respondents; follow-up visits added.","Mix phone and in-person interviews.","Repeat in December.",[(pdm,"Monitoring report","OP1-1d")])
muac = roll("ev05-muac-screening-register-nov.csv",1480,760,"Monguno/Bama/Mubi/Potiskum",("No","Child","Sex","Site","MUAC result"))
ref = pdf("ev06-referral-slips-summary-nov.pdf","Referral slips summary - November 2026",["Children referred to stabilisation centres or OTP sites: 96","Severe acute malnutrition: 31; moderate acute malnutrition: 65.","Referral follow-up completed for 71 children (74%).","Prepared by: Ibrahim Yusuf, Field officer"])
add("A1.2.1","Community MUAC screening - Monguno and Bama","2026-11-26","Monguno",890,455,"Community volunteers screened children 6-59 months at community sites and referred malnourished children.","890 children screened; 58 referred.","Stock-out of MUAC tapes in one site, resolved in three days.","Buddy volunteers speed up screening.","Continue monthly.",[(muac,"Field visit report","OP1-2a")])
add("A1.2.1","Community MUAC screening - Mubi and Potiskum","2026-11-26","Potiskum",590,305,"Community volunteers screened children 6-59 months in Mubi and Potiskum.","590 children screened; 38 referred.","Low turnout on market day; sessions moved.","Avoid market days.","Continue monthly.",[(ref,"Field visit report","OP1-2b")])
add("A1.2.2","Nutrition education and cooking demonstrations - Potiskum","2026-11-24","Potiskum",640,598,"Nutrition education and cooking demonstration sessions for caregivers.","640 caregivers attended (93% female).","Few male caregivers attended.","Hold evening sessions to reach fathers.","Add male-focused sessions in December.",[(roll("ev07-nutrition-session-attendance.csv",640,598,"Potiskum"),"Attendance sheet","OP1-2c")])
add("A2.1.1","Seed and tool kit distribution - Mubi","2026-11-18","Mubi",520,210,"Dry-season vegetable seed kits and tools distributed to farming households in Mubi.","520 farmers received kits.","Late arrival of tools from Maiduguri by one day.","Pre-position stock at the Mubi store.","Second round in December.",[(roll("ev08-seed-kit-distribution-list.csv",520,210,"Mubi"),"Distribution list","OP2-1a")])
add("A2.1.2","Farmer field school sessions - Mubi","2026-11-20","Mubi",380,150,"Climate-smart agriculture field school sessions on irrigated dry-season farming.","380 farmers trained.","Irrigation pump shortage at one plot.","Share pumps by rota.","Monthly sessions continue.",[(roll("ev09-ffs-register.csv",380,150,"Mubi"),"Attendance sheet","OP2-1b")])
add("A2.2.1","Village savings and loan associations - formation and training","2026-11-25","Potiskum",322,258,"14 VSLA groups formed and trained in savings, loans and record keeping.","14 groups formed with 322 members.","Literacy limits among members; picture-based passbooks used.","Picture passbooks work.","Form 18 more groups in December.",[(pdf("ev10-vsla-formation-records.pdf","VSLA formation records - Potiskum, November 2026",["Groups formed: 14","Members: 322 (258 women, 64 men)","Share price: NGN 500; first meetings held 19-25 Nov.","Prepared by: Ibrahim Yusuf, Field officer"]),"Training record","OP2-2a")])
add("A3.1.1","Cash-for-work - farm road and irrigation channel rehabilitation, Bama","2026-11-27","Bama",415,166,"Cash-for-work teams rehabilitated farm access roads and irrigation channels in Bama.","4,150 person-days created; 3 community assets rehabilitated.","Rain delayed work by two days.","Start earlier in the day.","Continue in December.",
 [(roll("ev11-cfw-attendance.csv",415,166,"Bama"),"Attendance sheet","OP3-1a"),(pdf("ev12-asset-completion-certificates.pdf","Community asset completion certificates - Bama",["Asset 1: Farm road segment A (2.1 km) - completed 24 Nov 2026","Asset 2: Irrigation channel B - completed 25 Nov 2026","Asset 3: Farm road segment C (1.4 km) - completed 27 Nov 2026","Signed by: community committee chair and BRRI engineer (fictional)."]),"Approval document","OP3-1b")])
json.dump(A, open(os.path.join(OUT, "month1.json"), "w"), indent=1)
print(len(A), "activity records;", len(os.listdir(OUT)), "files")
