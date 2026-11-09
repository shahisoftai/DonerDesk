import json
M=["2026-01","2026-02","2026-03","2026-04","2026-05","2026-06","2026-07"]
V={"OP1-1a":[4,6,7,8,8,5,2],"OP1-1b":[5000,9000,11000,12500,12000,7500,3000],"OP1-1c":[0,1,2,2,2,1,0],"OP1-2a":[60,85,95,100,100,90,70],"OP1-2b":[58,63,70,78,84,88,91],"OP1-2c":[4,6,7,8,8,5,2],
"OP2-1a":[60,110,150,190,200,140,50],"OP2-1b":[5,8,10,12,12,9,4],"OP2-1c":[2000,3600,5000,6300,6800,4500,1800],"OC2b":[0,0,2,4,6,8,5],"OP2-2a":[0,2,4,6,6,5,2],
"OP3-1a":[8000,12000,14000,15000,15000,14000,12000],"OP3-1b":[60,70,50,40,20,0,0],"OP3-1c":[50,100,140,170,170,120,50],"OP3-1d":[300,600,900,1100,1100,700,300],"OP3-1e":[150,350,550,650,650,450,200],"OP3-2a":[3000,5000,6500,7500,7500,6500,4000],"OP3-2b":[1,2,2,2,2,1,0]}
RATE={"OP1-2b"}
Q={"2026-03":{"GI-1":24,"OC1a":55,"OC1b":50,"OC2a":30,"OC3a":38},"2026-06":{"GI-1":20,"OC1a":70,"OC1b":65,"OC2a":44,"OC3a":55},"2026-07":{"GI-1":19,"OC1a":74,"OC1b":69,"OC2a":48,"OC3a":58}}
SRC={"OP1-1a":"Completion certificates","OP1-1b":"Water point registers","OP1-1c":"Commissioning reports","OP1-2a":"Water quality test logs","OP1-2b":"Water quality test logs","OP1-2c":"Training attendance sheets","OP2-1a":"Completion certificates","OP2-1b":"CLTS triggering reports","OP2-1c":"Latrine registers","OC2b":"ODF verification reports","OP2-2a":"Handover certificates","OP3-1a":"Hygiene session attendance sheets","OP3-1b":"Training attendance sheets","OP3-1c":"Installation records","OP3-1d":"Distribution lists","OP3-1e":"Distribution lists","OP3-2a":"Session attendance sheets","OP3-2b":"Stock records"}
cum={}; out={}
for i,m in enumerate(M):
    rows={}
    for k,v in V.items():
        if k not in RATE: cum[k]=cum.get(k,0)+v[i]
        rows[k]={"period":v[i],"cum":None if k in RATE else cum[k],"src":SRC[k]+", "+m}
    for k,v in Q.get(m,{}).items(): rows[k]={"period":v,"cum":None,"src":"Household survey, "+m}
    out[m]=rows
json.dump(out,open("vals.json","w"),indent=1); print({k:cum[k] for k in ("OP1-1a","OP1-1b","OP2-1a","OP3-1a")})
