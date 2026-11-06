// Read-only smoke crawl of the signed-in app in the attached, visible browser. Usage: node smoke.mjs <projectId> <outDir>
import { attach, BASE } from "./lib.mjs";
import fs from "node:fs";
const [id, out] = process.argv.slice(2);
const { page } = await attach("smoke");
const P = `/projects/${id}`;
const routes = ["/dashboard","/my-work","/portfolio","/portfolio/indicators","/portfolio/infographics","/dashboards","/programmes","/reports","/evidence","/compliance","/team","/notifications","/downloads","/audit","/help/how-it-works",
 "/settings","/settings/security","/settings/integrations","/settings/places","/settings/ai-usage","/settings/billing","/settings/ai-style","/settings/audit","/settings/requirement-packs",
 P,P+"/logframe",P+"/logframe/history",P+"/activities",P+"/activities?view=planned",P+"/activities?view=timeline",P+"/activities?view=calendar",P+"/activities?view=map",P+"/activities/plan/start",P+"/activities/plan/import",P+"/activities/new",
 P+"/data",P+"/ask",P+"/infographics",P+"/forms",P+"/forms/new",P+"/beneficiaries",P+"/adaptations",P+"/evidence",P+"/compliance",P+"/templates",P+"/team",P+"/settings",P+"/management-report",P+"/reports",P+"/reports/closing",
 "/field"];
const results = [];
for (const r of routes) {
  const errs = [];
  const onErr = (m) => { if (m.type() === "error") errs.push(m.text().slice(0, 140)); };
  const onPage = (e) => errs.push("pageerror: " + String(e.message).slice(0, 140));
  page.on("console", onErr); page.on("pageerror", onPage);
  let status = 0, h1 = "", body = "";
  try {
    const resp = await page.goto(BASE + r, { waitUntil: "load", timeout: 45000 });
    status = resp?.status() ?? 0;
    await page.waitForTimeout(3000);
    h1 = (await page.locator("h1").first().innerText({ timeout: 2000 }).catch(() => "")).slice(0, 70);
    body = await page.locator("body").innerText();
    await page.screenshot({ path: `${out}/shots/${r.replace(/[^a-z0-9]+/gi, "_").slice(0, 80)}.png` });
  } catch (e) { errs.push("nav: " + e.message.slice(0, 100)); }
  page.off("console", onErr); page.off("pageerror", onPage);
  const bad = /something went wrong|application error|unexpected error|internal server error|not found/i.test(body.slice(0, 1500));
  results.push({ r: r.replace(id, ":id"), status, h1, bad, errs: errs.slice(0, 3) });
  console.log(`${bad || errs.length || status >= 400 ? "!!" : "ok"} ${status} ${r.replace(id, ":id")} | ${h1}${errs.length ? " | " + errs[0] : ""}`);
}
fs.writeFileSync(`${out}/smoke.json`, JSON.stringify(results, null, 1));
process.exit(0);
