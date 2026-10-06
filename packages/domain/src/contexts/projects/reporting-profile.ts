import { Entity } from "../../core/entity.js";
import { DomainError } from "../../core/domain-error.js";
import { isFinanceDataMode, type FinanceDataMode } from "../finance/finance-data-mode.js";

export type ProfileTone = "FORMAL" | "CONCISE" | "NARRATIVE" | "TECHNICAL";

export const PROFILE_TONES: ProfileTone[] = ["FORMAL", "CONCISE", "NARRATIVE", "TECHNICAL"];

export interface WordCountOverride {
  min?: number;
  max?: number;
}

export interface ReportingProfileProps {
  defaultTemplateId?: string;
  language: string;
  tone: ProfileTone;
  writingStyle?: string;
  audienceNotes?: string;
  formattingRules: string[];
  specialRequirements: string[];
  /** Section id -> optional min/max word counts that override template defaults. */
  sectionOverrides: Record<string, WordCountOverride>;
  deadlineOffsetDays?: number;
  autoPeriodCreation: boolean;
  /** How this project's reports get financial figures; DISABLED unless switched on. */
  financeDataMode: FinanceDataMode;
  /** Report type -> the template a new period of that type starts from (an explicit choice per type). */
  defaultTemplateByType?: Record<string, string>;
  /** When on, the author of a report cannot approve it (a second person must). Off for a team of one. */
  requireSecondApprover?: boolean;
  /** Statements that hold for every period (branding policy, waste procedure), by compliance section key. */
  standingStatements?: Record<string, string>;
  version: number;
  createdById: string;
  updatedById: string;
}

export class ReportingProfile extends Entity<string> {
  private constructor(
    id: string,
    readonly tenantIdValue: string,
    readonly projectId: string,
    private props: ReportingProfileProps,
    createdAt?: Date,
  ) {
    super(id, createdAt);
  }

  static create(input: {
    id: string;
    tenantId: string;
    projectId: string;
    defaultTemplateId?: string;
    language?: string;
    tone?: ProfileTone;
    writingStyle?: string;
    audienceNotes?: string;
    formattingRules?: string[];
    specialRequirements?: string[];
    sectionOverrides?: Record<string, WordCountOverride>;
    deadlineOffsetDays?: number;
    autoPeriodCreation?: boolean;
    financeDataMode?: FinanceDataMode;
    createdById: string;
  }): ReportingProfile {
    ReportingProfile.validateTone(input.tone);
    ReportingProfile.validateFinanceMode(input.financeDataMode);
    ReportingProfile.validateOverrides(input.sectionOverrides);
    return new ReportingProfile(input.id, input.tenantId, input.projectId, {
      defaultTemplateId: input.defaultTemplateId,
      language: input.language ?? "en",
      tone: input.tone ?? "FORMAL",
      writingStyle: input.writingStyle,
      audienceNotes: input.audienceNotes,
      formattingRules: input.formattingRules ?? [],
      specialRequirements: input.specialRequirements ?? [],
      sectionOverrides: input.sectionOverrides ?? {},
      deadlineOffsetDays: input.deadlineOffsetDays,
      autoPeriodCreation: input.autoPeriodCreation ?? false,
      financeDataMode: input.financeDataMode ?? "DISABLED",
      version: 1,
      createdById: input.createdById,
      updatedById: input.createdById,
    });
  }

  static rehydrate(input: {
    id: string;
    tenantId: string;
    projectId: string;
    props: ReportingProfileProps;
    createdAt: Date;
  }): ReportingProfile {
    return new ReportingProfile(input.id, input.tenantId, input.projectId, input.props, input.createdAt);
  }

  private static validateTone(tone: ProfileTone | undefined): void {
    if (tone !== undefined && !PROFILE_TONES.includes(tone)) {
      throw DomainError.validation("Invalid reporting tone");
    }
  }

  private static validateFinanceMode(mode: FinanceDataMode | undefined): void {
    if (mode !== undefined && !isFinanceDataMode(mode)) {
      throw DomainError.validation("Invalid finance data mode");
    }
  }

  private static validateOverrides(overrides: Record<string, WordCountOverride> | undefined): void {
    if (!overrides) return;
    for (const [sectionId, override] of Object.entries(overrides)) {
      if (!sectionId) throw DomainError.validation("Section override key must not be empty");
      if (override.min !== undefined && (!Number.isInteger(override.min) || override.min < 0)) {
        throw DomainError.validation(`Section override min must be a nonnegative integer (${sectionId})`);
      }
      if (override.max !== undefined && (!Number.isInteger(override.max) || override.max <= 0)) {
        throw DomainError.validation(`Section override max must be a positive integer (${sectionId})`);
      }
      if (override.min !== undefined && override.max !== undefined && override.min > override.max) {
        throw DomainError.validation(`Section override max must be at least min (${sectionId})`);
      }
    }
  }

