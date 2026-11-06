// Phase 38.9: the Launch slide's pure rules.
import test from "node:test";
import assert from "node:assert/strict";
import { RISK_KIND_LABEL as DOMAIN_LABELS, RISK_KINDS as DOMAIN_KINDS, SERIOUSNESS_LEVELS } from "@donordesk/domain";
import { RISK_KIND_LABEL, RISK_KINDS, SERIOUSNESS, blockerSentences, canSignOff, groupedRisks, isSignedOffNow, riskKindLabel, signedDay } from "../../src/features/project-setup/pcw/domain/launch-view.ts";
import { PCW_COPY } from "../../src/features/project-setup/pcw/copy.ts";
import { findRawTokens } from "@donordesk/domain/core/copy-lint.js";

const risk = (kind: string, title = "t") => ({ path: "risks.0", status: "EDITED", origin: "USER", quote: null, value: { kind, title, seriousness: null, mitigation: null } });
const view = (extra = {}) => ({ risks: [risk("RISK", "a"), risk("ASSUMPTION", "b"), risk("PROBLEM", "c")], launch: { ok: false, blockers: [] }, extras: { signOff: {} }, ...extra }) as never;

test("the kinds of entry are the real ones, in the same words the risks list uses", () => {
  assert.deepEqual([...RISK_KINDS].sort(), [...DOMAIN_KINDS].sort());
  for (const k of DOMAIN_KINDS) assert.equal(RISK_KIND_LABEL[k as keyof typeof RISK_KIND_LABEL], DOMAIN_LABELS[k]);
  assert.deepEqual([...SERIOUSNESS], [...SERIOUSNESS_LEVELS]);
  assert.equal(riskKindLabel("ASSUMPTION"), "We are assuming");
  assert.equal(riskKindLabel("ODD"), "Kind not set");
  assert.equal(riskKindLabel(null), "Kind not set");
});

test("assumptions are separated from the other entries", () => {
  const g = groupedRisks(view());
  assert.deepEqual(g.assumptions.map((r) => r.value.title), ["b"]);
  assert.deepEqual(g.others.map((r) => r.value.title), ["a", "c"]);
});

test("what stops the project is said in words; nothing stopping says nothing", () => {
  const words = PCW_COPY.launch;
  const sentences = blockerSentences(view({ launch: { ok: false, blockers: [{ kind: "OPEN_REQUIREMENTS", count: 3 }, { kind: "SIGN_OFF_MISSING" }] } }), words);
  assert.deepEqual(sentences, ["3 things are still to answer before you can sign off.", words.signHelp]);
  assert.deepEqual(blockerSentences(view({ launch: { ok: false, blockers: [{ kind: "SIGN_OFF_STALE" }] } }), words), [words.signedStale]);
  assert.deepEqual(blockerSentences(view({ launch: { ok: true, blockers: [] } }), words), []);
  assert.equal(words.blocked(1), "1 thing is still to answer before you can sign off.");
});

test("sign-off is offered only when nothing is open, and is current unless it went stale", () => {
  assert.equal(canSignOff(view({ launch: { ok: false, blockers: [{ kind: "OPEN_REQUIREMENTS", count: 1 }] } })), false);
  assert.equal(canSignOff(view({ launch: { ok: false, blockers: [{ kind: "SIGN_OFF_MISSING" }] } })), true);
  assert.equal(isSignedOffNow(view({ extras: { signOff: { byUserId: "u" } }, launch: { ok: true, blockers: [] } })), true);
  assert.equal(isSignedOffNow(view({ extras: { signOff: { byUserId: "u" } }, launch: { ok: false, blockers: [{ kind: "SIGN_OFF_STALE" }] } })), false);
  assert.equal(isSignedOffNow(view()), false);
});

test("the signed day reads the same everywhere, and a bad one is empty", () => {
  assert.equal(signedDay("2026-11-02T23:30:00.000Z"), "2 Nov 2026");
  assert.equal(signedDay(undefined), "");
  assert.equal(signedDay("nope"), "");
});

test("the words on this slide are plain language", () => {
  const c = PCW_COPY.launch;
  const texts = [...Object.values(c).filter((v): v is string => typeof v === "string"), ...Object.values(c.serious), c.count(1, "result", "results"), c.count(3, "result", "results"), c.fromDocs(1, 1), c.fromDocs(3, 2), c.signedBy("2 Nov 2026"), c.blocked(2), ...Object.values(RISK_KIND_LABEL)];
  for (const t of texts) assert.deepEqual(findRawTokens(t), [], t);
});

// ---------- the launch report ----------

import { isStarted, reportRows, startedProjectId } from "../../src/features/project-setup/pcw/domain/launch-view.ts";

const report = (extra = {}) => ({
  projectId: "p1", status: "PARTIAL",
  areas: [{ area: "FACTS", status: "APPLIED", created: 1, skipped: 0, notes: [] }, { area: "PLAN", status: "FAILED", created: 0, skipped: 0, notes: [], error: "Folders still being prepared" }, { area: "PLACES", status: "NOT_RUN", created: 0, skipped: 0, notes: [] }],
  steps: [{ key: "FORMS", label: "Draft forms for field collection", status: "DONE", done: 1, notes: ["I2: a rate cannot have a form."] }],
  notWritten: ["2 indicator owners: set them later."], ...extra,
}) as never;

test("the report reads as rows in words: what was made, what did not finish, and the sentences that explain", () => {
  const rows = reportRows(report(), PCW_COPY.launch);
  assert.deepEqual(rows.map((r) => [r.name, r.state, r.failed]), [["Project details", "Done", false], ["Work plan", "Did not finish", true], ["Places", "Not started", false], ["Draft forms for field collection", "Done", false]]);
  assert.deepEqual(rows[1]!.detail, ["Folders still being prepared"]);
  assert.deepEqual(rows[3]!.detail, ["I2: a rate cannot have a form."]);
});

test("every state a report can hold has a name a person can read", () => {
  for (const key of ["APPLIED", "ALREADY_APPLIED", "DONE", "ALREADY_DONE", "FAILED", "NOT_RUN"]) assert.ok(PCW_COPY.launch.state[key], key);
  for (const key of ["FACTS", "LOGFRAME", "INDICATORS", "PERIODS", "PLAN", "PLACES", "FUNDING_BUDGET", "RISKS"]) assert.ok(PCW_COPY.launch.areaLabel[key], key);
  for (const t of [...Object.values(PCW_COPY.launch.state), ...Object.values(PCW_COPY.launch.areaLabel), PCW_COPY.launch.started, PCW_COPY.launch.partial, PCW_COPY.launch.startHelp]) assert.deepEqual(findRawTokens(t), [], t);
});

test("the project counts as started from the report just received or from the page after a reload", () => {
  const draft = (extra = {}) => ({ status: "READY", appliedProjectId: null, ...extra }) as never;
  assert.equal(isStarted(draft(), null), false);
  assert.equal(isStarted(draft(), report({ status: "LAUNCHED" })), true);
  assert.equal(isStarted(draft(), report()), false, "a launch that stopped partway is not started");
  assert.equal(isStarted(draft({ status: "APPLIED", appliedProjectId: "p2" }), null), true);
  assert.equal(isStarted(draft({ status: "PARTIAL", appliedProjectId: "p2" }), null), false);
  assert.equal(startedProjectId(draft({ appliedProjectId: "p2" }), null), "p2");
  assert.equal(startedProjectId(draft({ appliedProjectId: "p2" }), report({ projectId: "p3" })), "p3");
});
