import { LOGFRAME, IND } from "./data.mjs"; import { writeFileSync } from "node:fs";
const q = s => `"${String(s).replace(/"/g,'""')}"`;
writeFileSync("logframe.csv", ["Level,Code,Title,Description", ...LOGFRAME.map(r=>`${r[0]},${r[1]},${q(r[2])},${q(r[3])}`)].join("\n")+"\n");
writeFileSync("indicators.csv", ["Code,Name,Type,Baseline,Target,Unit,Means of Verification,Data Source,Frequency,Disaggregation Required,Logframe Code",
 ...IND.map(i=>[i[0],q(i[1]),i[2],i[3],i[4],q(i[5]),q(i[6]),q(i[7]),i[8],i[9],i[10]].join(","))].join("\n")+"\n");
// checks: sums
for (const i of IND) if (i[2]==="Number" && i[0]!=="MR-IMP1") console.log(i[0], i[11].reduce((a,b)=>a+(b??0),0), "/", i[4]);
