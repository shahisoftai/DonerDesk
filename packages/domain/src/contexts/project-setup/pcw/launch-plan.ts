/**
 * What launching needs from the draft (Phase 38.9b), all pure: the project to create, the entry window of each period, the
 * wizard's own steps in order, and an honest list of what the draft holds that launching does not write yet. Nothing here
 * reaches outside the draft; the people the project is created with come in as a lookup of email to user id.
 */
import { SECTORS } from "../../identity/role.js";
import { addDays, type PlainDate } from "../../workplan/plain-date.js";
import { budgetKeyOf, planKeyOf, SUPPORT_LINE, type SetupDraft, type WindowRule } from "./draft.js";
import { budgetTotalRows } from "./finance-summary.js";
import { isLive, present } from "./requirements/shared.js";

/** The project as the create-project form takes it (the application checks it against the real schema). */
export interface LaunchProjectInput {
  title: string;
  projectCode: string;
  donorName: string;
  implementingOrganization: string;
  country: string;
  sector: string;
  startDate: string;
  endDate: string;
  budgetCurrency?: string;
  reportingFrequency: string;
  description?: string;
  projectManagerId: string;
  meOfficerId?: string;
}

export interface LaunchContext {
  organisationName: string;
  /** The person launching; the manager when the team's manager has no account yet. */
  userId: string;
  /** Lower-cased email -> user id, for team members who already have an account. */
  userIdByEmail: ReadonlyMap<string, string>;
}

const FREQUENCIES = ["MONTHLY", "QUARTERLY", "SEMI_ANNUAL", "ANNUAL"];
const midnight = (day: string): string => `${day}T00:00:00.000Z`;

export type LaunchProjectResult = { ok: true; input: LaunchProjectInput } | { ok: false; reason: string };

export function projectInputFromDraft(draft: SetupDraft, ctx: LaunchContext): LaunchProjectResult {
  const f = draft.proposal.facts;
  const s = draft.extras.start;
  const title = isLive(f.name) ? f.name.value : null;
  const code = isLive(f.code) ? f.code.value : null;
  const start = isLive(f.startDate) ? f.startDate.value : null;
  const end = isLive(f.endDate) ? f.endDate.value : null;
  const donor = s.donor ?? (isLive(f.donor) ? f.donor.value : null);
  const cadence = draft.extras.schedule.cadence ?? draft.proposal.periods.find((p) => isLive(p) && p.value?.type)?.value?.type ?? null;
  if (!title || !code || !start || !end) return { ok: false, reason: "The project needs a name, a code and start and end dates." };
  if (!present(donor)) return { ok: false, reason: "Say who the donor is." };
  if (!present(s.country)) return { ok: false, reason: "Choose the country the project works in." };
  if (!s.sector || !(SECTORS as string[]).includes(s.sector)) return { ok: false, reason: "Choose the sector the project belongs to." };
  if (!cadence || !FREQUENCIES.includes(cadence)) return { ok: false, reason: "Choose how often the project reports." };
  const emailOf = (role: string): string | undefined => draft.extras.team.find((p) => p.role === role && p.email)?.email?.toLowerCase();
  const idFor = (role: string): string | undefined => { const e = emailOf(role); return e ? ctx.userIdByEmail.get(e) : undefined; };
  const meOfficerId = idFor("ME_OFFICER");
  const currency = draft.extras.finance.reportingCurrency ?? (isLive(f.currency) ? f.currency.value : undefined);
  const summary = isLive(f.summary) ? f.summary.value : undefined;
  return {
    ok: true,
    input: {
      title, projectCode: code, donorName: (donor as string).trim(), implementingOrganization: ctx.organisationName, country: (s.country as string).trim(),
      sector: s.sector, startDate: midnight(start), endDate: midnight(end), reportingFrequency: cadence,
      projectManagerId: idFor("PROJECT_MANAGER") ?? ctx.userId,
      ...(currency ? { budgetCurrency: currency } : {}), ...(summary ? { description: summary.slice(0, 2000) } : {}), ...(meOfficerId ? { meOfficerId } : {}),
    },
  };
}

/** The days a period's entry opens and closes, from the rule and the period's last day. */
export function entryWindowFor(periodEnd: string, rule: WindowRule): { opensOn: PlainDate; closesOn: PlainDate } {
  const end = periodEnd.slice(0, 10) as PlainDate;
  return { opensOn: addDays(end, -rule.opensDaysBefore), closesOn: addDays(end, rule.closesDaysAfter) };
}

/**
 * The wizard's own steps after the project and its parts exist, in the order they run. The project is made as a draft, which the
 * product already treats as "not started"; the last step makes it active, so it is active only when everything before it worked.
 */
export const LAUNCH_STEPS = [
  { key: "REVIEW_MODE", label: "How values are checked" },
  { key: "ENTRY_WINDOWS", label: "When values can be entered" },
  { key: "FORMS", label: "Draft forms for field collection" },
  { key: "RESPONSIBILITIES", label: "Team members and who owns what" },
  { key: "BUDGET_LINES", label: "Budget lines on the planned activities" },
  { key: "DASHBOARD", label: "Starting dashboard" },
  { key: "INVITATIONS", label: "Invitations" },
  { key: "ACTIVATION", label: "Start the project" },
] as const;
export type LaunchStepKey = (typeof LAUNCH_STEPS)[number]["key"];

