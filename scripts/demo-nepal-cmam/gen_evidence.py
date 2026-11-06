import json, os, csv, random, sys
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas
from PIL import Image, ImageDraw, ImageFont
random.seed(9)
OUT = os.path.abspath("ev"); os.makedirs(OUT, exist_ok=True)
D = json.load(open("data.json"))
MN, IND = D["MN"], D["IND"]
FN = ["Sita","Gita","Maya","Laxmi","Kamala","Sarita","Binita","Radha","Parbati","Durga","Sunita","Anju","Ramesh","Hari","Bishnu","Dipak","Kiran","Suresh","Raju","Mohan"]
LN = ["Chaudhary","Tharu","Gurung","Thapa","Rana","Bista","Oli","Karki","Yadav","Sharma","Pun","Kumal"]
LOC = ["Nepalgunj","Kohalpur","Khajura","Rajapur","Gulariya","Thakurbaba"]
def val(code, m): return next(i for i in IND if i[0] == code)[11][m]
def photo(path, caption, color):
    im = Image.new("RGB", (900, 600), color); d = ImageDraw.Draw(im)
    for i in range(0, 600, 40): d.line([(0, i), (900, 600 - i)], fill=tuple(max(0, v - 25) for v in color), width=3)
    d.rectangle([0, 520, 900, 600], fill=(20, 30, 45)); f = ImageFont.load_default()
    d.text((20, 535), caption[:110], fill=(255, 255, 255), font=f); d.text((20, 556), "DEMO IMAGE - synthetic placeholder, not a real photograph. Himalayan Child Nutrition Fund", fill=(255, 210, 120), font=f)
    im.save(path)
man = []
for m in range(8):
    M, p = MN[m], f"{m+1:02d}"
    n = val("NP-OP1.1", m)
    f = os.path.join(OUT, f"{p}-A1.1-screening-register.csv")
    with open(f, "w", newline="") as fh:
        w = csv.writer(fh); w.writerow(["No","Child","Sex","Age (months)","MUAC (mm)","Status","Municipality","Volunteer"])
        for i in range(min(n, 60)):
            muac = random.choice([108,112,118,121,126,130,135,140,146]); st = "SAM" if muac < 115 else "MAM" if muac < 125 else "Normal"
            w.writerow([i+1, f"{random.choice(FN)} {random.choice(LN)}", "F" if random.random() < 0.52 else "M", random.randint(6, 59), muac, st, random.choice(LOC), random.choice(FN)])
    man.append(dict(m=m, node="A1.1", ind="NP-OP1.1", file=f, type="Kobo/ODK export", sens="Confidential", title=f"Screening register extract, {M}"))
    c = val("NP-OP2.3", m)
    f = os.path.join(OUT, f"{p}-A2.3-delivery-notes.csv")
    with open(f, "w", newline="") as fh:
        w = csv.writer(fh); w.writerow(["Delivery note","Site","Cartons delivered","Received by","Date"])
        rem = c; k = 0
        while rem > 0:
            q = min(rem, random.randint(20, 60)); rem -= q; k += 1
            w.writerow([f"DN-{p}{k:02d}", random.choice(LOC) + " health post", q, f"{random.choice(FN)} {random.choice(LN)}", f"2026-{m+1:02d}-{random.randint(8,26):02d}"])
    man.append(dict(m=m, node="A2.3", ind="NP-OP2.3", file=f, type="Distribution list", sens="Internal", title=f"Therapeutic food delivery notes, {M}"))
    t = val("NP-OP1.4", m)
    if t:
        f = os.path.join(OUT, f"{p}-A1.4-attendance.csv")
        with open(f, "w", newline="") as fh:
            w = csv.writer(fh); w.writerow(["No","Name","Sex","Role","Health post","Signature"])
            for i in range(t): w.writerow([i+1, f"{random.choice(FN)} {random.choice(LN)}", "F" if i < round(t*0.7) else "M", random.choice(["Health assistant","Auxiliary nurse","FCHV"]), random.choice(LOC), "signed"])
        man.append(dict(m=m, node="A1.4", ind="NP-OP1.4", file=f, type="Attendance sheet", sens="Internal", title=f"CMAM training attendance, {M}"))
    f = os.path.join(OUT, f"{p}-A2.1-session-photo.jpg")
    photo(f, f"Infant and young child feeding counselling session, {M}", random.choice([(70,120,90),(110,90,60),(60,100,140),(120,110,70)]))
    man.append(dict(m=m, node="A2.1", ind=None, file=f, type="Photo", sens="Internal", title=f"Counselling session photo, {M}"))
json.dump(man, open("evidence-manifest.json", "w"), indent=1)
print(len(man), "files")
