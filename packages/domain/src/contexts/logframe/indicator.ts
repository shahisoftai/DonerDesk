import { Entity } from "../../core/entity.js";
import { DomainError } from "../../core/domain-error.js";
import type { IndicatorSemantics } from "./indicator-semantics.js";

export type IndicatorType = "NUMBER" | "PERCENTAGE" | "YES_NO" | "TEXT" | "RATIO" | "CURRENCY" | "CUSTOM";

export const INDICATOR_TYPES: IndicatorType[] = ["NUMBER", "PERCENTAGE", "YES_NO", "TEXT", "RATIO", "CURRENCY", "CUSTOM"];

export interface IndicatorProps {
  logframeItemId: string;
  code: string;
  name: string;
  type: IndicatorType;
  baseline: string;
  target: string;
  unit?: string;
  meansOfVerification?: string;
  dataSource?: string;
  frequency?: string;
  responsibleUserId?: string;
  disaggregationRequired: boolean;
  /** Serialized IndicatorSemantics; absent for legacy rows (conservative defaults apply). */
  semanticsJson?: string;
}

export class Indicator extends Entity<string> {
  private constructor(
    id: string,
    readonly tenantIdValue: string,
    readonly projectId: string,
    private props: IndicatorProps,
    createdAt?: Date,
  ) {
    super(id, createdAt);
  }

  static create(input: {
    id: string;
    tenantId: string;
    projectId: string;
    logframeItemId: string;
    code: string;
    name: string;
    type: IndicatorType;
    baseline: string;
    target: string;
    unit?: string;
    meansOfVerification?: string;
    dataSource?: string;
    frequency?: string;
    responsibleUserId?: string;
    disaggregationRequired?: boolean;
  }): Indicator {
    if (!input.code) throw DomainError.validation("Indicator code required");
    if (!input.name) throw DomainError.validation("Indicator name required");
    if (!INDICATOR_TYPES.includes(input.type)) throw DomainError.validation("Invalid indicator type");
    return new Indicator(input.id, input.tenantId, input.projectId, {
      logframeItemId: input.logframeItemId,
      code: input.code,
      name: input.name,
      type: input.type,
      baseline: input.baseline ?? "",
      target: input.target ?? "",
      unit: input.unit,
      meansOfVerification: input.meansOfVerification,
      dataSource: input.dataSource,
      frequency: input.frequency,
      responsibleUserId: input.responsibleUserId,
      disaggregationRequired: input.disaggregationRequired ?? false,
    });
  }

  static rehydrate(input: {
    id: string;
    tenantId: string;
    projectId: string;
    props: IndicatorProps;
    createdAt: Date;
  }): Indicator {
    return new Indicator(input.id, input.tenantId, input.projectId, input.props, input.createdAt);
  }

  get logframeItemId(): string { return this.props.logframeItemId; }
  get code(): string { return this.props.code; }
  get name(): string { return this.props.name; }
  get type(): IndicatorType { return this.props.type; }
  get baseline(): string { return this.props.baseline; }
  get target(): string { return this.props.target; }
  get unit(): string | undefined { return this.props.unit; }
  get meansOfVerification(): string | undefined { return this.props.meansOfVerification; }
  get dataSource(): string | undefined { return this.props.dataSource; }
  get frequency(): string | undefined { return this.props.frequency; }
  get responsibleUserId(): string | undefined { return this.props.responsibleUserId; }
  get disaggregationRequired(): boolean { return this.props.disaggregationRequired; }
  get semanticsJson(): string | undefined { return this.props.semanticsJson; }

  get semantics(): IndicatorSemantics | undefined {
    if (!this.props.semanticsJson) return undefined;
    try {
      return JSON.parse(this.props.semanticsJson) as IndicatorSemantics;
    } catch {
      return undefined;
    }
  }

  update(patch: Partial<IndicatorProps>): void {
    this.props = { ...this.props, ...patch };
    this.touch();
  }
}