  get defaultTemplateId(): string | undefined {
    return this.props.defaultTemplateId;
  }

  get language(): string {
    return this.props.language;
  }

  get tone(): ProfileTone {
    return this.props.tone;
  }

  get writingStyle(): string | undefined {
    return this.props.writingStyle;
  }

  get audienceNotes(): string | undefined {
    return this.props.audienceNotes;
  }

  get formattingRules(): string[] {
    return [...this.props.formattingRules];
  }

  get specialRequirements(): string[] {
    return [...this.props.specialRequirements];
  }

  get sectionOverrides(): Record<string, WordCountOverride> {
    return { ...this.props.sectionOverrides };
  }

  get deadlineOffsetDays(): number | undefined {
    return this.props.deadlineOffsetDays;
  }

  get autoPeriodCreation(): boolean {
    return this.props.autoPeriodCreation;
  }

  get financeDataMode(): FinanceDataMode {
    return this.props.financeDataMode;
  }

  get version(): number {
    return this.props.version;
  }

  get createdById(): string {
    return this.props.createdById;
  }

  get updatedById(): string {
    return this.props.updatedById;
  }

  /** Applies a full update; bumps the version. Optimistic-concurrency checks happen at the repo/handler. */
  update(input: {
    defaultTemplateId?: string;
    language?: string;
    tone?: ProfileTone;
    writingStyle?: string;
    audienceNotes?: string;
    formattingRules?: string[];
    specialRequirements?: string[];
    sectionOverrides?: Record<string, WordCountOverride>;
    deadlineOffsetDays?: number;
    autoPeriodCreation?: boolean;
    financeDataMode?: FinanceDataMode;
    updatedById: string;
  }): void {
    ReportingProfile.validateTone(input.tone);
    ReportingProfile.validateFinanceMode(input.financeDataMode);
    ReportingProfile.validateOverrides(input.sectionOverrides);
    if (input.defaultTemplateId !== undefined) this.props.defaultTemplateId = input.defaultTemplateId;
    if (input.language !== undefined) this.props.language = input.language;
    if (input.tone !== undefined) this.props.tone = input.tone;
    if (input.writingStyle !== undefined) this.props.writingStyle = input.writingStyle;
    if (input.audienceNotes !== undefined) this.props.audienceNotes = input.audienceNotes;
    if (input.formattingRules !== undefined) this.props.formattingRules = [...input.formattingRules];
    if (input.specialRequirements !== undefined) this.props.specialRequirements = [...input.specialRequirements];
    if (input.sectionOverrides !== undefined) this.props.sectionOverrides = { ...input.sectionOverrides };
    if (input.deadlineOffsetDays !== undefined) this.props.deadlineOffsetDays = input.deadlineOffsetDays;
    if (input.autoPeriodCreation !== undefined) this.props.autoPeriodCreation = input.autoPeriodCreation;
    if (input.financeDataMode !== undefined) this.props.financeDataMode = input.financeDataMode;
    this.props.updatedById = input.updatedById;
    this.props.version += 1;
    this.touch();
  }

  /**
   * Sets or clears the project's default template, independently of every
   * other profile field. A dedicated mutator (rather than `update()`) because
   * `update()` treats `undefined` as "leave unchanged" and so cannot express
   * clearing the field — this method always applies exactly the given value.
   */
  get defaultTemplateByType(): Record<string, string> { return { ...(this.props.defaultTemplateByType ?? {}) }; }
  get requireSecondApprover(): boolean { return this.props.requireSecondApprover ?? false; }
  get standingStatements(): Record<string, string> { return { ...(this.props.standingStatements ?? {}) }; }

  /** Makes a template the default for one report type (or, with undefined, removes that type's default). */
  setDefaultTemplateForType(reportType: string, templateId: string | undefined, updatedById: string): void {
    const next = { ...(this.props.defaultTemplateByType ?? {}) };
    if (templateId) next[reportType] = templateId;
    else delete next[reportType];
    this.props.defaultTemplateByType = next;
    this.bump(updatedById);
  }

  setRequireSecondApprover(value: boolean, updatedById: string): void {
    this.props.requireSecondApprover = value;
    this.bump(updatedById);
  }

  /** Sets (or removes, with empty text) one standing statement. */
  setStandingStatement(key: string, text: string, updatedById: string): void {
    const next = { ...(this.props.standingStatements ?? {}) };
    const trimmed = text.trim().slice(0, 4000);
    if (trimmed) next[key] = trimmed;
    else delete next[key];
    this.props.standingStatements = next;
    this.bump(updatedById);
  }

  private bump(updatedById: string): void {
    this.props.updatedById = updatedById;
    this.props.version += 1;
    this.touch();
  }

  setDefaultTemplateId(templateId: string | undefined, updatedById: string): void {
    this.props.defaultTemplateId = templateId;
    this.props.updatedById = updatedById;
    this.props.version += 1;
    this.touch();
  }
}
