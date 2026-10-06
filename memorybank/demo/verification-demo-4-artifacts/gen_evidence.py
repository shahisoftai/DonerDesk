import json, os, csv, random
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas
from PIL import Image, ImageDraw, ImageFont
random.seed(7)
J = json.load(open("../acts.json")); D = J["D"]; OUT = "ev"; os.makedirs(OUT, exist_ok=True)
manifest = []
def pdf(path, title, lines):
    c = canvas.Canvas(path, pagesize=A4); w, h = A4; y = h - 60
    c.setFont("Helvetica-Bold", 14); c.drawString(50, y, title); y -= 28; c.setFont("Helvetica", 10)
    for ln in lines:
        for chunk in [ln[i:i+95] for i in range(0, max(len(ln),1), 95)]:
            c.drawString(50, y, chunk); y -= 15
            if y < 60: c.showPage(); y = h - 60; c.setFont("Helvetica", 10)
    c.save()
def photo(path, caption, color):
    im = Image.new("RGB", (900, 600), color); d = ImageDraw.Draw(im)
    for i in range(0, 600, 40): d.line([(0, i), (900, 600 - i)], fill=tuple(max(0, v - 25) for v in color), width=3)
    d.rectangle([0, 520, 900, 600], fill=(20, 30, 45)); f = ImageFont.load_default()
    d.text((20, 535), caption[:110], fill=(255, 255, 255), font=f); d.text((20, 556), "DEMO IMAGE - synthetic placeholder, not a real photograph", fill=(255, 210, 120), font=f)
    im.save(path)
