import json, os, csv, random
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas
from PIL import Image, ImageDraw, ImageFont
random.seed(7)
J = json.load(open("plan.json"))
OUT = "/home/najeeb/Linux-Dev/Humanetarian/DonerDesk/memorybank/demo/verification-demo-7-artifacts/ev"; os.makedirs(OUT, exist_ok=True)
IND = {i[0]: i for i in J["IND"]}
FN = ["Abdul","Fati","Mariam","Issah","Salamatu","Alhassan","Zuweira","Yakubu","Rahinatu","Mohammed","Hawa","Abu","Ayishetu","Iddrisu","Sanatu","Fuseini","Adiza","Baba","Memunatu","Sulemana"]
LN = ["Mahama","Abdulai","Alhassan","Yakubu","Issahaku","Seidu","Fuseini","Iddrisu","Tia","Wumbei","Napari","Dauda"]
CADRE = ["Community Health Officer","Midwife","Enrolled Nurse","Medical Assistant","Disease Control Officer"]
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
    d.text((20, 535), caption[:110], fill=(255, 255, 255), font=f); d.text((20, 556), "DEMO IMAGE - synthetic placeholder, not a real photograph. Funded by the European Union", fill=(255, 210, 120), font=f)
    im.save(path)
man = []
for m, p in enumerate(J["plan"]):
    M = J["MN"][m]
    for e in p["ev"]:
        a = e["a"]; path = os.path.join(OUT, e["file"]); k = e["kind"]
        if k == "attendance":
            n = a["total"]; fem = a["female"]
            with open(path, "w", newline="") as f:
                w = csv.writer(f); w.writerow(["No","Name","Sex","Cadre/Role","Facility/Community","District","Signature"])
                for i in range(n):
                    w.writerow([i+1, f"{random.choice(FN)} {random.choice(LN)}", "F" if i < fem else "M", random.choice(CADRE), a["loc"].split(",")[0], a["loc"].split(", ")[-1], "signed"])
        elif k == "photo":
            photo(path, e["title"], random.choice([(70,120,90),(110,90,60),(60,100,140),(120,110,70)]))
        elif k == "outreach":
            n = int(IND["MR-OP1.4"][11][m]);
            with open(path, "w", newline="") as f:
                w = csv.writer(f); w.writerow(["Clinic","Community","District","Date","ANC visits","Penta doses","Postnatal checks","Children weighed"])
                for i in range(n): w.writerow([i+1, f"Community-{i%17+1}", ["Tolon","Kumbungu","Savelugu","Nanton","Karaga"][i%5], f"{J['MONTHS'][m]}-{(i%27)+1:02d}", random.randint(8,26), random.randint(5,22), random.randint(3,12), random.randint(20,60)])
        elif k == "dhims":
            with open(path, "w", newline="") as f:
                w = csv.writer(f); w.writerow(["Indicator","Period","Value","Unit","Source"])
                for c in ["MR-OC1a","MR-OC1b","MR-OC1c","MR-OC1d","MR-OC1e","MR-OC2a"]:
                    v = IND[c][11][m]; w.writerow([IND[c][1], J["MONTHS"][m], v, "%", "DHIMS2 / GHS records"])
        elif k == "nhis":
            n = int(IND["MR-OP2.4"][11][m])
            with open(path, "w", newline="") as f:
                w = csv.writer(f); w.writerow(["No","Household ID (anonymised)","Type","District","Pregnant woman in household","Child under 5"])
                for i in range(n): w.writerow([i+1, f"HH-{m+1:02d}-{i+1:04d}", random.choice(["New enrolment","Renewal"]), ["Tolon","Kumbungu","Savelugu","Nanton","Karaga"][i%5], random.choice(["yes","no"]), random.choice(["yes","no"])])
        elif k == "handover":
            n = IND["MR-OP1.2"][11][m]; pdf(path, f"Equipment handover certificates - {M}", [f"{n} facilities received delivery kits and solar vaccine fridges in {M}."] + [f"Certificate {i+1}: facility in-charge signed on {J['MONTHS'][m]}-{14+i}. Items checked against the delivery note." for i in range(n)] + ["Funded by the European Union."])
        elif k == "supervision":
            n = IND["MR-OP2.2"][11][m]; pdf(path, f"Supportive supervision checklists - {M}", [f"{n} visits conducted using the standard checklist."] + [f"Visit {i+1}: partograph use, stock cards, cold chain log, DHIMS2 completeness checked; actions agreed and signed." for i in range(n)])
        elif k == "minutes":
            pdf(path, f"Quarterly scorecard review minutes - {M}", ["Five district health management teams reviewed their quarterly scorecards.", "Agreed actions: close stock-out gaps, improve timeliness of DHIMS2 reporting, follow up NHIS renewals.", "Attendance: 25 participants (11 female, 14 male). Chairs: five District Directors of Health Services."])
        elif k == "mdr":
            pdf(path, "CONFIDENTIAL - Maternal death review summary - December 2025", ["Highly sensitive. Not for donor circulation.", "One maternal death at a district hospital was reviewed under the confidential maternal death audit.", "Contributing factors: delay in decision to seek care and transport delay. Actions recommended: referral protocol, transport arrangement."])
        man.append(dict(m=m, node=e["node"], ind=e.get("ind"), file=path, type=e["type"], sens=e["sens"], loc=e["loc"], title=e["title"], notes=e["notes"]))
json.dump(man, open("evidence-manifest.json", "w"), indent=1); print(len(man), "files")
