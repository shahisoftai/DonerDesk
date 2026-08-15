import { Entity } from "../../core/entity.js";
import { DomainError } from "../../core/domain-error.js";

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
    createdById: string;
  }): ReportingProfile {
    ReportingProfile.validateTone(input.tone);
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
    updatedById: string;
  }): void {
    ReportingProfile.validateTone(input.tone);
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
    this.props.updatedById = input.updatedById;
    this.props.version += 1;
    this.touch();
  }
}
