import { attach, BASE } from "./lib.mjs";
const P = process.env.P;
const OUT = process.env.OUT;
const { page } = await attach("v52-read");
const errors = [];
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text().slice(0, 160)); });
page.on("pageerror", (e) => errors.push("PAGEERROR " + String(e).slice(0, 160)));
const visit = async (path, name, probe) => {
  const r = await page.goto(BASE + path, { waitUntil: "networkidle" });
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: false });
  const text = await page.evaluate(() => document.body.innerText);
  console.log(`\n== ${name} (${r?.status()}) ${page.url().replace(BASE, "")}`);
  for (const p of probe) console.log(`  ${p}: ${new RegExp(p, "i").test(text) ? "yes" : "NO"}`);
  return text;
};
await visit(`/projects/${P}/logframe`, "1-logframe-edit", ["How to read|Results framework", "Logframe &? ?indicators|Logframe & indicators", "Goal → Outcome → Output → Activity", "Edit"]);
const t2 = await visit(`/projects/${P}/logframe?view=RESULTS`, "2-lens-results", ["Results framework", "Why this leads", "Download Word", "Download PDF"]);
console.log("  rows:", (t2.match(/\n/g) ?? []).length);
await visit(`/projects/${P}/logframe?view=LOGFRAME`, "3-lens-logframe", ["Logframe", "Assumptions", "Means of verification", "Baseline", "Target"]);
for (const [lens, fmt] of [["RESULTS", "docx"], ["LOGFRAME", "pdf"]]) {
  const r = await page.request.get(`${BASE}/api/projects/${P}/framework/export?lens=${lens}&format=${fmt}`);
  const body = await r.body();
  console.log(`\n== download ${lens}.${fmt}: ${r.status()} ${r.headers()["content-type"]} ${body.length} bytes ${r.headers()["content-disposition"]} magic=${body.subarray(0, 4).toString("latin1").replace(/[^\x20-\x7e]/g, ".")}`);
}
await visit(`/projects/${P}/logframe/history`, "4-history", ["Framework history", "Results or reasoning changed|Measurement changed", "Signed off|Sign off"]);
await visit(`/projects/${P}/setup/profile`, "5-profile", ["Results framework wording", "Donor wording", "Save wording"]);
await visit(`/projects/${P}`, "6-overview", ["outcome|Outcome"]);
console.log("\nconsole errors:", errors.length ? errors.join("\n  ") : "none");
process.exit(0);
