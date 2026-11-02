/**
 * Draft operations (Phase 38): the pure edits a slide makes. One operation is one row in `DRAFT_OPERATIONS`, typed so a kind
 * without a function does not compile; a new edit is a new member of `SetupOperation` and a new row, never a branch in the
 * dispatcher. Every operation returns a new draft and never changes the one it was given; a refused change says why in a
 * sentence. Operations on the document-derived proposal (accept, reject, edit, move) stay in `proposal-edit.ts` and
 * `review-operations.ts` — this file holds only what the wizard adds.
 */
import { planKeyOf, SUPPORT_LINE } from "./draft.js";
import { live } from "./requirements/shared.js";
import type { CollectionSetup, DraftPerson, FinanceExtras, IndicatorSetup, PlanSetup, ScheduleSetup, SetupDraft, SetupStart } from "./draft.js";
import { SETUP_REQUIREMENTS } from "./requirements/index.js";
import { SECTOR_TEMPLATES } from "../../dashboards/sector-templates.js";
import { ALL_REPORT_TYPES } from "../../reporting/default-template.js";
import { suggestBudgetLinks } from "./suggesters/budget-links.js";
import { suggestMethods } from "./suggesters/collection-method.js";
import { suggestSetupLinks, type SetupLinkSuggestion } from "./suggesters/plan-links.js";

export type SetupOperation =
  | { kind: "SET_START"; patch: Partial<Pick<SetupStart, "donor" | "sector" | "country" | "packId">> }
  | { kind: "ADD_PERSON"; person: DraftPerson }
  | { kind: "UPDATE_PERSON"; key: string; patch: Partial<Omit<DraftPerson, "key">> }
  | { kind: "REMOVE_PERSON"; key: string }
  | { kind: "SET_INDICATOR_SETUP"; code: string; patch: Partial<IndicatorSetup> }
  | { kind: "SET_PLAN_SETUP"; planKey: string; patch: Partial<PlanSetup> }
  | { kind: "SET_PLACES_SETUP"; patch: { projectArea?: string | null; boundaryLevel?: number | null } }
  | { kind: "SET_COLLECTION"; patch: Partial<CollectionSetup> }
  | { kind: "SET_SCHEDULE"; patch: Partial<ScheduleSetup> }
  | { kind: "SET_FINANCE"; patch: Partial<FinanceExtras> }
  | { kind: "CONFIRM_CODES"; codes: string[] }
  | { kind: "ANSWER_NOT_USED"; requirement: string; reason?: string }
  | { kind: "REOPEN_REQUIREMENT"; requirement: string }
  | { kind: "REJECT_SUGGESTION"; id: string }
  | { kind: "ACCEPT_SUGGESTIONS"; ids: string[] }
  | { kind: "ACCEPT_METHOD_SUGGESTIONS"; ids: string[] }
  | { kind: "ACCEPT_BUDGET_SUGGESTIONS"; ids: string[] }
  | { kind: "SET_DASHBOARD"; templateKey: string | null };

export type OperationResult = { ok: true; draft: SetupDraft } | { ok: false; reason: string };

type Handler<K extends SetupOperation["kind"]> = (draft: SetupDraft, op: Extract<SetupOperation, { kind: K }>) => OperationResult;

const done = (draft: SetupDraft): OperationResult => ({ ok: true, draft });
const refuse = (reason: string): OperationResult => ({ ok: false, reason });
const withExtras = (draft: SetupDraft, change: Partial<SetupDraft["extras"]>): OperationResult => done({ ...draft, extras: { ...draft.extras, ...change } });

/** The reporting frequencies a project can choose. */
const CADENCES: readonly string[] = ["MONTHLY", "QUARTERLY", "SEMI_ANNUAL", "ANNUAL"];

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Where a person is named, so removing them never leaves a dangling owner, lead or approver. */
export function personReferences(draft: SetupDraft, key: string): string[] {
  const e = draft.extras;
  const where: string[] = [];
  if (Object.values(e.indicatorSetup).some((s) => s.ownerKey === key)) where.push("an indicator owner");
  if (Object.values(e.planSetup).some((s) => s.leadKey === key)) where.push("an activity lead");
  return where;
}

const emailProblem = (email: string | null | undefined): string | null => (email === null || email === undefined || EMAIL.test(email) ? null : "That email address does not look right.");

