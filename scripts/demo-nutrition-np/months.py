"""Demo 14 months 1-6 (Nov 2026 - Apr 2027): indicator values, activity records and evidence files. Usage: python3 months.py <outdir>"""
import sys, os, csv, json, random
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas
random.seed(1414)
OUT = os.path.abspath(sys.argv[1]); os.makedirs(OUT, exist_ok=True)
FN = ["Sita","Gita","Maya","Laxmi","Sarita","Kamala","Purnima","Dhan","Bhim","Pasang","Nima","Rita","Sunita","Anju","Mina","Tika","Dev","Hari","Kiran","Bina"]
LN = ["Rawat","Shahi","Bohora","Budha","Thapa","Rokaya","Bishwakarma","Oli","Sunar","Kunwar","Malla","Khadka","Bista","Chand"]
MONTHS = ["2026-11","2026-12","2027-01","2027-02","2027-03","2027-04"]
LABEL = dict(zip(MONTHS, ["November 2026","December 2026","January 2027","February 2027","March 2027","April 2027"]))
V = {
 "OP1-1a":[4500,6200,6800,6500,6900,5100], "OP1-1b":[210,300,330,340,320,300], "OP1-1c":[320,520,560,540,580,480],
 "OP1-1d":[180,250,170,0,0,0], "OP1-2a":[14,14,8,4,0,0], "OP1-2b":[60,80,60,40,0,0], "OP1-2c":[320,450,430,420,420,360], "OP1-2d":[92,94,96,95,97,98],
 "OC1a":[72,76,78,80,82,83], "OC1b":[16,14,12,11,9,8], "OC1c":[1.4,1.2,1.0,0.9,0.8,0.7],
 "OP2-1a":[2200,3100,3300,3200,3300,2900], "OP2-1b":[30,40,35,25,15,5], "OP2-1c":[90,150,170,180,180,130], "OP2-1d":[700,1200,1400,1400,1400,1100],
 "OP2-2a":[1000,1500,1800,1800,1700,1200], "OP2-2b":[800,1200,1300,1300,1300,1100],
 "OP3-1a":[4,5,5,5,6,5], "OP3-1b":[15,25,28,30,30,22], "OP3-2a":[10,20,22,22,26,20], "OP3-2b":[900,2000,2200,2300,2400,2200],
}
RATES = {"OP1-2d","OC1a","OC1b","OC1c"}
SRC = {"OP1-1a":"MUAC screening registers","OP1-1b":"OTP admission registers","OP1-1c":"MAM registers","OP1-1d":"FCHV training sheets","OP1-2a":"Site assessment checklist","OP1-2b":"IMAM training sheets","OP1-2c":"RUTF delivery notes","OP1-2d":"Stock reports","OC1a":"OTP monthly cohort report","OC1b":"OTP monthly cohort report","OC1c":"OTP monthly cohort report","OP2-1a":"IYCF counselling registers","OP2-1b":"Mother group records","OP2-1c":"Session reports","OP2-1d":"Demonstration attendance sheets","OP2-2a":"MNP distribution registers","OP2-2b":"ANC registers","OP3-1a":"Committee minutes","OP3-1b":"Supervision reports","OP3-2a":"Broadcast logs","OP3-2b":"Community dialogue attendance sheets"}
QUARTERLY = {"2027-01":{"GI-1":"8.6","OC2a":"59","OC2b":"47","OC2c":"61","OC3a":"55"}, "2027-04":{"GI-1":"7.4","OC2a":"63","OC2b":"53","OC2c":"68","OC3a":"78"}}
def pdf(path, title, lines):
    c = canvas.Canvas(path, pagesize=A4); w, h = A4; y = h - 60
    c.setFont("Helvetica-Bold", 14); c.drawString(50, y, title[:80]); y -= 28; c.setFont("Helvetica", 10)
    for ln in lines + ["", "DEMO DOCUMENT - synthetic, fictional organisations and people (Demo 14)."]:
        c.drawString(50, y, ln[:105]); y -= 15
    c.save(); return path
