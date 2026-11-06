import { adaptationSentence, planDeliverySentences, redactForLlm, toPlainDate, resolvePiiPolicy, type FinanceSummaryView, type PlanDeliverySummary, type PiiPolicy, type ReportScope, type Result, type TenantId, type VerifiedFinding } from "@donordesk/domain";
import { DomainError } from "@donordesk/domain";
import type { IRecordChunkBuilder, IReportingPeriodRepository, RecordChunk } from "../ports/reporting.js";
import type { IProjectRepository } from "../ports/projects.js";
import type { IActivityUpdateRepository } from "../ports/activities.js";
import type { IIndicatorRepository, IIndicatorUpdateRepository } from "../ports/logframe.js";
import type { IEvidenceRepository } from "../ports/evidence.js";
import type { IPlanDelivery } from "./plan-delivery-service.js";
import type { IAdaptationRepository } from "../ports/adaptations.js";
import { resolveGenerationActivities } from "./period-activities.js";
import { taggedEvidenceIds } from "./period-evidence.js";

const MAX_CHUNKS = 400;
const MAX_SENTENCE = 400;

/** The records a report is written from, as plain data (the loader below fills it in). */
export interface RecordSources {
  project: {
    title: string;
    projectCode: string;
    donorName: string;
    implementingOrganization: string;
    partnerOrganization?: string;
    country: string;
    region?: string;
    district?: string;
    sector: string;
    duration: { start: Date; end: Date };
    budget?: { amount: number; currency: string } | null;
    description?: string;
  };
  period: { reportType: string; duration: { start: Date; end: Date }; scope?: ReportScope };
  story?: { achievements?: string; challenges?: string; varianceExplanations?: string; adaptations?: string; lessons?: string; sectionNotes?: Record<string, string> };
  activities: Array<{
    id: string;
    activityTitle: string;
    activityDate: Date;
    activityEndDate?: Date;
    location?: string;
    participantsTotal?: number;
    participantsMale?: number;
    participantsFemale?: number;
    participantsChildren?: number;
    participantsDisability?: number;
    summary: string;
    achievements: string;
    challenges: string;
    lessonsLearned: string;
    nextSteps: string;
  }>;
  indicatorUpdates: Array<{ indicatorCode: string; comments?: string; dataSource?: string }>;
  /** The logframe's own statement of where each indicator's results come from. */
  indicatorDefinitions?: Array<{ code: string; name?: string; meansOfVerification?: string }>;
}

const LONG_DATE = (d: Date): string => `${d.getUTCDate()} ${d.toLocaleString("en-GB", { month: "long", timeZone: "UTC" })} ${d.getUTCFullYear()}`;
const ISO_DATE = (d: Date): string => d.toISOString().slice(0, 10);
const bothDates = (d: Date): string => `${LONG_DATE(d)} (${ISO_DATE(d)})`;

/** Splits free text into sentence-sized statements: a claim is one sentence, so a chunk must be too. */
export function recordSentences(text: string | undefined): string[] {
  if (!text) return [];
  return text
    .split(/\n+|(?<=[.!?])\s+/)
    // Only a real list marker ("- ", "* ", "1. ", "2) ") is dropped: a sentence that starts with a figure ("420 cartons were delivered") keeps it.
    .map((s) => s.replace(/^(?:[-*•]\s+|\d{1,2}[.)]\s+)+/, "").trim())
    .filter((s) => s.length >= 8)
    .map((s) => (s.length > MAX_SENTENCE ? s.slice(0, MAX_SENTENCE) : s));
}

/**
 * Pure. What the person typed when they created a situation / custom / activity report, as statements: the event,
 * where and when, the summary, the affected-population figures with their source and date, and the main needs.
 * A claim quoting any of them is therefore supported by the record it came from, and the contradiction lint can
 * accept the figures (a figure the user supplied is never "not in your data").
 */