export const DRAFT_OPERATIONS: { [K in SetupOperation["kind"]]: Handler<K> } = {
  SET_START: (d, op) => withExtras(d, { start: { ...d.extras.start, ...op.patch } }),
  ADD_PERSON: (d, { person }) => {
    if (!person.key.trim() || !person.name.trim()) return refuse("A person needs a name.");
    if (d.extras.team.some((p) => p.key === person.key)) return refuse("That person is already on the team.");
    const bad = emailProblem(person.email);
    if (bad) return refuse(bad);
    if (person.invite === "NOW" && !person.email) return refuse("To invite someone now, give an email address; otherwise choose to invite later.");
    return withExtras(d, { team: [...d.extras.team, person] });
  },
  UPDATE_PERSON: (d, { key, patch }) => {
    const person = d.extras.team.find((p) => p.key === key);
    if (!person) return refuse("That person is not on the team.");
    const next = { ...person, ...patch };
    const bad = emailProblem(next.email);
    if (bad) return refuse(bad);
    if (next.invite === "NOW" && !next.email) return refuse("To invite someone now, give an email address; otherwise choose to invite later.");
    return withExtras(d, { team: d.extras.team.map((p) => (p.key === key ? next : p)) });
  },
  REMOVE_PERSON: (d, { key }) => {
    if (!d.extras.team.some((p) => p.key === key)) return refuse("That person is not on the team.");
    const where = personReferences(d, key);
    if (where.length > 0) return refuse(`They are still ${where.join(", ")}. Choose someone else there first.`);
    return withExtras(d, { team: d.extras.team.filter((p) => p.key !== key) });
  },
  SET_INDICATOR_SETUP: (d, { code, patch }) => {
    if (patch.ownerKey !== undefined && !d.extras.team.some((p) => p.key === patch.ownerKey)) return refuse("The owner has to be someone on the team.");
    return withExtras(d, { indicatorSetup: { ...d.extras.indicatorSetup, [code]: { ...d.extras.indicatorSetup[code], ...patch } } });
  },
  SET_PLAN_SETUP: (d, { planKey, patch }) => {
    if (patch.leadKey !== undefined && !d.extras.team.some((p) => p.key === patch.leadKey)) return refuse("The lead has to be someone on the team.");
    const base: PlanSetup = d.extras.planSetup[planKey] ?? { placeNames: [], projectWide: false, indicatorCodes: [], requiredFiles: [], recordsParticipants: false };
    return withExtras(d, { planSetup: { ...d.extras.planSetup, [planKey]: { ...base, ...patch } } });
  },
  SET_PLACES_SETUP: (d, { patch }) => {
    const level = patch.boundaryLevel;
    if (level !== undefined && level !== null && !(Number.isInteger(level) && level >= 0 && level <= 4)) return refuse("Choose what kind of boundaries to show.");
    const next = { ...d.extras };
    if (patch.projectArea !== undefined) { const area = patch.projectArea?.trim(); if (area) next.projectArea = area; else delete next.projectArea; }
    if (level !== undefined) { if (level === null) delete next.boundaryLevel; else next.boundaryLevel = level; }
    return done({ ...d, extras: next });
  },
  SET_COLLECTION: (d, { patch }) => {
    const rule = patch.windowRule;
    if (rule && (rule.opensDaysBefore < 0 || rule.closesDaysAfter < 0)) return refuse("The entry window cannot start or end before zero days.");
    return withExtras(d, { collection: { ...d.extras.collection, ...patch } });
  },
  SET_SCHEDULE: (d, { patch }) => {
    if (patch.cadence !== undefined && !CADENCES.includes(patch.cadence)) return refuse("Choose monthly, quarterly, semi-annual or annual.");
    if (patch.rules !== undefined) {
      const types = patch.rules.map((r) => r.reportType);
      if (types.some((t) => !ALL_REPORT_TYPES.includes(t))) return refuse("That kind of report does not exist.");
      if (new Set(types).size !== types.length) return refuse("Each kind of report is listed once.");
      for (const r of patch.rules) {
        if (r.dueDaysAfterEnd !== null && !(Number.isInteger(r.dueDaysAfterEnd) && r.dueDaysAfterEnd >= 0 && r.dueDaysAfterEnd <= 365)) return refuse("Days until a report is due is a whole number from 0 to 365.");
      }
    }
    return withExtras(d, { schedule: { ...d.extras.schedule, ...patch } });
  },
  SET_FINANCE: (d, { patch }) => {
    if (patch.reportingCurrency !== undefined && !/^[A-Z]{3}$/.test(patch.reportingCurrency)) return refuse("A currency is three letters, for example USD.");
    if (patch.budgetPlan !== undefined) {
      const targets = new Set([SUPPORT_LINE, ...live(d.proposal.plan).map((def) => planKeyOf(def))]);
      if (Object.values(patch.budgetPlan).some((t) => !targets.has(t))) return refuse("A budget line goes with one of the planned activities, or is a support cost.");
    }
    return withExtras(d, { finance: { ...d.extras.finance, ...patch } });
  },
  CONFIRM_CODES: (d, { codes }) => withExtras(d, { confirmedGeneratedCodes: [...new Set([...d.extras.confirmedGeneratedCodes, ...codes])] }),
  ANSWER_NOT_USED: (d, { requirement, reason }) => {
    const def = SETUP_REQUIREMENTS.find((r) => r.key === requirement);
    if (!def) return refuse("That is not something this wizard asks.");
    if (!def.allowsNotUsed) return refuse("This one cannot be left out: the project needs it.");
    const answer = reason?.trim() ? { notUsed: true as const, reason: reason.trim() } : { notUsed: true as const };
    return withExtras(d, { answers: { ...d.extras.answers, [requirement]: answer } });
  },
  REOPEN_REQUIREMENT: (d, { requirement }) => {
    const { [requirement]: _removed, ...rest } = d.extras.answers;
    void _removed;
    return withExtras(d, { answers: rest });
  },
  // Applies the offered links the person chose. Anything no longer offered is refused, so a stale screen never links the wrong thing.
  ACCEPT_SUGGESTIONS: (d, { ids }) => {
    const offered = new Map(suggestSetupLinks(d).map((s) => [s.id, s] as const));
    const chosen: SetupLinkSuggestion[] = [];
    for (const id of ids) {
      const s = offered.get(id);
      if (!s) return refuse("One of those suggestions is no longer offered. Look at the list again.");
      chosen.push(s);
    }
    const planSetup = { ...d.extras.planSetup };
    for (const s of chosen) {
      const base: PlanSetup = planSetup[s.planKey] ?? { placeNames: [], projectWide: false, indicatorCodes: [], requiredFiles: [], recordsParticipants: false };
      planSetup[s.planKey] =
        s.kind === "INDICATOR" ? { ...base, indicatorCodes: [...new Set([...base.indicatorCodes, s.value])] }
        : s.kind === "PLACE" ? { ...base, placeNames: [...new Set([...base.placeNames, s.value])], projectWide: false }
        : { ...base, leadKey: s.value };
    }
    return withExtras(d, { planSetup });
  },
  // Sets the method of each indicator the person chose from what is offered; a stale or repeated id is refused.
  ACCEPT_METHOD_SUGGESTIONS: (d, { ids }) => {
    const offered = new Map(suggestMethods(d).map((s) => [s.id, s] as const));
    const indicatorSetup = { ...d.extras.indicatorSetup };
    for (const id of ids) {
      const s = offered.get(id);
      if (!s) return refuse("One of those suggestions is no longer offered. Look at the list again.");
      indicatorSetup[s.indicatorCode] = { ...indicatorSetup[s.indicatorCode], method: s.method };
    }
    return withExtras(d, { indicatorSetup });
  },
  // Places the budget lines the person chose from what is offered; a stale or repeated id is refused.
  ACCEPT_BUDGET_SUGGESTIONS: (d, { ids }) => {
    const offered = new Map(suggestBudgetLinks(d).map((s) => [s.id, s] as const));
    const budgetPlan = { ...d.extras.finance.budgetPlan };
    for (const id of ids) {
      const s = offered.get(id);
      if (!s) return refuse("One of those suggestions is no longer offered. Look at the list again.");
      budgetPlan[s.budgetKey] = s.target;
    }
    return withExtras(d, { finance: { ...d.extras.finance, budgetPlan } });
  },
  REJECT_SUGGESTION: (d, { id }) => withExtras(d, { rejectedSuggestions: [...new Set([...d.extras.rejectedSuggestions, id])] }),
  SET_DASHBOARD: (d, { templateKey }) => {
    if (templateKey !== null && !SECTOR_TEMPLATES.some((t) => t.id === templateKey)) return refuse("Choose one of the starting dashboards.");
    const next = { ...d.extras };
    if (templateKey === null) delete next.dashboardTemplate; else next.dashboardTemplate = templateKey;
    return done({ ...d, extras: next });
  },
};

export function applyOperation(draft: SetupDraft, op: SetupOperation): OperationResult {
  const handler = DRAFT_OPERATIONS[op.kind] as (d: SetupDraft, o: SetupOperation) => OperationResult;
  return handler(draft, op);
}
