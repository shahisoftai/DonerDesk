import json
M=["2026-03","2026-04","2026-05","2026-06","2026-07","2026-08"]
V={"OP1-1a":[300,800,1200,1300,1100,700],"OP1-1b":[10,20,25,25,20,15],"OP1-1c":[4,8,6,4,2,0],
"OP1-2a":[0,4,8,10,10,8],"OP1-2b":[0,3,6,8,8,5],"OP1-2c":[0,1500,3000,3500,2500,1500],
"OP2-1a":[40,90,110,100,70,40],"OP2-1b":[20,90,150,220,230,190],"OP2-2a":[0,1500,2500,2300,1700,1000],"OP2-2b":[10,30,40,25,15,0],"OP2-2c":[0,2000,4000,4500,3000,1500],
"OP3-1a":[60,120,150,130,90,50],"OP3-1b":[8,20,30,35,35,22],"OP3-1c":[1000,2500,4000,5000,4500,3000],
"OP3-2a":[0,300,500,400,200,100],"OP3-2b":[0,800,1500,1500,900,300],"OP3-2c":[20,60,100,100,70,50],"OP3-2d":[0,30,60,70,50,30]}
Q={"2026-05":{"GI-1":67,"OC1a":76,"OC1b":82,"OC2a":24,"OC2b":27,"OC3a":45},"2026-08":{"GI-1":72,"OC1a":84,"OC1b":88,"OC2a":35,"OC2b":38,"OC3a":78}}
SRC={"OP1-1a":"Enrolment registers","OP1-1b":"Campaign reports","OP1-1c":"Centre registration records","OP1-2a":"Completion certificates","OP1-2b":"Handover certificates","OP1-2c":"Distribution lists",
"OP2-1a":"Training attendance sheets","OP2-1b":"Coaching visit forms","OP2-2a":"Club attendance registers","OP2-2b":"Club registration records","OP2-2c":"Listener and platform logs",
"OP3-1a":"Training attendance sheets","OP3-1b":"Dialogue reports","OP3-1c":"Dialogue attendance sheets","OP3-2a":"Bursary registers","OP3-2b":"Distribution lists","OP3-2c":"Support registers","OP3-2d":"Training attendance sheets"}
SRCQ={"GI-1":"School enrolment registers (NEMIS)","OC1a":"School attendance registers","OC1b":"School registers","OC2a":"Early grade reading assessment","OC2b":"Early grade maths assessment","OC3a":"School governance checklist"}
cum={}; out={}
for i,m in enumerate(M):
    rows={}
    for k,v in V.items():
        cum[k]=cum.get(k,0)+v[i]
        rows[k]={"period":v[i],"cum":cum[k],"src":SRC[k]+", "+m}
    for k,v in Q.get(m,{}).items(): rows[k]={"period":v,"cum":None,"src":SRCQ[k]+", "+m}
    out[m]=rows
json.dump(out,open("vals.json","w"),indent=1); print({k:cum[k] for k in ("OP1-1a","OP2-2a","OP3-1c","OP3-2b")})
