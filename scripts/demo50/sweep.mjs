import fs from "node:fs";
import { attach, BASE } from "../demo-ui/lib.mjs";
const P = "/projects/cd291c72-ebc9-4f16-8633-b7c9007507ed", Q = "/projects/14d6f13d-34ee-47ef-9d64-d16595e3e690", R = Q + "/reports/e8df4e42-7295-4f43-b34b-1018f2b4275f";
const MAP = {
 "invite-team-members": ["/team"], "manage-team-roles-permissions": ["/team"], "set-up-programmes-and-grants": ["/programmes"],
 "use-compliance-checklist": [Q + "/compliance", "/compliance"], "review-and-accept-activities": [P + "/activities?view=completed"],
 "collect-answers-with-a-form": [P + "/forms"], "use-the-field-app-offline": ["/field"], "ask-a-question-about-a-project": [P + "/ask"],
 "connect-api-keys-webhooks-and-ai-assistants": ["/settings/integrations"], "turn-on-two-step-sign-in": ["/settings/security"], "require-two-step-sign-in": ["/settings/security"],
 "check-your-portfolio": ["/portfolio", "/portfolio/indicators"], "use-the-notification-system": ["/dashboard"], "search-projects-and-evidence": ["/projects"],
 "manage-billing-subscription": ["/settings/billing"], "review-evidence": [P + "/evidence"], "upload-evidence": [P + "/evidence", P + "/evidence/new"],
 "plan-your-activities": [P + "/activities", P + "/activities/plan/new"], "use-the-timeline": [P + "/activities"], "use-my-week": ["/my-work"], "ask-for-work-and-use-my-work": ["/my-work"],
 "record-problems-and-risks": [P], "record-a-change-of-plan": [P + "/adaptations"], "get-a-management-report": [P + "/management-report"], "track-dependencies-budget-and-people-reached": [P + "/beneficiaries", P + "/finance"],
 "export-reports": [R], "review-and-approve-reports": [R], "use-the-report-builder": [P + "/data"], "use-the-chart-studio": ["/visuals/charts"], "see-your-work-on-a-map": [P + "/activities", "/visuals/maps"],
 "archive-a-project": [P + "/settings"], "change-organisation-profile": ["/settings"], "connect-google-drive": ["/settings/setup"], "upload-donor-template": [P + "/templates"],
 "match-donor-indicators": [P + "/templates"], "meet-donor-requirements": ["/settings/requirement-packs"], "take-your-data-with-you": ["/settings"], "see-framework-history": [P + "/logframe/history"],
 "fix-or-remove-an-indicator": [P + "/logframe"], "set-a-target-schedule": [P + "/logframe"], "set-up-a-data-alert": ["/visuals/alerts"], "use-the-academy-tour": ["/support"],
 "pin-dashboards-and-arrange-home": ["/dashboard"], "start-a-dashboard-from-a-template": ["/visuals/templates"], "use-the-visual-studio": ["/visuals"], "make-an-infographic": ["/visuals/assets?project=" + P.split("/")[2]],
 "invite-an-outside-partner": ["/team"], "create-the-closing-report": [P + "/reports"], "reopen-an-approved-report": [R], "use-the-data-center": [P + "/data"], "add-fields-and-automatic-reminders": [P + "/team"],
 "change-the-interface-language": ["/dashboard"], "use-bulk-actions": [P + "/evidence"], "use-the-dashboard": ["/dashboard"], "set-up-new-organisation": ["/settings/setup"],
};
const { page, browser } = await attach("sweep");
const out = {};
const seen = {};
for (const urls of Object.values(MAP)) for (const u of urls) if (!(u in seen)) {
  try { await page.goto(BASE + u, { waitUntil: "domcontentloaded", timeout: 45000 }); await page.waitForTimeout(3500); seen[u] = (await page.locator("body").innerText({ timeout: 15000 })).replace(/\s+/g, " ").toLowerCase() + " " + (await page.locator("button,a,[role=tab],option,label,input").evaluateAll((e) => e.map((x) => (x.innerText || x.getAttribute("aria-label") || x.placeholder || x.value || "").toLowerCase()).join(" "))); }
  catch (e) { seen[u] = "ERR " + String(e).slice(0, 60); }
}
fs.writeFileSync(process.argv[2] + ".seen", JSON.stringify(seen));
for (const [slug, urls] of Object.entries(MAP)) {
  const p1 = `apps/web/content/support/how-to/how-to-${slug}.md`, p2 = `apps/web/content/support/how-to-${slug}.md`;
  const md = fs.readFileSync(fs.existsSync(p1) ? p1 : p2, "utf8");
  const labs = [...new Set([...md.matchAll(/\*\*([^*\n]{3,50})\*\*/g)].map((m) => m[1].replace(/[:.]$/, "")))].filter((l) => !/→|\//.test(l));
  const hay = urls.map((u) => seen[u]).join(" ");
  const miss = labs.filter((l) => !hay.includes(l.toLowerCase()));
  out[slug] = { urls, errs: urls.filter((u) => seen[u].startsWith("ERR")), total: labs.length, miss };
}
fs.writeFileSync(process.argv[2], JSON.stringify(out, null, 1));
await browser.close(); process.exit(0);