export function scopeStatements(scope: ReportScope | undefined): string[] {
  if (!scope) return [];
  const out: string[] = [];
  if (scope.eventName) out.push(`The event covered is ${scope.eventName}${scope.location ? ` in ${scope.location}` : ""}.`);
  else if (scope.location) out.push(`The affected area is ${scope.location}.`);
  if (scope.situationDate) out.push(`The situation is reported as of ${bothDates(new Date(`${scope.situationDate.slice(0, 10)}T00:00:00Z`))}.`);
  if (scope.eventStartDate) out.push(`The event began on ${bothDates(new Date(`${scope.eventStartDate.slice(0, 10)}T00:00:00Z`))}.`);
  out.push(...recordSentences(scope.summary));
  for (const f of scope.affectedPopulation ?? []) {
    out.push(`Affected population as reported: ${f.group}: ${f.figure}${f.source ? ` (source: ${f.source}${f.asOf ? `, as of ${f.asOf}` : ""})` : f.asOf ? ` (as of ${f.asOf})` : ""}.`);
  }
  for (const need of scope.needs ?? []) out.push(`A reported need is ${need.replace(/[.\s]+$/, "")}.`);
  return out;
}

/**
 * Pure. One short chunk per statement of the structured records the writer was given. A factual
 * or qualitative claim that restates one of them ("rainy-season delays were managed through early
 * ordering") is supported by the record it came from, even though no evidence file says it.
 */
export function buildRecordChunks(sources: RecordSources, piiPolicy: PiiPolicy = resolvePiiPolicy(process.env.LLM_PII_POLICY)): RecordChunk[] {
  const chunks: RecordChunk[] = [];
  const add = (kind: string, owner: string, label: string, texts: Array<string | undefined>): void => {
    texts.forEach((text, i) => {
      if (text && text.trim() && chunks.length < MAX_CHUNKS) chunks.push({ chunkId: `record:${kind}:${owner}:${i}`, label, text: text.trim() });
    });
  };
  /**
   * The officer's own words are redacted for the model (LLM_PII_POLICY). The
   * writer and the claim verifier both read these chunks, so a redacted
   * sentence still grounds a claim that quotes it.
   */
  const words = (text: string | undefined): string | undefined =>
    text === undefined ? undefined : redactForLlm(text, piiPolicy);

  const p = sources.project;
  const place = [p.district, p.region, p.country].filter(Boolean).join(", ");
  add("project", "details", `Project details: ${p.title}`, [
    `${p.title} (project code ${p.projectCode}) is a ${p.sector.toLowerCase()} project.`,
    `Donor: ${p.donorName}. This project is implemented with the support of ${p.donorName}.`,
    `${p.implementingOrganization} implements the project${p.partnerOrganization ? ` with ${p.partnerOrganization}` : ""} in ${place}.`,
    `The project runs from ${bothDates(p.duration.start)} to ${bothDates(p.duration.end)}.`,
    p.budget ? `The project budget is ${p.budget.amount} ${p.budget.currency}.` : undefined,
    ...recordSentences(words(p.description)),
  ]);
  add("period", "dates", "Reporting period", [
    `This ${sources.period.reportType.toLowerCase().replace(/_/g, "-")} report covers ${bothDates(sources.period.duration.start)} to ${bothDates(sources.period.duration.end)}.`,
  ]);

  add("scope", "situation", "The situation this report covers", scopeStatements(sources.period.scope));

  const s = sources.story;
  if (s) {
    const STORY_LABEL: Record<string, string> = { achievements: "the achievements", challenges: "the challenges", varianceExplanations: "the reason for any variance or unspent balance", adaptations: "the adaptations made", lessons: "the lessons learned" };
    for (const [index, text] of Object.values(s.sectionNotes ?? {}).entries()) {
      add("story", `sectionNote${index}`, "Reporting officer's statement for a compliance section", recordSentences(words(text)).map((sentence) => `The reporting officer recorded: ${sentence}`));
    }
    for (const [field, text] of Object.entries(s).filter(([k]) => k !== "sectionNotes") as Array<[string, string | undefined]>) {
      add("story", field, `Reporting officer's story: ${field}`, recordSentences(words(text)).map((sentence) => `The reporting officer recorded ${STORY_LABEL[field] ?? field}: ${sentence}`));
    }
  }

  for (const a of sources.activities) {
    const label = `Activity record: ${a.activityTitle}`;
    const participants = [
      a.participantsTotal !== undefined ? `${a.participantsTotal} participants` : undefined,
      a.participantsFemale !== undefined ? `${a.participantsFemale} female` : undefined,
      a.participantsMale !== undefined ? `${a.participantsMale} male` : undefined,
      a.participantsChildren !== undefined ? `${a.participantsChildren} children` : undefined,
      a.participantsDisability !== undefined ? `${a.participantsDisability} with disabilities` : undefined,
    ].filter(Boolean);
    add("activity", a.id, label, [
      `${a.activityTitle}${a.location ? ` at ${words(a.location)}` : ""} ${a.activityEndDate ? `from ${bothDates(a.activityDate)} to ${bothDates(a.activityEndDate)}` : `on ${bothDates(a.activityDate)}`}.`,
      participants.length ? `Participants: ${participants.join(", ")}.` : undefined,
      ...recordSentences(words(a.summary)),
      ...recordSentences(words(a.achievements)),
      ...recordSentences(words(a.challenges)),
      ...recordSentences(words(a.lessonsLearned)),
      ...recordSentences(words(a.nextSteps)),
    ]);
  }

  const seen = new Set<string>();
  sources.indicatorUpdates.forEach((u, i) => {
    const texts = [u.comments && recordSentences(words(u.comments)).join(" "), u.dataSource ? `${u.indicatorCode} data source: ${words(u.dataSource)}.` : undefined];
    const key = texts.join("|");
    if (seen.has(key)) return;
    seen.add(key);
    add("indicator", `${u.indicatorCode}-${i}`, `Indicator update ${u.indicatorCode}`, texts);
  });

  for (const d of sources.indicatorDefinitions ?? []) {
    const mov = d.meansOfVerification?.trim().replace(/[.;\s]+$/, "");
    if (!mov) continue;
    const name = d.name ? `${d.code} ${d.name}` : d.code;
    add("indicator", `${d.code}-mov`, `Means of verification ${d.code}`, [`${name} is verified through: ${mov}. The results for ${d.code} are recorded in these sources: ${mov}.`]);
  }

  add("report", "counts", "Records behind this report", [
    `This report draws on ${sources.activities.length} activity records and ${sources.indicatorUpdates.length} indicator updates.`,
  ]);

  return chunks;
}

