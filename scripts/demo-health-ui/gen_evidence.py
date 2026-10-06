import json, os, csv, random, sys
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas
from PIL import Image, ImageDraw, ImageFont
random.seed(11)
J = json.load(open("plan.json")); IND = {i[0]: i for i in J["IND"]}
OUT = "/home/najeeb/Linux-Dev/Humanetarian/DonerDesk/memorybank/demo/verification-demo-5-artifacts/ev"; os.makedirs(OUT, exist_ok=True)
manifest = []
def V(code, m): return IND[code][11][m]
FAC = ["Kanamkemer HC","Nakwamekwi Disp","Lodwar SCH","Kalokol HC","Lowarengak Disp","Kerio HC","Katilu HC","Lokori HC","Lokichar HC","Kainuk Disp","Lorugum HC","Napuu Disp","Lokitaung HC","Kakuma Mission HC"]
def spread(total, n=14):
    base = [random.randint(70, 130) for _ in range(n)]; s = sum(base); out = [round(total * b / s) for b in base]; out[-1] += total - sum(out); return out
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
def add(m, node, file, title, typ, sens, notes, loc, ind):
    manifest.append(dict(m=m, node=node, file=file, title=title, type=typ, sens=sens, notes=notes, loc=loc, ind=ind))
for m, acts in enumerate(J["acts"]):
    M = J["MONTHS"][m]; P = f"{m+1:02d}"
    for a in acts:
        node, loc, ds = a["node"], a["loc"], a["date"]; base = f"{OUT}/{P}-{node}"; site = loc.split(",")[0]
        if node == "A1.1":
            n = V("HL-1.1a", m); fem = round(n * 0.58); cad = ["Nurse-midwife","Clinical officer","Nurse","Medical officer","Pharmaceutical tech"]
            with open(base + "-training-attendance.csv", "w", newline="") as f:
                w = csv.writer(f); w.writerow(["participant_id","sex","cadre","facility","course","dates","signed"])
                for i in range(n): w.writerow([f"HW-{P}-{i+1:03d}", "F" if i < fem else "M", cad[i % 5], FAC[i % 14], ["EmONC","IMCI","Essential newborn care"][i % 3], ds, "yes"])
            add(m, node, base + "-training-attendance.csv", f"Training attendance - EmONC/IMCI/ENC - {M} 2026", "Attendance sheet", "Internal", f"Attendance for {n} health workers trained in {M} ({fem} female, {n-fem} male).", loc, "HL-1.1a")
            v = V("HL-1.1b", m)
            lines = [f"Clinical mentorship visit log - {M} 2026", f"Mentor team: nurse-midwife mentors, LOCHA", f"Visits completed: {v} (target 14 per month)", ""]
            for i in range(v): lines.append(f"Visit {i+1}: {FAC[i % 14]} - date {ds[:8]}{(3+i*2)%28+1:02d} - observed deliveries and newborn care, gaps recorded, action plan signed by in-charge")
            lines += ["", "Signed: Lead mentor; Facility in-charge (each visit)."]
            pdf(base + "-mentorship-visit-log.pdf", f"Mentorship visit log - {M} 2026", lines)
            add(m, node, base + "-mentorship-visit-log.pdf", f"Clinical mentorship visit log - {M} 2026", "Field visit report", "Internal", f"Signed mentorship visit log: {v} facility visits in {M}.", loc, "HL-1.1b")
        elif node == "A1.2":
            fac = V("HL-1.2a", m)
            if fac:
                lines = [f"Equipment handover certificates - {M} 2026", f"Kit contents: delivery set, newborn resuscitation set, fetal doppler, BP machine, weighing scales, delivery couch; solar fridge where indicated", ""]
                for i in range(fac): lines.append(f"Certificate {i+1}: {FAC[(sum(V('HL-1.2a', k) for k in range(m)) + i) % 14]} - kit received complete and installed; signed by facility in-charge and LOCHA logistics officer; USAID marking applied.")
                pdf(base + "-handover-certificates.pdf", f"MNCH equipment handover certificates - {M}", lines)
                add(m, node, base + "-handover-certificates.pdf", f"Equipment handover certificates - {M} 2026", "Approval document", "Internal", f"Signed handover certificates for {fac} facilities in {M}.", loc, "HL-1.2a")
                photo(base + "-photo.png", f"MNCH equipment kit installed, {site}, {ds}", (90, 140, 120)); add(m, node, base + "-photo.png", f"Photo - equipment kit installed, {M}", "Photo", "Public", "Photo of installed MNCH equipment with USAID marking.", loc, "HL-1.2a")
            else:
                pdf(base + "-needs-assessment.pdf", "Facility equipment needs assessment summary", [f"Date: {ds}", "Joint assessment of 14 facilities with the county pharmacist.", "Result: gaps in delivery sets (11 facilities), neonatal resuscitation (13), fetal dopplers (9), solar refrigeration (3).", "Procurement: three quotations obtained for each lot; tender issued to prequalified suppliers.", "Approval: AOR consent to subaward and procurement plan received."])
                add(m, node, base + "-needs-assessment.pdf", "Facility equipment needs assessment and procurement plan", "Procurement document", "Internal", "Needs assessment of 14 facilities and tender documents; no kits delivered yet.", loc, "HL-1.2a")
        elif node == "A1.3":
            n = V("HL-1.3a", m); sp = spread(n)
            with open(base + "-anc-register-extract.csv", "w", newline="") as f:
                w = csv.writer(f); w.writerow(["facility","month","first_anc_visits","source"]); [w.writerow([FAC[i], M, sp[i], "MOH 405"]) for i in range(14)]
            add(m, node, base + "-anc-register-extract.csv", f"ANC register extract (MOH 405) - {M} 2026", "Kobo/ODK export", "Internal", f"First ANC visits by facility totalling {n} in {M}.", loc, "HL-1.3a")
            n = V("HL-1.3b", m); sp = spread(n)
            with open(base + "-maternity-sba-extract.csv", "w", newline="") as f:
                w = csv.writer(f); w.writerow(["facility","month","deliveries_by_skilled_attendant","source"]); [w.writerow([FAC[i], M, sp[i], "MOH 333"]) for i in range(14)]
            add(m, node, base + "-maternity-sba-extract.csv", f"Maternity register extract (MOH 333) - {M} 2026", "Kobo/ODK export", "Internal", f"Skilled deliveries by facility totalling {n} in {M}.", loc, "HL-1.3b")
            n = V("HL-1.3c", m)
            with open(base + "-voucher-claims.csv", "w", newline="") as f:
                w = csv.writer(f); w.writerow(["voucher_id","date","from_facility","to_facility","transporter","claim_usd","status"]); [w.writerow([f"TV-{P}-{i+1:03d}", ds, FAC[i % 14], "Lodwar CRH", f"Transporter {(i%9)+1}", 25 + (i % 5) * 5, "reimbursed"]) for i in range(n)]
            add(m, node, base + "-voucher-claims.csv", f"Transport voucher claims - {M} 2026", "Distribution list", "Internal", f"{n} emergency obstetric transport voucher claims in {M}.", loc, "HL-1.3c")
            pdf(base + "-khis-coverage-summary.pdf", f"KHIS coverage indicators - {M} 2026", [f"Source: KHIS/DHIS2, 14 supported facilities, month {M} 2026", f"ANC4+ coverage: {V('HL-OC1a', m)}%", f"Deliveries by skilled birth attendant: {V('HL-OC1b', m)}%", f"Penta3 coverage under 1 year: {V('HL-OC1c', m)}%", "Extracted by the M&E officer and cross-checked against facility registers on two sampled facilities."])
            add(m, node, base + "-khis-coverage-summary.pdf", f"KHIS coverage summary (ANC4+, SBA, Penta3) - {M} 2026", "Monitoring report", "Internal", f"KHIS coverage rates for {M}: ANC4+ {V('HL-OC1a', m)}%, SBA {V('HL-OC1b', m)}%, Penta3 {V('HL-OC1c', m)}%.", loc, "HL-OC1a")
            if m == 3:
                pdf(base + "-maternal-death-notification.pdf", "Maternal death notification summary (confidential)", [f"Date: {ds}", "One maternal death notified from Lokichar HC following postpartum haemorrhage after referral delay.", "Maternal death surveillance and response (MPDSR) review scheduled with the Sub-County Health Management Team.", "Names and identifiers withheld; case file held by the county. CONFIDENTIAL."])
                add(m, node, base + "-maternal-death-notification.pdf", "Maternal death notification summary (MPDSR) - June 2026", "Monitoring report", "Highly sensitive", "Confidential summary of one maternal death notified in June; review under MPDSR.", loc, None)
        elif node == "A1.4":
            n = V("HL-1.4a", m); sp = spread(n)
            with open(base + "-immunization-tally.csv", "w", newline="") as f:
                w = csv.writer(f); w.writerow(["facility","month","penta3_under1","girls","boys","source"]); [w.writerow([FAC[i], M, sp[i], round(sp[i]*.5), sp[i]-round(sp[i]*.5), "MOH 710"]) for i in range(14)]
            add(m, node, base + "-immunization-tally.csv", f"Immunization tally (MOH 710) - {M} 2026", "Kobo/ODK export", "Internal", f"Penta3 doses to children under 1 year totalling {n} in {M}.", loc, "HL-1.4a")
            k = V("HL-1.4b", m)
            with open(base + "-outreach-session-log.csv", "w", newline="") as f:
                w = csv.writer(f); w.writerow(["session_id","date","site","team","children_vaccinated"]); [w.writerow([f"OS-{P}-{i+1:03d}", f"{ds[:8]}{(i%27)+1:02d}", f"{FAC[i % 14].split()[0]} outreach site {(i%3)+1}", "Vaccinator + CHV pair", random.randint(8, 30)]) for i in range(k)]
            add(m, node, base + "-outreach-session-log.csv", f"Outreach immunization session log - {M} 2026", "Field visit report", "Internal", f"Log of {k} outreach immunization sessions in {M}.", loc, "HL-1.4b")
        elif node == "A1.5":
            pdf(base + "-khis-reporting-rate.pdf", f"KHIS reporting rate dashboard export - {M} 2026", [f"Supported facilities: 14", f"Reports submitted on time: {round(V('HL-1.5a', m)*14/100)} of 14 ({V('HL-1.5a', m)}%)", "Data quality audit: registers compared with KHIS entries; discrepancy under 5% at most facilities.", f"Review meeting date: {ds}; 28 participants."])
            add(m, node, base + "-khis-reporting-rate.pdf", f"KHIS reporting-rate export and DQA summary - {M} 2026", "Monitoring report", "Internal", f"Timely reporting {V('HL-1.5a', m)}% in {M}.", loc, "HL-1.5a")
        elif node == "A2.1":
            n = V("HL-2.1a", m); fem = round(n * 0.64)
            with open(base + "-chv-training-register.csv", "w", newline="") as f:
                w = csv.writer(f); w.writerow(["chv_id","sex","community_health_unit","kit_received","signed"]); [w.writerow([f"CHV-{P}-{i+1:03d}", "F" if i < fem else "M", f"CHU-{(i%14)+1:02d}", "yes", "yes"]) for i in range(n)]
            add(m, node, base + "-chv-training-register.csv", f"CHV training and kit register - {M} 2026", "Training record", "Internal", f"Register of {n} CHVs trained and kitted in {M} ({fem} women).", loc, "HL-2.1a")
        elif node == "A2.2":
            n = V("HL-2.2a", m); sess = 12 + m; per = n // sess; rem = n - per * sess
            with open(base + "-dialogue-attendance.csv", "w", newline="") as f:
                w = csv.writer(f); w.writerow(["session","date","venue","women_girls","men_boys","total"])
                for i in range(sess):
                    t = per + (rem if i == sess - 1 else 0); wo = round(t * 0.62); w.writerow([i + 1, ds, f"{site} community session {i+1}", wo, t - wo, t])
            add(m, node, base + "-dialogue-attendance.csv", f"Community dialogue attendance - {M} 2026", "Attendance sheet", "Internal", f"Attendance for {sess} dialogue sessions: {n} people reached in {M}.", loc, "HL-2.2a")
            photo(base + "-photo.png", f"Community dialogue on ANC and immunization, {site}, {ds}", (170, 130, 80)); add(m, node, base + "-photo.png", f"Photo - community dialogue, {M}", "Photo", "Public", "Photo of a community dialogue session (faces not shown).", loc, "HL-2.2a")
            if V("HL-OC2a", m) is not None:
                pdf(base + "-kap-spot-survey.pdf", f"KAP spot survey report - {M} 2026", [f"Method: CHV-led spot survey, systematic sample of caregivers of children under five in 14 catchment areas, n=420", f"Caregivers naming three or more child danger signs: {V('HL-OC2a', m)}%", "Enumerators trained for one day; data entered in KoboToolbox; 5% re-interviewed for quality."])
                add(m, node, base + "-kap-spot-survey.pdf", f"KAP spot survey - danger signs - {M} 2026", "Monitoring report", "Internal", f"KAP survey: {V('HL-OC2a', m)}% of caregivers name three danger signs.", loc, "HL-OC2a")
        elif node == "A2.3":
            n = V("HL-2.3a", m); sp = spread(n)
            with open(base + "-muac-screening-log.csv", "w", newline="") as f:
                w = csv.writer(f); w.writerow(["chu","month","children_screened","girls","boys"]); [w.writerow([f"CHU-{i+1:02d}", M, sp[i], round(sp[i]*.51), sp[i]-round(sp[i]*.51)]) for i in range(14)]
            add(m, node, base + "-muac-screening-log.csv", f"MUAC screening log - {M} 2026", "Kobo/ODK export", "Internal", f"MUAC screening of {n} children by CHVs in {M}.", loc, "HL-2.3a")
            k = V("HL-2.3b", m)
            with open(base + "-referral-slips.csv", "w", newline="") as f:
                w = csv.writer(f); w.writerow(["slip_id","date","chu","muac_cm","status","cmam_site"]); [w.writerow([f"RS-{P}-{i+1:03d}", ds, f"CHU-{(i%14)+1:02d}", random.choice([10.8, 11.0, 11.3, 11.4, 11.1]), random.choice(["SAM","MAM","MAM"]), FAC[i % 14]]) for i in range(k)]
            add(m, node, base + "-referral-slips.csv", f"Malnutrition referral slips - {M} 2026", "Beneficiary list", "Internal", f"{k} children referred to CMAM sites in {M}.", loc, "HL-2.3b")
json.dump(manifest, open("evidence-manifest.json", "w"), indent=1); print(len(manifest), "files")
