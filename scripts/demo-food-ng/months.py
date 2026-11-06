"""Demo 13 months 2-6 (Dec 2026 - Apr 2027): per-month indicator values, activity records and evidence files. Usage: python3 months.py <outdir>"""
import sys, os, csv, json, random
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas
random.seed(1313)
OUT = os.path.abspath(sys.argv[1]); os.makedirs(OUT, exist_ok=True)
FN = ["Fatima","Aisha","Ibrahim","Musa","Hauwa","Kaka","Abba","Zara","Bukar","Modu","Maryam","Adamu","Falmata","Yagana","Lawan","Hadiza","Babagana","Amina","Kyari","Mairo"]
LN = ["Bukar","Modu","Kyari","Gana","Mustapha","Lawan","Bello","Abdullahi","Zannah","Shettima","Umar","Ali","Tijani","Garba"]
MONTHS = ["2026-12","2027-01","2027-02","2027-03","2027-04"]
LABEL = {"2026-12":"December 2026","2027-01":"January 2027","2027-02":"February 2027","2027-03":"March 2027","2027-04":"April 2027"}
# period value per indicator per month (Nov values were entered earlier); SUM indicators carry a running total
V = {
 "OP1-1a":[1800,1300,700,0,0], "OP1-1b":[2300,1500,560,0,0], "OP1-1c":[78000,84500,88000,62000,45000], "OP1-1d":[84,86,85,87,88],
 "OP1-2a":[1650,1700,1620,1500,1050], "OP1-2b":[128,131,120,118,107], "OP1-2c":[820,900,880,960,600],
 "OP2-1a":[760,840,520,360,0], "OP2-1b":[420,450,460,400,290], "OP2-2a":[22,26,24,20,14], "OP2-2b":[120,260,280,180,60],
 "OP3-1a":[6200,7400,7600,6800,3850], "OP3-1b":[4,5,5,4,3],
}
NOV = {"OP1-1a":2200,"OP1-1b":1640,"OP1-1c":62300,"OP1-2a":1480,"OP1-2b":96,"OP1-2c":640,"OP2-1a":520,"OP2-1b":380,"OP2-2a":14,"OP2-2b":0,"OP3-1a":4150,"OP3-1b":3}
SRC = {"OP1-1a":"Registration database export","OP1-1b":"Distribution lists","OP1-1c":"Mobile money payment report","OP1-1d":"Post-distribution monitoring survey","OP1-2a":"MUAC screening registers","OP1-2b":"Referral slips","OP1-2c":"Session attendance sheets","OP2-1a":"Seed distribution lists","OP2-1b":"Farmer field school registers","OP2-2a":"VSLA records","OP2-2b":"Grant payment lists","OP3-1a":"Cash-for-work attendance sheets","OP3-1b":"Completion certificates"}
QUARTERLY = {"2027-01":{"GI-1":47,"OC1a":46,"OC1b":22}, "2027-04":{"GI-1":61,"OC1a":58,"OC1b":41,"OC2a":52}}
FORUMS = {"2026-12":2,"2027-03":2}
def pdf(path, title, lines):
    c = canvas.Canvas(path, pagesize=A4); w, h = A4; y = h - 60
    c.setFont("Helvetica-Bold", 14); c.drawString(50, y, title[:80]); y -= 28; c.setFont("Helvetica", 10)
    for ln in lines + ["", "DEMO DOCUMENT - synthetic, fictional organisations and people (Demo 13)."]:
        c.drawString(50, y, ln[:105]); y -= 15
    c.save(); return path