/** Pure. The evidence files behind a report as statements (the evidence log restates these). */
export function recordChunksFromEvidence(packages: ReadonlyArray<{ evidenceId: string; title: string; evidenceType: string; verificationStatus: string; confidentialityLevel: string }>): RecordChunk[] {
  if (packages.length === 0) return [];
  const chunks: RecordChunk[] = packages.map((p, i) => ({
    chunkId: `record:evidence:${i}`,
    label: `Evidence file: ${p.title}`,
    text: `Evidence file ${p.title} (${p.evidenceType.toLowerCase().replace(/_/g, " ")}) has verification status ${p.verificationStatus} and confidentiality level ${p.confidentialityLevel}.`,
  }));
  const allVerified = packages.every((p) => p.verificationStatus === "VERIFIED");
  const levels = [...new Set(packages.map((p) => p.confidentialityLevel))];
  chunks.push({
    chunkId: "record:evidence:all",
    label: "Evidence files",
    text: `${packages.length} verified evidence files are annexed${allVerified ? ", all verified" : ""}${levels.length === 1 ? ` and all classified as ${levels[0]!.toLowerCase()}` : ""}. Each file carries verification status and confidentiality level.`,
  });
  return chunks;
}

const money = (text: string, currency: string): string => `${text} ${currency}`;

/**
 * Pure. The verified indicator findings as statements: a sentence that restates a value, target, baseline,
 * life-of-project total, recorded breakdown or evaluation of a finding is supported by that finding.
 */
/** "SEX / Female" → "female": the way a sentence names a recorded group. */
function groupLabel(category: string): string {
  return category.split("/").pop()!.trim().toLowerCase();
}

/** "Of the 15 staff, 11 female and 4 male": the breakdown as a sentence a report would actually write. */
function breakdownSentence(total: string, unit: string, entries: ReadonlyArray<{ category: string; value: string }>): string {
  return `Of the ${total}${unit}, ${entries.map((e) => `${e.value} ${groupLabel(e.category)}`).join(" and ")}.`;
}

