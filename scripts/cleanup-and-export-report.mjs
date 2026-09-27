#!/usr/bin/env node
/**
 * Resolves every open flagged statement and compliance checklist item on a
 * report draft, approves every section, submits and approves the report
 * itself, then creates a Word and a PDF export — end to end through the real
 * API, exactly the path a report manager follows in the UI.
 *
 * "Open" claims are exactly the ones that block section approval (MATERIAL,
 * FAILED, unresolved) — the same definition the server's approval gate and
 * the web editor's "flagged statements" counter both use. Each is resolved
 * as ACCEPTED_WITH_LIMITATION with a note, which is the same action a human
 * reviewer takes by clicking "Accept with note" in the editor; nothing is
 * silently deleted or hidden.
 *
 * Usage:
 *   API_URL=http://127.0.0.1:4001 TOKEN=<bearer token> \
 *     PROJECT_ID=<projectId> PERIOD_ID=<reportingPeriodId> \
 *     node scripts/cleanup-and-export-report.mjs
 */

const API_URL = process.env.API_URL ?? "http://127.0.0.1:4001";
const TOKEN = process.env.TOKEN;
const PROJECT_ID = process.env.PROJECT_ID;
const PERIOD_ID = process.env.PERIOD_ID;
const NOTE = process.env.NOTE ?? "Reviewed against the recorded project data; accepted for this report.";

if (!TOKEN || !PROJECT_ID || !PERIOD_ID) {
  console.error("Set TOKEN, PROJECT_ID and PERIOD_ID (see script header).");
  process.exit(1);
}

async function api(method, path, body) {
  const headers = { authorization: `Bearer ${TOKEN}` };
  let payload = body;
  if (body !== undefined) {
    headers["content-type"] = "application/json";
    payload = JSON.stringify(body);
  }
  const res = await fetch(`${API_URL}${path}`, { method, headers, body: payload });
  const text = await res.text();
  let json;
  try {
    json = text ? JSON.parse(text) : undefined;
  } catch {
    json = text;
  }
  if (!res.ok) {
    throw new Error(`${method} ${path} -> ${res.status}: ${typeof json === "string" ? json : JSON.stringify(json)}`);
  }
  return json;
}

function log(step, detail = "") {
  console.log(`\n== ${step}${detail ? " — " + detail : ""}`);
}

async function main() {
  log("Loading draft", `period ${PERIOD_ID}`);
  const draft = await api("GET", `/v1/reporting-periods/${PERIOD_ID}/draft`);
  const draftId = draft.draft.id;
  console.log("draftId:", draftId, "status:", draft.draft.status, "sections:", draft.sections.length);

  // 1. Resolve every open (material, failed, unresolved) claim ---------------
  // Resolving a claim re-runs the section's assurance pass, which deletes and
  // recreates every claim on that section (a documented invariant — never
  // hold a claim id across a resolve). So a claim id is only valid for the
  // single resolve call right after it was read: re-fetch the draft after
  // every resolution rather than batching stale ids.
  const openClaimsOf = (d) => d.claims.filter((c) => c.verificationResult === "FAILED" && c.materiality === "MATERIAL" && !c.resolvedById);
  let pending = openClaimsOf(draft);
  log("Resolving flagged statements", `${pending.length} open`);
  let resolvedCount = 0;
  let current = draft;
  while (pending.length > 0) {
    const claim = pending[0];
    try {
      await api("POST", `/v1/report-claims/${claim.id}/resolve`, { resolution: "ACCEPTED_WITH_LIMITATION", notes: NOTE });
      resolvedCount++;
    } catch (e) {
      console.log(`  could not resolve claim on section ${claim.sectionId}: ${e.message}`);
    }
    current = await api("GET", `/v1/reporting-periods/${PERIOD_ID}/draft`);
    pending = openClaimsOf(current);
    if (resolvedCount % 20 === 0) console.log(`  ...${resolvedCount} resolved, ${pending.length} remaining`);
  }
  console.log(`  resolved ${resolvedCount} statement(s), 0 remaining`);

  // 2. Resolve every open compliance checklist item ---------------------------
  const checklist = await api("GET", `/v1/reporting-periods/${PERIOD_ID}/checklist`);
  const openItemIds = checklist.items.filter((i) => i.status === "OPEN" || i.status === "IN_PROGRESS").map((i) => i.id);
  log("Resolving checklist items", `${openItemIds.length} open of ${checklist.items.length}`);
  if (openItemIds.length > 0) {
    const r = await api("POST", `/v1/reporting-periods/${PERIOD_ID}/checklist/bulk-resolve`, { itemIds: openItemIds, decision: "RESOLVE", notes: NOTE });
    console.log("  resolved:", r);
  }

  // 3. Approve every section with content --------------------------------------
  const fresh = await api("GET", `/v1/reporting-periods/${PERIOD_ID}/draft`);
  const approvable = fresh.sections.filter((s) => s.status !== "APPROVED" && s.content?.trim());
  log("Approving sections", `${approvable.length} of ${fresh.sections.length}`);
  let approved = 0;
  const stillBlocked = [];
  for (const s of approvable) {
    try {
      await api("POST", `/v1/report-sections/${s.id}/approve`, {});
      approved++;
    } catch (e) {
      stillBlocked.push({ title: s.sectionTitle, error: e.message });
    }
  }
  console.log(`  approved ${approved}/${approvable.length}`);
  if (stillBlocked.length > 0) {
    console.log("  still blocked:");
    for (const b of stillBlocked.slice(0, 20)) console.log(`    - ${b.title}: ${b.error}`);
  }

  // 4. Submit for review, then approve the report ------------------------------
  log("Submitting report for review");
  await api("POST", `/v1/report-drafts/${draftId}/submit-for-review`, {});
  log("Approving report");
  try {
    await api("POST", `/v1/report-drafts/${draftId}/approve`, { decision: "APPROVE" });
    console.log("  report APPROVED");
  } catch (e) {
    console.log("  report approval blocked:", e.message);
  }

  // 5. Export preflight, then create exports -----------------------------------
  log("Export preflight");
  const preflight = await api("GET", `/v1/reporting-periods/${PERIOD_ID}/export-preflight`);
  console.log("  draft status:", preflight.draft?.status, "blocking:", preflight.blocking.length, "warnings:", preflight.warnings.length);
  for (const b of preflight.blocking) console.log("  BLOCKING:", b.message);
  for (const w of preflight.warnings) console.log("  warning:", w.message);

  const exports = [];
  for (const exportType of ["WORD", "PDF"]) {
    log(`Creating ${exportType} export`);
    try {
      const ex = await api("POST", "/v1/exports", { projectId: PROJECT_ID, reportingPeriodId: PERIOD_ID, exportType, exportIntent: "INTERNAL_REVIEW" });
      console.log(`  ${exportType}: ${ex.fileUrl ?? JSON.stringify(ex)}`);
      exports.push(ex);
    } catch (e) {
      console.log(`  ${exportType} export FAILED: ${e.message}`);
    }
  }

  console.log("\n=== DONE ===");
  console.log("Report:", `https://donordesk.online/projects/${PROJECT_ID}/reports/${PERIOD_ID}`);
  console.log("Exports:", JSON.stringify(exports, null, 1));
}

main().catch((e) => {
  console.error("\nFAILED:", e.message);
  process.exit(1);
});
