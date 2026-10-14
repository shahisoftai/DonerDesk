import json, os, csv, random
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas
from PIL import Image, ImageDraw, ImageFont
random.seed(8)
J = json.load(open("plan.json"))
OUT = os.path.abspath("ev"); os.makedirs(OUT, exist_ok=True)
FN = ["Fatima","Aisha","Ibrahim","Musa","Hauwa","Kaka","Abba","Zara","Bukar","Modu","Maryam","Adamu","Falmata","Yagana","Lawan","Hadiza","Babagana","Amina","Kyari","Mairo"]
LN = ["Bukar","Modu","Kyari","Gana","Mustapha","Lawan","Bello","Abdullahi","Zannah","Shettima","Umar","Ali"]
WARD = ["Dalori","Mashimari","Konduga","Mele","Mafa","Dikwa Ward 3"]
def pdf(path, title, lines):
    c = canvas.Canvas(path, pagesize=A4); w, h = A4; y = h - 60
    c.setFont("Helvetica-Bold", 14); c.drawString(50, y, title[:80]); y -= 28; c.setFont("Helvetica", 10)
    for ln in lines:
        for chunk in [ln[i:i+95] for i in range(0, max(len(ln), 1), 95)]:
            c.drawString(50, y, chunk); y -= 15
            if y < 60: c.showPage(); y = h - 60; c.setFont("Helvetica", 10)
    c.save()
def photo(path, caption, color):
    im = Image.new("RGB", (900, 600), color); d = ImageDraw.Draw(im)
    for i in range(0, 600, 40): d.line([(0, i), (900, 600 - i)], fill=tuple(max(0, v - 25) for v in color), width=3)
    d.rectangle([0, 520, 900, 600], fill=(20, 30, 45)); f = ImageFont.load_default()
    d.text((20, 535), caption[:110], fill=(255, 255, 255), font=f); d.text((20, 556), "DEMO IMAGE - synthetic placeholder, not a real photograph. Lake Chad Basin Resilience Fund", fill=(255, 210, 120), font=f)
    im.save(path)
def S(code, m):
    return next(i for i in J["IND"] if i[0] == code)[11][m]
man = []
for m, p in enumerate(J["plan"]):
    M = J["MN"][m]
    for e in p["ev"]:
        a = e["a"]; path = os.path.join(OUT, e["file"]); k = e["kind"]
        if k == "attendance":
            n = a["total"]; fem = a["female"]
            with open(path, "w", newline="") as f:
                w = csv.writer(f); w.writerow(["No","Name","Sex","Community","LGA","Signature"])
                for i in range(n): w.writerow([i+1, f"{random.choice(FN)} {random.choice(LN)}", "F" if i < fem else "M", a["loc"].split(",")[0], a["loc"].split(", ")[-1], "signed"])
        elif k == "photo": photo(path, e["title"], random.choice([(70,120,90),(110,90,60),(60,100,140),(120,110,70)]))
        elif k == "latrines":
            n = S("WS-OP1.2", m)
            with open(path, "w", newline="") as f:
                w = csv.writer(f); w.writerow(["No","Household ID (anonymised)","Ward","Head of household","Lockable door","Handwashing station","Inspected","Pit lined"])
                for i in range(n): w.writerow([i+1, f"HH-{m+1:02d}-{i+1:04d}", random.choice(WARD), random.choice(["Woman","Man","Older person","Person with disability"]), "yes", "yes", "yes", "yes" if m >= 4 else "no"])
        elif k == "wq":
            n = S("WS-OP2.3", m)
            with open(path, "w", newline="") as f:
                w = csv.writer(f); w.writerow(["Test","Water point","Date","Free chlorine residual mg/l","Turbidity NTU","Bacteriology"])
                pas = S("WS-OC1c", m)
                for i in range(n): w.writerow([i+1, f"WP-{random.randint(1,40):02d}", f"{J['MONTHS'][m]}-{(i%27)+1:02d}", round(random.uniform(0.25,0.8),2) if random.random()*100 < pas else round(random.uniform(0.0,0.15),2), random.randint(1,5), random.choice(["clear","clear","clear","positive"])])
        elif k == "dist":
            n = S("WS-OP2.4", m)
            with open(path, "w", newline="") as f:
                w = csv.writer(f); w.writerow(["No","Household ID (anonymised)","Ward","Kit received","Water treatment received","Signature or thumbprint"])
                for i in range(n): w.writerow([i+1, f"HH-{m+1:02d}-{i+1:04d}", random.choice(WARD), "yes", "yes", "signed"])
        elif k == "handover":
            pdf(path, f"Completion and handover certificates - {M}", [f"{a['title']}", f"{a['summary']}", "Signed by the project engineer, the committee chair and the LGA water board representative.", "Items checked against the bill of quantities; pump test and chlorination recorded."])
        elif k == "gbv": pdf(path, "CONFIDENTIAL - Safety audit of latrine and water point siting - March 2026", ["Highly sensitive. Not for donor circulation.", "Women's focus-group discussions identified two locations where women felt unsafe after dark.", "Actions agreed: move one tap stand, add lighting, assign a female monitor."])
        elif k == "proc": pdf(path, "Drilling contractor procurement file", ["Three quotes received and compared against technical and price criteria.", "Contractor selected with the lowest compliant price; contract signed in February 2026.", "Conflict-of-interest declarations signed by the evaluation panel."])
        man.append(dict(m=m, node=e["node"], ind=e.get("ind"), file=path, type=e["type"], sens=e["sens"], loc=e["loc"], title=e["title"], notes=e["notes"]))
json.dump(man, open("evidence-manifest.json", "w"), indent=1); print(len(man), "files")