/** Pure. What the plan says about the period, as statements a claim can be supported by (never cited as evidence). */
export function recordChunksFromPlan(summary: PlanDeliverySummary | undefined): RecordChunk[] {
  if (!summary) return [];
  return planDeliverySentences(summary).map((text, i) => ({ chunkId: `record:plan:${i}`, label: "The work plan for this period", text }));
}

/** Pure. The adaptations recorded for the period, as statements a claim about a change of plan can be supported by (never cited as evidence). */
export function recordChunksFromAdaptations(list: ReadonlyArray<Parameters<typeof adaptationSentence>[0]>): RecordChunk[] {
  return list.map((a, i) => ({ chunkId: `record:adaptation:${i}`, label: "A recorded change of plan", text: adaptationSentence(a) }));
}

export function recordChunksFromFindings(findings: ReadonlyArray<VerifiedFinding>): RecordChunk[] {
  const chunks: RecordChunk[] = [];
  const push = (code: string, i: number, label: string, text: string): void => {
    chunks.push({ chunkId: `record:finding:${code}:${i}`, label, text });
  };
  for (const f of findings) {
    const unit = f.unit ? ` ${f.unit}` : "";
    const label = `Verified finding ${f.indicatorCode}`;
    const name = f.indicatorName ? `${f.indicatorCode} ${f.indicatorName}` : f.indicatorCode;
    const parts: string[] = [];
    if (!f.qualityFlags.includes("MISSING_DENOMINATOR")) parts.push(`${f.value}${unit} this period`);
    if (f.target) parts.push(`against a target of ${f.target}`);
    if (f.baseline) parts.push(`from a baseline of ${f.baseline}`);
    let i = 0;
    push(f.indicatorCode, i++, label, `${name}: ${parts.join(" ")}.`);
    if (f.cumulativeValue) push(f.indicatorCode, i++, label, `${name}: cumulative ${f.cumulativeValue}${unit} to date.`);
    if (f.lifeOfProject) push(f.indicatorCode, i++, label, `${name}: ${f.lifeOfProject.value}${unit} over the life of the project${f.target ? ` against a target of ${f.target}` : ""}.`);
    const headline = f.lifeOfProject?.value ?? f.value;
    const num = Number(headline);
    const target = Number(f.target);
    if (Number.isFinite(num) && Number.isFinite(target) && target !== 0) {
      push(f.indicatorCode, i++, label, `${name}: ${Math.round((num / target) * 1000) / 10}% of target.`);
    }
    if ((f.disaggregation ?? []).length > 0) {
      push(f.indicatorCode, i++, label, `${name}, recorded breakdown of this period's ${f.value}${unit}: ${f.disaggregation!.map((e) => `${e.category} ${e.value}`).join(", ")}.`);
      push(f.indicatorCode, i++, label, `${name}: ${breakdownSentence(f.value, unit, f.disaggregation!)}`);
    }
    if ((f.lifeOfProject?.disaggregation ?? []).length > 0) {
      push(f.indicatorCode, i++, label, `${name}, recorded breakdown of the life-of-project ${f.lifeOfProject!.value}${unit}: ${f.lifeOfProject!.disaggregation!.map((e) => `${e.category} ${e.value}`).join(", ")}.`);
      push(f.indicatorCode, i++, label, `${name}: ${breakdownSentence(f.lifeOfProject!.value, unit, f.lifeOfProject!.disaggregation!)}`);
    }
    if ((f.targetBreakdowns ?? []).length > 0) {
      push(f.indicatorCode, i++, label, `${name}, targets set by group: ${f.targetBreakdowns!.map((e) => `${e.category} ${e.value}`).join(", ")}.`);
    }
    if (f.performanceEvaluation?.type === "POSITIVE") push(f.indicatorCode, i++, label, `${name} is on track: it meets or exceeds its target.`);
    if (f.performanceEvaluation?.type === "NEGATIVE") push(f.indicatorCode, i++, label, `${name} is below expectation against its target.`);
  }
  if (findings.length > 0) {
    chunks.push({ chunkId: "record:finding:all:0", label: "Verified findings", text: `There are ${findings.length} verified indicator results.` });
    if (findings.every((f) => f.qualityFlags.length === 0)) {
      chunks.push({ chunkId: "record:finding:all:1", label: "Verified findings", text: "No data-quality flags were raised on any indicator; no result was flagged as not calculable." });
    }
    if (!findings.some((f) => f.performanceEvaluation?.type === "NEGATIVE")) {
      chunks.push({ chunkId: "record:finding:all:3", label: "Verified findings", text: "No indicator fell below expectation." });
    }
    if (findings.every((f) => f.performanceEvaluation?.type === "POSITIVE")) {
      chunks.push({ chunkId: "record:finding:all:4", label: "Verified findings", text: `All ${findings.length} indicators were evaluated as POSITIVE: all ${findings.length} indicators met or exceeded their targets and are on track.` });
      chunks.push({ chunkId: "record:finding:all:5", label: "Verified findings", text: `The project closed all ${findings.length} indicators at or above target.` });
    }
    const met = findings.filter((f) => f.performanceEvaluation?.type === "POSITIVE").map((f) => f.indicatorCode);
    if (met.length > 0) chunks.push({ chunkId: "record:finding:all:2", label: "Verified findings", text: `Indicators that met or exceeded their targets: ${met.join(", ")}. ${met.length} of ${findings.length} indicators met or exceeded their targets.` });
  }
  return chunks;
}

