import { attach, BASE } from "./lib.mjs";
const { page } = await attach("v52-edit");
const T = process.env.T, S = process.env.OUT;
const errors = []; page.on("pageerror", (e) => errors.push(String(e).slice(0, 200)));
const has = async (probes) => { const t = await page.evaluate(() => document.body.innerText); for (const p of probes) console.log("  ", p, new RegExp(p).test(t) ? "yes" : "NO"); };
// 1. Edit the outcome's assumption in place.
await page.goto(`${BASE}/projects/${T}/logframe`, { waitUntil: "networkidle" });
const row = page.locator("li[role=treeitem]").filter({ hasText: "Households use safe drinking water" }).first();
await row.getByRole("button", { name: /^edit$/i }).first().click();
const form = page.getByRole("group", { name: /Edit Households/ });
await form.getByLabel(/^Assumptions/).fill("Water sources stay free of flood contamination and spare parts are available");
await page.screenshot({ path: `${S}/12-edit-open.png`, fullPage: true });
await form.getByRole("button", { name: /^save$/i }).click();
await page.waitForTimeout(2500);
console.log("1. edit in place"); await has(["Assumes: Water sources stay free of flood contamination and spare parts"]);
// 2. History chips.
await page.goto(`${BASE}/projects/${T}/logframe/history`, { waitUntil: "networkidle" });
await page.screenshot({ path: `${S}/13-history.png`, fullPage: true });
console.log("2. history"); await has(["Results or reasoning changed", "Measurement changed", "assumptions changed"]);
// 3. Wording USAID.
await page.goto(`${BASE}/projects/${T}/setup/profile`, { waitUntil: "networkidle" });
const sel = page.getByLabel("Donor wording");
await sel.selectOption("USAID");
await page.getByRole("button", { name: /save wording/i }).click();
await page.waitForTimeout(2500);
await page.screenshot({ path: `${S}/14-wording.png`, fullPage: true });
console.log("3. wording saved"); await has(["Saved\\."]);
await page.goto(`${BASE}/projects/${T}/logframe`, { waitUntil: "networkidle" });
await page.screenshot({ path: `${S}/15-tree-usaid.png`, fullPage: true });
console.log("   tree words"); await has(["Goal → Intermediate Result → Sub-Intermediate Result → Activity", "Intermediate Result\\s", "Sub-Intermediate Result"]);
await page.goto(`${BASE}/projects/${T}/logframe?view=RESULTS`, { waitUntil: "networkidle" });
await page.screenshot({ path: `${S}/16-lens-usaid.png`, fullPage: true });
console.log("   lens"); await has(["Results Framework", "Safe water lowers diarrhoeal"]);
const r = await page.request.get(`${BASE}/api/projects/${T}/framework/export?lens=RESULTS&format=docx`);
console.log("   download", r.status(), r.headers()["content-disposition"]);
await page.goto(`${BASE}/projects/${T}`, { waitUntil: "networkidle" });
console.log("   overview counts"); await has(["Intermediate Result: 1", "Sub-Intermediate Result: 1"]);
console.log("errors:", errors.length ? errors : "none");
process.exit(0);
