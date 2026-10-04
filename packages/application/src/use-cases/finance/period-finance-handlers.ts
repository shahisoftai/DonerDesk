import type { DomainError, FinanceDataMode, FinanceLine, FinanceSource, FinanceSummaryView, PeriodFinancialSummary, ReportingPeriod, Result } from "@donordesk/domain";
import { DomainError as DE, PeriodFinancialSummary as Summary, FINANCE_REPORT_TYPES, parseFinanceRows } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { IProjectRepository } from "../../ports/projects.js";
import type { IReportDraftRepository, IReportingPeriodRepository } from "../../ports/reporting.js";
import type { IPeriodFinancialRepository } from "../../ports/finance.js";
import type { IAuditLogger, IIdGenerator } from "../../ports/core.js";
import type { IFinanceInputs } from "../../services/finance-inputs.js";

export interface PeriodFinanceDto {
  mode: FinanceDataMode;
  /** Whether this kind of report has a financial section that can carry figures. */
  appliesToReportType: boolean;
  /** Currency offered when nothing is stored yet (the project's budget currency). */
  defaultCurrency: string;
  summary: null | {
    source: FinanceSource;
    sourceNote?: string;
    verified: boolean;
    verifiedAt?: string;
    verifiedById?: string;
    updatedAt: string;
    figures: { lines: FinanceLine[]; budget: string; expenditure: string; committed?: string };
    view: FinanceSummaryView;
  };
}

function toDto(mode: FinanceDataMode, period: Pick<ReportingPeriod, "reportType">, defaultCurrency: string, s: PeriodFinancialSummary | null): PeriodFinanceDto {
  return {
    mode,
    appliesToReportType: FINANCE_REPORT_TYPES.has(period.reportType),
    defaultCurrency,
    summary: s && {
      source: s.source,
      ...(s.sourceNote ? { sourceNote: s.sourceNote } : {}),
      verified: s.isVerified,
      ...(s.verifiedAt ? { verifiedAt: s.verifiedAt.toISOString() } : {}),
      ...(s.verifiedById ? { verifiedById: s.verifiedById } : {}),
      updatedAt: s.updatedAt.toISOString(),
      figures: s.figures,
      view: s.view(),
    },
  };
}

/** Loads the period and checks that finance may be used for it. Shared by every finance handler. */
class PeriodFinanceAccess {
  constructor(
    protected readonly periods: IReportingPeriodRepository,
    protected readonly finance: IFinanceInputs,
    protected readonly projects: IProjectRepository,
  ) {}

  protected async load(ctx: AuthenticatedContext, periodId: string): Promise<Result<{ period: ReportingPeriod; mode: FinanceDataMode; currency: string }, DomainError>> {
    const found = await this.periods.findById(periodId, ctx.tenant.tenantId);
    if (!found.ok) return found;
    if (!found.value) return { ok: false, error: DE.notFound("ReportingPeriod", periodId) };
    const mode = await this.finance.modeFor(found.value.projectId, ctx.tenant.tenantId);
    if (!mode.ok) return mode;
    const project = await this.projects.findById(found.value.projectId, ctx.tenant.tenantId);
    if (!project.ok) return project;
    return { ok: true, value: { period: found.value, mode: mode.value, currency: project.value?.budget?.currency ?? "USD" } };
  }

  /**
   * Entering figures needs finance switched on and a report type that has a
   * financial section; `entry` (when given) is the way figures must come in.
   */
  protected requireMode(period: ReportingPeriod, mode: FinanceDataMode, entry?: "TYPED" | "IMPORT"): Result<void, DomainError> {
    if (mode === "DISABLED") return { ok: false, error: DE.policyDenied("Financial figures are switched off for this project. Turn them on in the project's reporting settings.") };
    if (entry && mode !== entry) {
      return { ok: false, error: DE.policyDenied(`This project takes financial figures by ${mode === "TYPED" ? "typing them in" : "spreadsheet import"}, not by ${entry === "TYPED" ? "typing them in" : "spreadsheet import"}.`) };
    }
    if (!FINANCE_REPORT_TYPES.has(period.reportType)) return { ok: false, error: DE.validation(`A ${period.reportType.toLowerCase().replace(/_/g, " ")} report has no financial section.`) };
    return { ok: true, value: undefined };
  }
}

export class GetPeriodFinanceHandler extends PeriodFinanceAccess {
  constructor(periods: IReportingPeriodRepository, finance: IFinanceInputs, projects: IProjectRepository, private readonly summaries: IPeriodFinancialRepository) {
    super(periods, finance, projects);
  }

  async handle(ctx: AuthenticatedContext, periodId: string): Promise<Result<PeriodFinanceDto, DomainError>> {
    const loaded = await this.load(ctx, periodId);
    if (!loaded.ok) return loaded;
    const summary = loaded.value.mode === "DISABLED" ? { ok: true as const, value: null } : await this.summaries.findByPeriod(periodId, ctx.tenant.tenantId);
    if (!summary.ok) return summary;
    return { ok: true, value: toDto(loaded.value.mode, loaded.value.period, loaded.value.currency, summary.value) };
  }
}

export interface SavePeriodFinanceInput {
  currency?: string;
  sourceNote?: string;
  lines?: FinanceLine[];
  budget?: string;
  expenditure?: string;
  committed?: string;
}

/**
 * Stores a period's financial figures (typed in, or the lines of a confirmed
 * import: the project's mode decides which). Any change leaves the summary
 * unverified until someone confirms it.
 */