/** Pure. The verified financial figures as statements. */
export function recordChunksFromFinance(finance: FinanceSummaryView): RecordChunk[] {
  const c = finance.currency;
  const chunks: RecordChunk[] = [
    {
      chunkId: "record:finance:total:0",
      label: "Verified project finance",
      text: `Budget ${money(finance.budget, c)}; expenditure ${money(finance.expenditure, c)}${finance.committed ? `; committed ${money(finance.committed, c)}` : ""}; balance ${money(finance.balance, c)}${finance.burnRatePercent ? `; burn rate ${finance.burnRatePercent} percent` : ""}.`,
    },
  ];
  const spent = Number(finance.expenditure);
  const budget = Number(finance.budget);
  if (Number.isFinite(spent) && Number.isFinite(budget) && spent <= budget) {
    chunks.push({
      chunkId: "record:finance:total:1",
      label: "Verified project finance",
      text: `The project was delivered within budget: expenditure ${money(finance.expenditure, c)} against a budget envelope of ${money(finance.budget, c)}${finance.burnRatePercent ? `, a burn rate of ${finance.burnRatePercent} percent` : ""}.`,
    });
  }
  const rates = new Set(finance.lines.map((l) => l.burnRatePercent).filter(Boolean));
  if (finance.lines.length > 1 && rates.size === 1) {
    chunks.push({ chunkId: "record:finance:total:2", label: "Verified project finance", text: `Every budget line closed at a burn rate of ${[...rates][0]} percent.` });
  }
  finance.lines.forEach((l, i) => {
    chunks.push({
      chunkId: `record:finance:line:${i}`,
      label: `Verified project finance: ${l.budgetLine}`,
      text: `${l.budgetLine}: budget ${money(l.budget, c)}, expenditure ${money(l.expenditure, c)}, balance ${money(l.balance, c)}${l.burnRatePercent ? `, burn rate ${l.burnRatePercent} percent` : ""}.`,
    });
  });
  return chunks;
}

const FIGURE_RE = /(?<![A-Za-z0-9.\-])\d[\d,]*(?:\.\d+)?(?![A-Za-z0-9])/g;
const DATE_LIKE_RE = /\b\d{4}-\d{2}-\d{2}\b|\b\d{1,2}\s+[A-Za-z]+\s+\d{4}\b|\b(?:19|20)\d{2}\b/g;

/**
 * Pure. The standalone figures the records state (participant counts, record counts, budget), as text.
 * Dates, years and codes (IND-6, A1.1) are not figures, so a bare "3" or "6" is not grounded by them.
 */
export function figuresInRecords(chunks: ReadonlyArray<RecordChunk>): string[] {
  const figures = new Set<string>();
  for (const chunk of chunks) {
    for (const match of chunk.text.replace(DATE_LIKE_RE, " ").matchAll(FIGURE_RE)) figures.add(match[0].replace(/,/g, ""));
  }
  return [...figures];
}

