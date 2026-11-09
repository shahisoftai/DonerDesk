import json, sys, openpyxl, calendar
V = json.load(open("vals.json"))
LBL = {"03":"March","04":"April","05":"May","06":"June","07":"July","08":"August"}
CO = ["Turkana","Garissa","Marsabit","Wajir","Mandera"]
# (title, logframe code, indicator, location, day, key, template, key2)
ROWS = [
("Community enrolment drive","A1.1.1","OP1-1a","Turkana",18,"OP1-1a","{} out-of-school children enrolled; {} communities reached.","OP1-1b"),
("Accelerated education centre set-up","A1.1.2","OP1-1c","Marsabit",20,"OP1-1c","{} accelerated education centres opened.",None),
("Classroom and school WASH works","A1.2.1","OP1-2a","Garissa",24,"OP1-2a","{} classrooms completed; {} schools with working latrines and handwashing.","OP1-2b"),
("Scholastic kit distribution","A1.2.2","OP1-2c","Wajir",22,"OP1-2c","{} learners received scholastic kits.",None),
("Teacher training on the competency-based curriculum","A2.1.1","OP2-1a","Garissa",12,"OP2-1a","{} teachers trained in inclusive teaching.",None),
("Teacher coaching visits","A2.1.2","OP2-1b","Mandera",26,"OP2-1b","{} coaching visits made to teachers.",None),
("Remedial reading and numeracy clubs","A2.2.1","OP2-2a","Turkana",21,"OP2-2a","{} learners attended remedial clubs; {} clubs running.","OP2-2b"),
("Radio and digital lessons","A2.2.2","OP2-2c","Wajir",27,"OP2-2c","{} learners reached through radio and digital lessons.",None),
("School management committee training","A3.1.1","OP3-1a","Marsabit",15,"OP3-1a","{} committee members trained.",None),
("Community dialogue on girls' education","A3.1.2","OP3-1b","Mandera",19,"OP3-1b","{} dialogues held; {} people reached.","OP3-1c"),
("Girls' bursaries and dignity kits","A3.2.1","OP3-2a","Garissa",23,"OP3-2a","{} girls received bursaries and {} dignity kits were handed out.","OP3-2b"),
("Support for learners with disabilities","A3.2.2","OP3-2c","Turkana",25,"OP3-2c","{} learners with disabilities supported; {} teachers trained in psychosocial support.","OP3-2d"),
]
wb = openpyxl.Workbook(); ws = wb.active; ws.title = "Activities"
ws.append(["Activity Title","Activity Date","Location","Logframe Code (Output or Activity)","Indicator Code","Participants Total","Participants Male","Participants Female","Participants Children","Participants Disability","Participants Other","Summary","Achievements","Challenges","Lessons Learned","Next Steps"])
n = 0
for m, rows in V.items():
    mm = m[5:]
    for title, code, ind, loc, day, key, tmpl, key2 in ROWS:
        v = rows[key]["period"]
        if v == 0: continue
        if v == 0 and key not in ("OP1-1a",): 
            if key in ("OP1-1a",): pass
        v2 = rows[key2]["period"] if key2 else None
        text = tmpl.format(v, v2) if "{}" in tmpl and tmpl.count("{}") == 2 else tmpl.format(v)
        tot = max(int(v) if key not in ("OP1-2b",) else 25, 1); tot = min(tot, 15000)
        ws.append([f"{title} - {LBL[mm]} 2026", f"{m}-{day:02d}", loc, code, ind, tot, tot*45//100, tot*55//100, tot*35//100, tot*4//100, "",
                   f"{title} in {LBL[mm]} 2026 in {loc} county. " + text, text,
                   "Long distances, seasonal flooding and teacher absence slowed some sessions; managed by rescheduling.", "School committees and head teachers speed up follow-up when engaged early.", "Continue as planned next month."])
        n += 1
wb.save(sys.argv[1]); print("rows", n)