def roll(path, n, fem, loc, cols=("No","Name","Sex","Community","Signature")):
    with open(path, "w", newline="") as f:
        w = csv.writer(f); w.writerow(cols)
        for i in range(min(n, 1500)): w.writerow([i+1, f"{random.choice(FN)} {random.choice(LN)}", "F" if i < fem*min(n,1500)//max(n,1) else "M", loc, "signed"])
    return path
cum = dict(NOV); plan = {}
for mi, m in enumerate(MONTHS):
    d = os.path.join(OUT, m); os.makedirs(d, exist_ok=True)
    val = {k: V[k][mi] for k in V}
    for k in V:
        if k != "OP1-1d": cum[k] = cum.get(k, 0) + val[k]
    L = LABEL[m]; day = lambda n: f"{m}-{n:02d}"
    recs = []
    def rec(node, title, date, loc, total, fem, summ, ach, ev):
        recs.append(dict(node=node, title=title, date=date, loc=loc, total=total, female=fem, male=total-fem, summary=summ, achievements=ach, challenges="Normal operating constraints; no major delays this month.", lessons="Continue the agreed approach.", next="Continue as planned next month.", ev=ev))
    def ev(code, kind, typ, name, f):
        return (f, typ, code)
    p = lambda n: os.path.join(d, n)
    rec("A1.1.1","Registration and verification of households - "+L, day(26),"Maiduguri",val["OP1-1a"] or 1,int((val["OP1-1a"] or 1)*0.6),
        f"Community committees and BRRI teams registered and verified households in {L}.", f"{val['OP1-1a']} households registered this month (cumulative {cum['OP1-1a']}).",
        [(roll(p("registration.csv"),val["OP1-1a"] or 1,int((val["OP1-1a"] or 1)*0.6),"North-east LGAs",("No","Head of household","Sex","LGA","Verified")),"Beneficiary list","OP1-1a")] if val["OP1-1a"] else [])
    rec("A1.1.2","Cash and food distribution - "+L, day(21),"Maiduguri",max(val["OP1-1b"],1),int(max(val["OP1-1b"],1)*0.6),
        f"Monthly cash transfer cycle for {L} through mobile money agents.", f"Transfers of USD {val['OP1-1c']:,} delivered; {val['OP1-1b']} households received their first transfer this month.",
        ([(roll(p("distribution.csv"),val["OP1-1b"],int(val["OP1-1b"]*0.6),"Maiduguri/Bama/Monguno",("No","Beneficiary","Sex","Site","Signature")),"Distribution list","OP1-1b")] if val["OP1-1b"] else [])
        + [(pdf(p("payments.pdf"),f"Mobile money payment report - {L}",[f"Total value transferred: USD {val['OP1-1c']:,}.","Provider: (fictional) NorthPay.","Prepared by: Fatima Musa, Grants officer"]),"Financial document","OP1-1c")])
    rec("A1.1.3","Post-distribution monitoring - "+L, day(27),"Maiduguri",200,110,
        f"PDM survey after the {L} transfer.", f"{val['OP1-1d']}% of respondents satisfied.",
        [(pdf(p("pdm.pdf"),f"Post-distribution monitoring - {L}",["Respondents: 200.",f"Satisfied or very satisfied: {val['OP1-1d']}%.","Prepared by: Emeka Okafor, M&E officer"]),"Monitoring report","OP1-1d")])
    rec("A1.2.1","Community MUAC screening and referral - "+L, day(25),"Monguno",val["OP1-2a"],val["OP1-2a"]//2,
        f"Community volunteers screened children 6-59 months in {L} and referred malnourished children.", f"{val['OP1-2a']} children screened; {val['OP1-2b']} referred.",
        [(roll(p("muac.csv"),val["OP1-2a"],val["OP1-2a"]//2,"Monguno/Bama/Mubi/Potiskum",("No","Child","Sex","Site","MUAC result")),"Field visit report","OP1-2a"),
         (pdf(p("referrals.pdf"),f"Referral slips summary - {L}",[f"Children referred: {val['OP1-2b']}.","Prepared by: Ibrahim Yusuf, Field officer"]),"Field visit report","OP1-2b")])
    rec("A1.2.2","Nutrition education and cooking demonstrations - "+L, day(23),"Potiskum",val["OP1-2c"],int(val["OP1-2c"]*0.92),
        f"Nutrition education sessions for caregivers in {L}.", f"{val['OP1-2c']} caregivers attended.",
        [(roll(p("nutrition.csv"),val["OP1-2c"],int(val["OP1-2c"]*0.92),"Potiskum"),"Attendance sheet","OP1-2c")])
    rec("A2.1.1","Seed kits and farmer field schools - "+L, day(19),"Mubi",max(val["OP2-1b"],1),int(max(val["OP2-1b"],1)*0.4),
        f"Dry-season seed and tool kits and farmer field school sessions in {L}.", f"{val['OP2-1a']} farmers received kits; {val['OP2-1b']} trained.",
        ([(roll(p("seeds.csv"),val["OP2-1a"],int(val["OP2-1a"]*0.4),"Mubi"),"Distribution list","OP2-1a")] if val["OP2-1a"] else [])
        + [(roll(p("ffs.csv"),val["OP2-1b"],int(val["OP2-1b"]*0.4),"Mubi"),"Attendance sheet","OP2-1b")])
    rec("A2.2.1","VSLA formation and livelihood grants - "+L, day(24),"Potiskum",max(val["OP2-2a"]*23,1),int(max(val["OP2-2a"]*23,1)*0.8),
        f"VSLA groups formed and trained and start-up grants paid in {L}.", f"{val['OP2-2a']} VSLA groups formed; {val['OP2-2b']} households received grants.",
        [(pdf(p("vsla.pdf"),f"VSLA formation records - {L}",[f"Groups formed: {val['OP2-2a']}.","Prepared by: Ibrahim Yusuf, Field officer"]),"Training record","OP2-2a")]
        + ([(pdf(p("grants.pdf"),f"Grant payment list - {L}",[f"Households paid: {val['OP2-2b']}.","Prepared by: Fatima Musa, Grants officer"]),"Financial document","OP2-2b")] if val["OP2-2b"] else []))
    rec("A3.1.1","Cash-for-work rehabilitation - "+L, day(27),"Bama",max(val["OP3-1a"]//10,1),int(max(val["OP3-1a"]//10,1)*0.4),
        f"Cash-for-work teams rehabilitated farm roads and irrigation channels in {L}.", f"{val['OP3-1a']} person-days created; {val['OP3-1b']} assets completed.",
        [(roll(p("cfw.csv"),max(val["OP3-1a"]//10,1),int(max(val["OP3-1a"]//10,1)*0.4),"Bama"),"Attendance sheet","OP3-1a"),
         (pdf(p("assets.pdf"),f"Asset completion certificates - {L}",[f"Assets completed: {val['OP3-1b']}.","Signed by community committee and BRRI engineer (fictional)."]),"Approval document","OP3-1b")])
    q = QUARTERLY.get(m, {}); forums = FORUMS.get(m)
    if forums:
        rec("A3.2.1","Market linkage forum - "+L, day(15),"Maiduguri",40,14,"Farmers, traders and local authorities met to agree market linkages.",f"{forums} forum sessions held.",
            [(pdf(p("forum.pdf"),f"Market linkage forum minutes - {L}",[f"Sessions held: {forums}.","Participants: 40 (14 women)."]),"Meeting minutes","OP3-2a")])
    values = {k: {"period": str(val[k]), "cum": ("" if k=="OP1-1d" else str(cum[k])), "src": SRC[k]+", "+L} for k in V}
    if forums: values["OP3-2a"] = {"period": str(forums), "cum": str(forums + (2 if m=="2027-03" else 0)), "src": "Forum minutes, "+L}
    for k, v in q.items(): values[k] = {"period": str(v), "cum": "", "src": "Household survey, "+L}
    json.dump({"month": m, "label": L, "records": recs, "values": values}, open(os.path.join(d, "month.json"), "w"), indent=1)
print("ok", OUT)