/** Loads the records of a period and turns them into chunks. */
export class RecordChunkBuilder implements IRecordChunkBuilder {
  constructor(
    private readonly periods: IReportingPeriodRepository,
    private readonly projects: IProjectRepository,
    private readonly activities: IActivityUpdateRepository,
    private readonly indicators: IIndicatorRepository,
    private readonly indicatorUpdates: IIndicatorUpdateRepository,
    private readonly evidenceFiles?: IEvidenceRepository,
    /** Absent: the work plan is not a record (a project without a plan reports exactly as before). */
    private readonly plan?: IPlanDelivery,
    /** Absent: changes of plan are not a record (a project without any reports exactly as before). */
    private readonly adaptations?: IAdaptationRepository,
  ) {}

  async evidenceIds(input: { tenantId: TenantId; projectId: string; reportingPeriodId: string }): Promise<Result<string[], DomainError>> {
    const periodResult = await this.periods.findById(input.reportingPeriodId, input.tenantId);
    if (!periodResult.ok) return periodResult;
    if (!periodResult.value) return { ok: false, error: DomainError.notFound("ReportingPeriod", input.reportingPeriodId) };
    const period = periodResult.value;
    const activities = await resolveGenerationActivities(this.activities, period, input.tenantId);
    if (!activities.ok) return activities;
    const updates = await this.indicatorUpdates.findByReportingPeriod(input.reportingPeriodId, input.tenantId);
    if (!updates.ok) return updates;
    const tagged = await taggedEvidenceIds(this.evidenceFiles, period, activities.value.map((a) => a.id), input.tenantId);
    if (!tagged.ok) return tagged;
    return { ok: true, value: [...new Set([...updates.value.flatMap((u) => u.attachedEvidenceIds), ...activities.value.flatMap((a) => a.attachedEvidenceIds), ...tagged.value])] };
  }

  async build(input: { tenantId: TenantId; projectId: string; reportingPeriodId: string }): Promise<Result<RecordChunk[], DomainError>> {
    const periodResult = await this.periods.findById(input.reportingPeriodId, input.tenantId);
    if (!periodResult.ok) return periodResult;
    if (!periodResult.value) return { ok: false, error: DomainError.notFound("ReportingPeriod", input.reportingPeriodId) };
    const period = periodResult.value;
    const projectResult = await this.projects.findById(input.projectId, input.tenantId);
    if (!projectResult.ok) return projectResult;
    if (!projectResult.value) return { ok: false, error: DomainError.notFound("Project", input.projectId) };
    const project = projectResult.value;

    const activities = await resolveGenerationActivities(this.activities, period, input.tenantId);
    if (!activities.ok) return activities;
    const updates = await this.indicatorUpdates.findByReportingPeriod(input.reportingPeriodId, input.tenantId);
    if (!updates.ok) return updates;
    const indicators = await this.indicators.findByProject(input.projectId, input.tenantId);
    if (!indicators.ok) return indicators;
    const codeById = new Map(indicators.value.map((i) => [i.id, i.code]));

    const planned = this.plan ? await this.plan.forPeriod({ tenantId: input.tenantId, projectId: input.projectId, start: period.duration.start, end: period.duration.end }) : undefined;

    const adapted = this.adaptations
      ? await this.adaptations.findInRange(input.projectId, toPlainDate(period.duration.start)!, toPlainDate(period.duration.end)!, input.tenantId)
      : undefined;

    return {
      ok: true,
      value: [...buildRecordChunks({
        project,
        period,
        story: period.storyContext,
        activities: activities.value,
        indicatorDefinitions: indicators.value.map((i) => ({ code: i.code, name: i.name, meansOfVerification: i.meansOfVerification })),
        indicatorUpdates: updates.value.map((u) => ({ indicatorCode: codeById.get(u.indicatorId) ?? u.indicatorId, comments: u.comments, dataSource: u.dataSource })),
      }), ...(planned?.ok ? recordChunksFromPlan(planned.value) : []), ...(adapted?.ok ? recordChunksFromAdaptations(adapted.value) : [])],
    };
  }
}