def roll(path, n, fem, loc, cols=("No","Name","Sex","Ward","Signature")):
    with open(path, "w", newline="") as f:
        w = csv.writer(f); w.writerow(cols)
        for i in range(min(n, 300)): w.writerow([i+1, f"{random.choice(FN)} {random.choice(LN)}", "F" if i < fem*min(n,300)//max(n,1) else "M", loc, "signed"])
    return path
cum = {}
for mi, m in enumerate(MONTHS):
    d = os.path.join(OUT, m); os.makedirs(d, exist_ok=True)
    val = {k: V[k][mi] for k in V}
    for k in V:
        if k not in RATES: cum[k] = cum.get(k, 0) + val[k]
    L = LABEL[m]; day = lambda n: f"{m}-{n:02d}"; p = lambda n: os.path.join(d, n)
    recs = []
    def rec(node, title, date, loc, total, fem, summ, ach, evs):
        recs.append(dict(node=node, title=title, date=date, loc=loc, total=total, female=fem, male=total-fem, summary=summ, achievements=ach,
            challenges="Seasonal weather and long walking distances slowed some sessions; managed with rescheduling.", lessons="FCHV home visits recover children who miss facility days.", next="Continue as planned next month.", ev=evs))
    def hasv(k): return val[k] > 0
    if hasv("OP1-1d"):
        rec("A1.1.1","FCHV MUAC training - "+L, day(12),"Jumla",val["OP1-1d"],int(val["OP1-1d"]*0.97),f"Female community health volunteers were trained on MUAC screening, oedema checks and referral in {L}.",f"{val['OP1-1d']} FCHVs trained (cumulative {cum['OP1-1d']}).",
            [(roll(p("fchv.csv"),val["OP1-1d"],int(val["OP1-1d"]*0.97),"Jumla/Kalikot/Mugu",("No","FCHV","Sex","Ward","Signature")),"Attendance sheet","OP1-1d")])
    rec("A1.1.2","Community MUAC screening campaigns - "+L, day(22),"Kalikot",val["OP1-1a"],val["OP1-1a"]//2,f"Volunteers screened children 6-59 months by MUAC and checked for oedema in all five districts in {L}.",f"{val['OP1-1a']} children screened; {val['OP1-1c']} with MAM enrolled.",
        [(roll(p("muac.csv"),val["OP1-1a"],val["OP1-1a"]//2,"Jumla/Kalikot/Mugu/Humla/Bajura",("No","Child","Sex","Ward","MUAC mm")),"Field visit report","OP1-1a"),
         (roll(p("mam.csv"),val["OP1-1c"],val["OP1-1c"]//2,"Five districts",("No","Child","Sex","Ward","Enrolled")),"Beneficiary list","OP1-1c")])
    rec("A1.2.1","OTP sites and SAM treatment - "+L, day(26),"Jumla",val["OP1-1b"],val["OP1-1b"]//2,f"OTP sites admitted and treated children with SAM; complicated cases were referred to the stabilisation centre in {L}.",f"{val['OP1-1b']} SAM admissions; cure {val['OC1a']}%, default {val['OC1b']}%, death {val['OC1c']}% in the cohort; {cum['OP1-2a']} OTP sites active.",
        [(pdf(p("otp.pdf"),f"OTP monthly cohort report - {L}",[f"SAM admissions: {val['OP1-1b']}.",f"Cure rate: {val['OC1a']}%. Default rate: {val['OC1b']}%. Death rate: {val['OC1c']}%.","Prepared by: Dil Bahadur Rawat, Field officer"]),"Monitoring report","OC1a"),
         (roll(p("otp_adm.csv"),val["OP1-1b"],val["OP1-1b"]//2,"OTP sites",("No","Child","Sex","Site","Admission")),"Beneficiary list","OP1-1b")]
        + ([(pdf(p("sites.pdf"),f"OTP site assessment - {L}",[f"New sites functioning: {val['OP1-2a']}.","Prepared by: Bikash Gurung, M&E officer"]),"Approval document","OP1-2a")] if hasv("OP1-2a") else []))
    rec("A1.2.2","IMAM training and supportive supervision - "+L, day(24),"Humla",max(val["OP1-2b"],val["OP3-1b"]),int(max(val["OP1-2b"],val["OP3-1b"])*0.45),f"Health workers were trained in the national IMAM guideline and OTP sites were supervised in {L}.",f"{val['OP1-2b']} health workers trained; {val['OP3-1b']} supervision visits.",
        ([(roll(p("imam.csv"),val["OP1-2b"],val["OP1-2b"]//2,"Kalikot",("No","Health worker","Sex","Facility","Signature")),"Attendance sheet","OP1-2b")] if hasv("OP1-2b") else [])
        + [(pdf(p("supervision.pdf"),f"Supportive supervision summary - {L}",[f"Visits: {val['OP3-1b']}.","Prepared by: Bikash Gurung, M&E officer"]),"Monitoring report","OP3-1b")])
    rec("A1.2.3","RUTF and supplies delivery - "+L, day(20),"Jumla",val["OP1-2c"]//10,val["OP1-2c"]//30,f"RUTF and essential supplies were delivered to treatment sites in {L}.",f"{val['OP1-2c']} cartons delivered; {val['OP1-2d']}% of sites reported no stock-out.",
        [(pdf(p("rutf.pdf"),f"RUTF delivery notes - {L}",[f"Cartons delivered: {val['OP1-2c']}.",f"Sites with no stock-out: {val['OP1-2d']}%.","Prepared by: Anita Shrestha, Grants officer"]),"Financial document","OP1-2c"),
         (pdf(p("stock.pdf"),f"Site stock report - {L}",[f"Sites with no stock-out: {val['OP1-2d']}%."]),"Monitoring report","OP1-2d")])
    rec("A2.1.1","IYCF counselling at facilities and homes - "+L, day(25),"Bajura",val["OP2-1a"],int(val["OP2-1a"]*0.97),f"Counsellors gave individual IYCF counselling to pregnant and breastfeeding women and caregivers in {L}.",f"{val['OP2-1a']} people counselled (cumulative {cum['OP2-1a']}).",
        [(roll(p("iycf.csv"),val["OP2-1a"],int(val["OP2-1a"]*0.97),"Five districts",("No","Caregiver","Sex","Ward","Counselled")),"Beneficiary list","OP2-1a")])
    rec("A2.1.2","Mother groups and cooking demonstrations - "+L, day(23),"Kalikot",val["OP2-1d"],int(val["OP2-1d"]*0.97),f"Mother support groups met and complementary feeding cooking demonstrations were held in {L}.",f"{val['OP2-1c']} demonstrations with {val['OP2-1d']} caregivers; {val['OP2-1b']} new mother groups.",
        [(roll(p("demos.csv"),val["OP2-1d"],int(val["OP2-1d"]*0.97),"Kalikot",("No","Caregiver","Sex","Ward","Signature")),"Attendance sheet","OP2-1d"),
         (pdf(p("groups.pdf"),f"Mother support groups - {L}",[f"New groups formed: {val['OP2-1b']}.",f"Demonstration sessions: {val['OP2-1c']}."]),"Training record","OP2-1b")])
    rec("A2.2.1","MNP and iron-folic acid distribution - "+L, day(21),"Mugu",val["OP2-2a"],val["OP2-2a"]//2,f"Micronutrient powder was distributed to children 6-23 months and iron-folic acid to pregnant women in {L}.",f"{val['OP2-2a']} children received MNP; {val['OP2-2b']} women received iron-folic acid.",
        [(roll(p("mnp.csv"),val["OP2-2a"],val["OP2-2a"]//2,"Mugu/Humla",("No","Child","Sex","Ward","MNP sachets")),"Distribution list","OP2-2a"),
         (roll(p("ifa.csv"),val["OP2-2b"],val["OP2-2b"],"Five districts",("No","Woman","Sex","Ward","IFA tablets")),"Distribution list","OP2-2b")])
    rec("A3.1.1","Municipal nutrition committee meetings - "+L, day(27),"Jumla",25,10,f"Municipal nutrition coordination committees met and reviewed monthly data in {L}.",f"{val['OP3-1a']} committee meetings supported.",
        [(pdf(p("committee.pdf"),f"Committee meeting minutes - {L}",[f"Meetings: {val['OP3-1a']}.","Participants: municipal officials, health staff, KNCHA."]),"Meeting minutes","OP3-1a")])
    rec("A3.2.1","Radio programmes and community dialogues - "+L, day(26),"Humla",val["OP3-2b"],int(val["OP3-2b"]*0.6),f"Nutrition radio programmes were broadcast and community dialogues held in {L}.",f"{val['OP3-2a']} broadcasts; {val['OP3-2b']} people reached through dialogues and school messaging.",
        [(pdf(p("radio.pdf"),f"Broadcast log - {L}",[f"Broadcasts: {val['OP3-2a']}."]),"Monitoring report","OP3-2a"),
         (roll(p("dialogue.csv"),val["OP3-2b"],int(val["OP3-2b"]*0.6),"Humla/Bajura",("No","Participant","Sex","Ward","Signature")),"Attendance sheet","OP3-2b")])
    values = {}
    for k in V:
        if k == "OP1-1d" and val[k] == 0 and cum.get(k,0)>=600: continue
        values[k] = {"period": str(val[k]) if k not in RATES else str(val[k]), "cum": ("" if k in RATES else str(cum[k])), "src": SRC[k]+", "+L}
    for k, v in QUARTERLY.get(m, {}).items(): values[k] = {"period": v, "cum": "", "src": "Survey / supervision checklist, "+L}
    json.dump({"month": m, "label": L, "records": recs, "values": values}, open(os.path.join(d, "month.json"), "w"), indent=1)
print("ok", OUT, {k:cum[k] for k in ("OP1-1a","OP1-1b","OP2-1a")})