P = lambda m: f"{m+1:02d}"
for a in J["acts"]:
    m, node, month, loc = a["m"], a["node"], a["month"], a["loc"]; ds = a["date"]
    base = f"{OUT}/{P(m)}-{node}"
    if node == "A1.1":
        wp = D["1.1"][m]; ppl = D["O1"][m]
        lines = [f"Project: Safe Water & Sanitation for Flood-Affected Communities (Dadu)", f"Location: {loc}", f"Inspection date: {ds}", f"Engineer: Imran Memon, Site Engineer, Sindh Rural Support Network", "",
                 f"Water points rehabilitated and inspected this period: {wp}", f"Estimated users served (household register): {ppl} people ({round(ppl*.55)} female, {ppl-round(ppl*.55)} male)", ""]
        for i in range(wp): lines += [f"Water point {i+1}: {'solar mini-scheme' if i==0 and m>0 else 'hand pump'}, platform and drain constructed, disinfected, flow test passed, handed to committee."]
        lines += ["", "Functionality check: all rehabilitated water points functioning at handover.", "Signed: Site Engineer; Water user committee chair (witness)."]
        pdf(base + "-completion-certificate.pdf", f"Water point completion and functionality certificate - {month} 2026", lines)
        manifest.append(dict(m=m, node=node, file=base + "-completion-certificate.pdf", type="Field visit report", sens="Internal", notes=f"Engineer's completion certificate for {wp} water point(s), {month}.", loc=loc, ind="1.1"))
        photo(base + "-photo.png", f"Rehabilitated water point, {loc}, {ds}", (70, 130, 180)); manifest.append(dict(m=m, node=node, file=base + "-photo.png", type="Photo", sens="Public", notes=f"Photo of a rehabilitated water point, {loc}.", loc=loc, ind="O1"))
    elif node == "A1.2":
        com = D["1.2"][m]; n = com * 12
        with open(base + "-training-attendance.csv", "w", newline="") as f:
            w = csv.writer(f); w.writerow(["participant_id", "sex", "role", "village", "date", "signed"])
            fem = com * 5
            for i in range(n): w.writerow([f"WUC-{P(m)}-{i+1:03d}", "F" if i < fem else "M", ["Chair","Treasurer","Caretaker","Member"][i % 4], loc.split(",")[0], ds, "yes"])
        manifest.append(dict(m=m, node=node, file=base + "-training-attendance.csv", type="Attendance sheet", sens="Internal", notes=f"Training attendance for {com} water user committee(s): {n} members ({fem} women, {n-fem} men), {month}.", loc=loc, ind="1.2"))
    elif node == "A1.3":
        cl = D["1.3"][m]; N = 48 if m == 0 else (120 if m == 5 else 100); passed = 28 if m == 0 else (109 if m == 5 else cl)
        with open(base + "-water-quality-log.csv", "w", newline="") as f:
            w = csv.writer(f); w.writerow(["sample_id", "water_point", "date", "residual_chlorine_mg_l", "meets_standard_0.2_0.5"])
            for i in range(N):
                ok = i < passed; v = round(random.uniform(0.2, 0.5), 2) if ok else round(random.choice([random.uniform(0.0, 0.18), random.uniform(0.55, 0.8)]), 2)
                w.writerow([f"WQ-{P(m)}-{i+1:03d}", f"WP-{(i % 12)+1:02d}", ds, v, "yes" if ok else "no"])
        manifest.append(dict(m=m, node=node, file=base + "-water-quality-log.csv", type="Kobo/ODK export", sens="Internal", notes=f"Residual chlorine test log, {month}: {passed} of {N} samples met the 0.2-0.5 mg/L standard.", loc=loc, ind="1.3"))
    elif node == "A2.1":
        lat = D["2.1"][m]
        lines = [f"Household latrine completion checklist summary - {month} 2026", f"Cluster: {loc}", f"Site engineer spot-check date: {ds}", f"Latrines completed and checked in use this period: {lat}", ""]
        for i in range(lat): lines.append(f"HH-{P(m)}{i+1:03d}: slab and pan fitted, superstructure complete, hand-washing point present, in use - passed")
        lines += ["", f"Total passed: {lat}. Total failed: 0."]
        pdf(base + "-latrine-checklist.pdf", f"Latrine completion checklist - {month} 2026", lines)
        manifest.append(dict(m=m, node=node, file=base + "-latrine-checklist.pdf", type="Monitoring report", sens="Internal", notes=f"Completion checklist for {lat} household latrines, {month}.", loc=loc, ind="2.1"))
        photo(base + "-photo.png", f"Completed household latrine, {loc}, {ds}", (110, 150, 100)); manifest.append(dict(m=m, node=node, file=base + "-photo.png", type="Photo", sens="Public", notes="Photo of a completed household latrine.", loc=loc, ind="2.1"))
    elif node == "A2.2":
        blk = D["2.2"][m]
        if blk:
            lines = [f"School WASH block handover certificate - {month} 2026", f"School: {loc}", f"Handover date: {ds}", f"Blocks handed over this period: {blk}", "", "Each block: separate girls' and boys' latrines, two handwashing points, rainwater and piped supply, ramp access.", "Signed: Contractor; Site Engineer; Head Teacher; School Management Committee chair."]
            pdf(base + "-handover-certificate.pdf", "School WASH block handover certificate", lines)
            manifest.append(dict(m=m, node=node, file=base + "-handover-certificate.pdf", type="Approval document", sens="Internal", notes=f"Handover certificate for {blk} school WASH block(s), {month}.", loc=loc, ind="2.2"))
            photo(base + "-photo.png", f"School WASH block, {loc}, {ds}", (150, 120, 90)); manifest.append(dict(m=m, node=node, file=base + "-photo.png", type="Photo", sens="Public", notes="Photo of a completed school WASH block.", loc=loc, ind="2.2"))
        else:
            lines = ["Minutes: school site selection and design meeting", f"Date: {ds}", f"Location: {loc}", "Attendees: site engineer, five head teachers, school management committee chairs, programme officer.", "", "Decision: five schools selected for gender-separated WASH blocks; standard design approved.", "Action: contractor tender to follow in April."]
            pdf(base + "-site-selection-minutes.pdf", "Meeting minutes - school WASH site selection", lines)
            manifest.append(dict(m=m, node=node, file=base + "-site-selection-minutes.pdf", type="Meeting minutes", sens="Internal", notes="Minutes of the school site selection meeting with head teachers.", loc=loc, ind="2.2"))
    elif node == "A2.3":
        hyg = D["2.3"][m]; sess = 6 if hyg < 2000 else 8; per = hyg // sess; rem = hyg - per * sess
        with open(base + "-session-attendance.csv", "w", newline="") as f:
            w = csv.writer(f); w.writerow(["session", "date", "venue", "women", "men", "children", "total"])
            tot = 0
            for i in range(sess):
                t = per + (rem if i == sess - 1 else 0); ch = round(t * 0.4); wo = round(t * 0.54) - 0; wo = min(wo, t - ch); mo = t - ch - wo
                w.writerow([i + 1, ds, f"{loc.split(',')[0]} session {i+1}", wo, mo, ch, t]); tot += t
        manifest.append(dict(m=m, node=node, file=base + "-session-attendance.csv", type="Attendance sheet", sens="Internal", notes=f"Session attendance totals for {sess} hygiene promotion sessions: {hyg} people reached, {month}.", loc=loc, ind="2.3"))
        photo(base + "-photo.png", f"Handwashing demonstration, {loc}, {ds}", (180, 140, 70)); manifest.append(dict(m=m, node=node, file=base + "-photo.png", type="Photo", sens="Public", notes="Photo of a handwashing demonstration session.", loc=loc, ind="2.3"))
json.dump(manifest, open("../evidence-manifest.json", "w"), indent=1); print(len(manifest), "files")