/**
 * What the draft holds that launching does not write yet. Each row says how to count it and what to tell the person; the report
 * shows the sentences so nothing is silently dropped. A row disappears from this table when a step starts writing it.
 */
const NOT_WRITTEN: ReadonlyArray<{ count: (d: SetupDraft) => number; say: (n: number) => string }> = [
  { count: (d) => budgetLinesForLaunch(d).support, say: (n) => `${n} budget line${n > 1 ? "s" : ""} that pay for the whole project: a budget line belongs to a planned activity, so add them there.` },
];

export function notWrittenAtLaunch(draft: SetupDraft): string[] {
  return NOT_WRITTEN.flatMap((row) => { const n = row.count(draft); return n > 0 ? [row.say(n)] : []; });
}

/**
 * The proposal the existing apply should write: the person's decisions folded into the fields it already writes. A planned
 * activity's place becomes its location text ("Gulu; Kitgum", or "Project-wide") unless the document already gave one. The
 * stored proposal is not changed; the launch hands this copy to the apply. A reporting period is stated from the chosen
 * frequency when none was read, because the apply makes the plan and the places only after the periods.
 */
export function proposalForLaunch(draft: SetupDraft): SetupDraft["proposal"] {
  const p = draft.proposal;
  const plan = p.plan.map((item) => {
    if (!isLive(item) || !item.value || (item.value.location ?? "").trim()) return item;
    const setup = draft.extras.planSetup[planKeyOf(item.value)];
    const where = setup ? (setup.projectWide ? "Project-wide" : setup.placeNames.join("; ")) : "";
    return where ? { ...item, value: { ...item.value, location: where } } : item;
  });
  // The existing apply makes reporting periods (and, after them, the plan and the places) only when a period is among the items.
  // A project built on the slides keeps its reporting frequency in the decisions, so it is stated here as an item.
  const cadence = draft.extras.schedule.cadence;
  const periods = !p.periods.some(isLive) && cadence
    ? [...p.periods, { value: { type: cadence, start: null, end: null }, sourceQuote: null, sourceRef: null, confidence: "HIGH" as const, status: "EDITED" as const }]
    : p.periods;
  return { ...p, plan, periods };
}

// ---------- budget lines ----------

/** The words that say which kind of cost a budget line is. A line whose words say nothing clear is "Other": the kind is never guessed. */
export const COST_CATEGORY_WORDS: ReadonlyArray<{ category: "PERSONNEL" | "TRAVEL" | "SUPPLIES" | "EQUIPMENT" | "SERVICES"; words: readonly string[] }> = [
  { category: "PERSONNEL", words: ["staff", "salary", "salaries", "personnel", "wages", "stipend", "stipends", "incentive", "incentives"] },
  { category: "TRAVEL", words: ["travel", "transport", "transportation", "fuel", "per diem", "perdiem", "accommodation"] },
  { category: "SUPPLIES", words: ["supplies", "materials", "consumables", "stationery", "kits", "kit"] },
  { category: "EQUIPMENT", words: ["equipment", "vehicle", "vehicles", "machinery", "furniture", "computers"] },
  { category: "SERVICES", words: ["services", "consultant", "consultants", "consultancy", "contractor", "contractors", "training", "audit"] },
];

export function costCategoryOf(text: string | null): "PERSONNEL" | "TRAVEL" | "SUPPLIES" | "EQUIPMENT" | "SERVICES" | "OTHER" {
  const t = ` ${(text ?? "").toLowerCase().replace(/[^a-z ]+/g, " ")} `;
  return COST_CATEGORY_WORDS.find((c) => c.words.some((w) => t.includes(` ${w} `)))?.category ?? "OTHER";
}

export interface LaunchBudgetLine {
  /** The planned activity it pays for, found again by title and start day. */
  title: string;
  start: string | null;
  code: string;
  category: ReturnType<typeof costCategoryOf>;
  description: string;
  currency: string;
  amount: string;
}

/** The budget lines to create on planned activities, and how many pay for the whole project and so have no activity to sit under. */
export function budgetLinesForLaunch(draft: SetupDraft): { lines: LaunchBudgetLine[]; support: number } {
  const plan = new Map(draft.proposal.plan.filter(isLive).map((item) => [planKeyOf(item.value!), item.value!] as const));
  let support = 0;
  const lines: LaunchBudgetLine[] = [];
  for (const line of budgetTotalRows(draft)) {
    const target = draft.extras.finance.budgetPlan[budgetKeyOf(line)];
    if (target === undefined) continue;
    const def = target === SUPPORT_LINE ? undefined : plan.get(target);
    if (!def || !def.title || !line.currency || !line.amount) { support += 1; continue; }
    lines.push({ title: def.title, start: def.start, code: (line.ref ?? `B${lines.length + 1}`).slice(0, 30), category: costCategoryOf(line.category), description: line.category ?? "", currency: line.currency, amount: line.amount });
  }
  return { lines, support };
}
