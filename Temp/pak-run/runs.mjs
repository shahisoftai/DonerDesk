import { attach } from "./lib.mjs";
const { page, browser } = await attach("runs");
const id = new URL(page.url()).searchParams.get("id");
const r = await page.evaluate(async (id) => { for (const p of [`/api/v1/project-setup/drafts/${id}`,`/api/proxy/v1/project-setup/drafts/${id}`]) { const x = await fetch(p,{credentials:"include"}); if (x.ok && /json/.test(x.headers.get("content-type")||"")) return {p, j: await x.json()}; } return null; }, id);
if(!r){console.log("no api");} else { const v=r.j.data??r.j; console.log(Object.keys(v)); console.log(JSON.stringify(v.areaRuns??v.runs??v.sources, null, 0).slice(0,3000)); console.log(JSON.stringify(v.leftOut??{}).slice(0,1500)); }
await browser.close();
