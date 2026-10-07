import { attach, BASE } from "../demo-ui/lib.mjs"; import { readFileSync } from "node:fs";
const P = readFileSync("pid.txt","utf8").trim(); const id = readFileSync("periods.txt","utf8").trim().split("\n").pop();
const T = {
 "Sustainability": "Sustainability: the five DHMTs adopted the quarterly scorecard in their budget and review agendas; trained health workers, CHVs and DHMT staff remain in post with the Ghana Health Service; solar vaccine fridges and delivery kits were handed over with signed certificates; NHIS enrolment drives continue under the district NHIA offices.",
 "Risks and Assumptions": "Assumptions held: DHMT commitment, availability of vaccines and trained staff, and road access in the dry season. Risks that materialised: a national Penta vaccine shortage in February, nurses' and CHO industrial action for about two weeks in May, flooding and the lean season in Savelugu and Nanton in July and August, and a customs delay on the last equipment shipment in August. Mitigation: recall lists, mobile teams, re-planned outreach routes and weekly follow-up with the clearing agent.",
 "Sustainability and Exit Strategy": "Exit: handover meetings were held in each of the five districts before staff contracts ended; scorecard templates, supervision checklists, training materials and the equipment register were transferred to the District Directors of Health Services; the Regional Health Directorate received the final data-use dashboard; no assets remain with the implementer.",
};
const { page, browser } = await attach("storyfinal");
await page.goto(`${BASE}/projects/${P}/reports/${id}/inputs?tab=story`); await page.waitForLoadState("networkidle"); await page.waitForTimeout(1500);
for (const [k, v] of Object.entries(T)) { const ta = page.locator("main textarea").filter({ has: page.locator(":scope") }).nth(0); }
const tas = page.locator("main textarea"); const n = await tas.count();
for (let i = 5; i < n; i++) { const name = (await tas.nth(i).evaluate(e => (e.getAttribute("aria-label") || e.closest("div")?.querySelector("label")?.textContent || "").replace(/To do$/, "").trim())); const key = Object.keys(T).find(k => name === k); console.log(i, JSON.stringify(name).slice(0,60), key); if (key) { await tas.nth(i).fill(T[key]); await tas.nth(i).blur(); await page.waitForTimeout(3000); } }
await page.waitForTimeout(2500); console.log((await page.locator("main").innerText()).replace(/\n+/g," | ").match(/\d\/\d answered[^|]*|\d statements? (is|are) still to do/g));
await browser.close(); process.exit(0);
