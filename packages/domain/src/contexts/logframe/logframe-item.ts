import { Entity } from "../../core/entity.js";
import { DomainError } from "../../core/domain-error.js";

export type LogframeLevel = "GOAL" | "OUTCOME" | "OUTPUT" | "ACTIVITY";

export const LOGFRAME_LEVELS: LogframeLevel[] = ["GOAL", "OUTCOME", "OUTPUT", "ACTIVITY"];

export interface LogframeItemProps {
  parentId?: string;
  level: LogframeLevel;
  code?: string;
  title: string;
  description?: string;
  /** Position among siblings; 0 everywhere means "never reordered" (level/code order applies). */
  sortOrder?: number;
  /** What must hold for this result to lead to the one above it (the logframe's assumptions column). */
  assumptions?: string;
  /** Why this result is expected to lead to its parent (the results framework's causal statement). */
  rationale?: string;
}

export const MAX_LOGIC_TEXT = 4000;

export function logframeLevelRank(level: LogframeLevel): number {
  return LOGFRAME_LEVELS.indexOf(level);
}

/** A parent must sit at a strictly higher level (a level may be skipped, e.g. Output under Goal). */
export function canParentLogframeLevel(parent: LogframeLevel, child: LogframeLevel): boolean {
  return logframeLevelRank(parent) < logframeLevelRank(child);
}

function cleanLogicText(value: string | undefined, label: string): string | undefined {
  const text = (value ?? "").trim();
  if (text.length > MAX_LOGIC_TEXT) throw DomainError.validation(`${label} can be at most ${MAX_LOGIC_TEXT} characters`);
  return text || undefined;
}

export class LogframeItem extends Entity<string> {
  private constructor(
    id: string,
    readonly tenantIdValue: string,
    readonly projectId: string,
    private props: LogframeItemProps,
    createdAt?: Date,
  ) {
    super(id, createdAt);
  }

  static create(input: {
    id: string;
    tenantId: string;
    projectId: string;
    parentId?: string;
    level: LogframeLevel;
    code?: string;
    title: string;
    description?: string;
    assumptions?: string;
    rationale?: string;
  }): LogframeItem {
    if (!LOGFRAME_LEVELS.includes(input.level)) throw DomainError.validation("Invalid logframe level");
    if (!input.title || input.title.trim().length < 2) throw DomainError.validation("Logframe title required");
    const assumptions = cleanLogicText(input.assumptions, "Assumptions");
    const rationale = cleanLogicText(input.rationale, "Rationale");
    return new LogframeItem(input.id, input.tenantId, input.projectId, {
      parentId: input.parentId,
      level: input.level,
      code: input.code,
      title: input.title.trim(),
      description: input.description,
      ...(assumptions ? { assumptions } : {}),
      ...(rationale ? { rationale } : {}),
    });
  }

  static rehydrate(input: {
    id: string;
    tenantId: string;
    projectId: string;
    props: LogframeItemProps;
    createdAt: Date;
  }): LogframeItem {
    return new LogframeItem(input.id, input.tenantId, input.projectId, input.props, input.createdAt);
  }

  get parentId(): string | undefined { return this.props.parentId; }
  get level(): LogframeLevel { return this.props.level; }
  get code(): string | undefined { return this.props.code; }
  get title(): string { return this.props.title; }
  get description(): string | undefined { return this.props.description; }
  get sortOrder(): number { return this.props.sortOrder ?? 0; }
  get assumptions(): string | undefined { return this.props.assumptions; }
  get rationale(): string | undefined { return this.props.rationale; }

  /** Callers must validate the move with `planLogframeMove`; this only records the result. */
  placeAt(parentId: string | undefined, sortOrder: number): void {
    this.props = { ...this.props, parentId, sortOrder };
    this.touch();
  }

  /**
   * A person's correction of the words. The level and code are not editable here (a level changes by a move; a code is how
   * the item is known). An empty text clears assumptions and rationale; an omitted field is kept.
   */
  edit(fields: { title?: string; description?: string; assumptions?: string; rationale?: string }): void {
    const next: LogframeItemProps = { ...this.props };
    if (fields.title !== undefined) {
      if (fields.title.trim().length < 2) throw DomainError.validation("Logframe title required");
      next.title = fields.title.trim();
    }
    if (fields.description !== undefined) {
      const description = fields.description.trim();
      if (description) next.description = description; else delete next.description;
    }
    if (fields.assumptions !== undefined) {
      const text = cleanLogicText(fields.assumptions, "Assumptions");
      if (text) next.assumptions = text; else delete next.assumptions;
    }
    if (fields.rationale !== undefined) {
      const text = cleanLogicText(fields.rationale, "Rationale");
      if (text) next.rationale = text; else delete next.rationale;
    }
    this.props = next;
    this.touch();
  }

  update(patch: Partial<LogframeItemProps>): void {
    this.props = { ...this.props, ...patch };
    this.touch();
  }
}