export class SavePeriodFinanceHandler extends PeriodFinanceAccess {
  constructor(
    private readonly ids: IIdGenerator,
    periods: IReportingPeriodRepository,
    finance: IFinanceInputs,
    projects: IProjectRepository,
    private readonly summaries: IPeriodFinancialRepository,
    private readonly drafts: IReportDraftRepository,
    private readonly audit: IAuditLogger,
  ) {
    super(periods, finance, projects);
  }

  async handle(ctx: AuthenticatedContext, periodId: string, input: SavePeriodFinanceInput): Promise<Result<PeriodFinanceDto, DomainError>> {
    const loaded = await this.load(ctx, periodId);
    if (!loaded.ok) return loaded;
    const { period, mode, currency } = loaded.value;
    const allowed = this.requireMode(period, mode);
    if (!allowed.ok) return allowed;
    // The project's mode decides how the figures came in.
    const source: FinanceSource = mode === "IMPORT" ? "IMPORT" : "TYPED";

    const drafts = await this.drafts.findByReportingPeriod(periodId, ctx.tenant.tenantId);
    if (!drafts.ok) return drafts;
    const frozen = drafts.value.find((d) => d.status === "UNDER_REVIEW" || d.status === "APPROVED" || d.status === "EXPORTED" || d.status === "SUBMITTED");
    if (frozen) return { ok: false, error: DE.invalidTransition(`Financial figures cannot be changed while the report is ${frozen.status.toLowerCase().replace(/_/g, " ")}`) };

    const existing = await this.summaries.findByPeriod(periodId, ctx.tenant.tenantId);
    if (!existing.ok) return existing;
    const figures = { lines: input.lines, budget: input.budget, expenditure: input.expenditure, committed: input.committed };
    let summary: PeriodFinancialSummary;
    try {
      if (existing.value) {
        existing.value.replaceFigures({ currency: input.currency, source, sourceNote: input.sourceNote, figures, updatedById: ctx.tenant.userId });
        summary = existing.value;
      } else {
        summary = Summary.create({
          id: this.ids.generate(),
          tenantId: ctx.tenant.tenantId.toString(),
          projectId: period.projectId,
          reportingPeriodId: periodId,
          currency: input.currency ?? currency,
          source,
          sourceNote: input.sourceNote,
          figures,
          createdById: ctx.tenant.userId,
        });
      }
    } catch (e) {
      if (e instanceof DE) return { ok: false, error: e };
      throw e;
    }
    const saved = await this.summaries.save(summary);
    if (!saved.ok) return saved;
    await this.audit.record({
      tenantId: ctx.tenant.tenantId,
      actorId: ctx.tenant.userId,
      eventType: "reporting_period.finance_saved",
      entityType: "reporting_period",
      entityId: periodId,
      projectId: period.projectId,
      newValue: JSON.stringify({ source, currency: summary.currency, budget: summary.figures.budget, expenditure: summary.figures.expenditure, lines: summary.figures.lines.length }),
    });
    return { ok: true, value: toDto(mode, period, currency, summary) };
  }
}

export interface FinanceImportPreview {
  readyCount: number;
  errorCount: number;
  rows: Array<{ rowIndex: number; line?: FinanceLine; error?: string }>;
}

/** Parses pasted spreadsheet rows into budget lines for the user to confirm; stores nothing. */
export class PreviewPeriodFinanceImportHandler extends PeriodFinanceAccess {
  async handle(ctx: AuthenticatedContext, periodId: string, rows: string[][]): Promise<Result<FinanceImportPreview, DomainError>> {
    const loaded = await this.load(ctx, periodId);
    if (!loaded.ok) return loaded;
    const allowed = this.requireMode(loaded.value.period, loaded.value.mode, "IMPORT");
    if (!allowed.ok) return allowed;
    const parsed = parseFinanceRows(rows);
    return { ok: true, value: { readyCount: parsed.readyCount, errorCount: parsed.errorCount, rows: parsed.rows } };
  }
}

/** Confirms the figures. Only verified figures are ever given to a report writer; the route requires approval rights. */
export class VerifyPeriodFinanceHandler extends PeriodFinanceAccess {
  constructor(
    periods: IReportingPeriodRepository,
    finance: IFinanceInputs,
    projects: IProjectRepository,
    private readonly summaries: IPeriodFinancialRepository,
    private readonly audit: IAuditLogger,
  ) {
    super(periods, finance, projects);
  }

  async handle(ctx: AuthenticatedContext, periodId: string): Promise<Result<PeriodFinanceDto, DomainError>> {
    const loaded = await this.load(ctx, periodId);
    if (!loaded.ok) return loaded;
    const { period, mode, currency } = loaded.value;
    if (mode === "DISABLED") return { ok: false, error: DE.policyDenied("Financial figures are switched off for this project.") };
    const found = await this.summaries.findByPeriod(periodId, ctx.tenant.tenantId);
    if (!found.ok) return found;
    if (!found.value) return { ok: false, error: DE.notFound("PeriodFinancialSummary", periodId) };
    try {
      found.value.verify(ctx.tenant.userId);
    } catch (e) {
      if (e instanceof DE) return { ok: false, error: e };
      throw e;
    }
    const saved = await this.summaries.save(found.value);
    if (!saved.ok) return saved;
    await this.audit.record({
      tenantId: ctx.tenant.tenantId,
      actorId: ctx.tenant.userId,
      eventType: "reporting_period.finance_verified",
      entityType: "reporting_period",
      entityId: periodId,
      projectId: period.projectId,
    });
    return { ok: true, value: toDto(mode, period, currency, found.value) };
  }
}
