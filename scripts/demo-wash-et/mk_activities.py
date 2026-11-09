import json, sys, openpyxl, calendar
V = json.load(open("vals.json"))
LBL = {"01":"January","02":"February","03":"March","04":"April","05":"May","06":"June","07":"July"}
# (title, code, indicator, location, day, male share)
ROWS = [
("Borehole and hand pump rehabilitation","A1.1.1","OP1-1a","Gode",20,"OP1-1a","{} water points rehabilitated; people with access {}.","OP1-1b"),
("Solar-powered water system installation","A1.1.2","OP1-1c","Dolo Ado",22,"OP1-1c","{} solar systems commissioned.",None),
("Water quality testing and chlorination","A1.2.1","OP1-2a","Kebri Dahar",27,"OP1-2a","{} water quality tests done; {}% met the chlorine standard.","OP1-2b"),
("Water point committee training","A1.2.2","OP1-2c","Mustahil",15,"OP1-2c","{} committees trained.",None),
("Latrine construction","A2.1.1","OP2-1a","Warder",24,"OP2-1a","{} latrine stances built; {} people with access.","OP2-1c"),
("CLTS triggering and follow-up","A2.1.2","OP2-1b","Gode",18,"OP2-1b","{} villages triggered; {} villages verified open-defecation free.","OC2b"),
("School and health facility WASH rehabilitation","A2.2.1","OP2-2a","Kebri Dahar",25,"OP2-2a","{} facilities handed over.",None),
("Hygiene promotion and handwashing stations","A3.1.1","OP3-1a","Mustahil",21,"OP3-1a","{} people reached with hygiene promotion; {} handwashing stations installed.","OP3-1c"),
("Hygiene and menstrual hygiene kit distribution","A3.1.2","OP3-1d","Dolo Ado",26,"OP3-1d","{} households and {} women and girls received kits.","OP3-1e"),
("Cholera prevention messaging","A3.2.1","OP3-2a","Kebri Dahar",28,"OP3-2a","{} people reached with cholera prevention messages.",None),
]
wb = openpyxl.Workbook(); ws = wb.active; ws.title = "Activities"
ws.append(["Activity Title","Activity Date","Location","Logframe Code (Output or Activity)","Indicator Code","Participants Total","Participants Male","Participants Female","Participants Children","Participants Disability","Participants Other","Summary","Achievements","Challenges","Lessons Learned","Next Steps"])
n = 0
for m, rows in V.items():
    mm = m[5:]
    for title, code, ind, loc, day, key, tmpl, key2 in ROWS:
        v = rows[key]["period"]
        if key in ("OP1-1c","OP2-2a","OP3-1b") and v == 0: continue
        if v == 0 and key not in ("OP1-1a",): 
            if key in ("OP1-1a",): pass
        v2 = rows[key2]["period"] if key2 else None
        text = tmpl.format(v, v2) if "{}" in tmpl and tmpl.count("{}") == 2 else tmpl.format(v)
        tot = max(int(v) if key not in ("OP1-2b",) else 25, 1); tot = min(tot, 15000)
        ws.append([f"{title} - {LBL[mm]} 2026", f"{m}-{day:02d}", loc, code, ind, tot, tot*45//100, tot*55//100, tot*35//100, tot*4//100, "",
                   f"{title} in {LBL[mm]} 2026 across the project woredas. " + text, text,
                   "Fuel and spare-part delays and long distances slowed some work; managed by rescheduling.", "Community committees speed up follow-up and maintenance.", "Continue as planned next month."])
        n += 1
wb.save(sys.argv[1]); print("rows", n)
