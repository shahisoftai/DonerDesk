import { Entity } from "../../core/entity.js";
import { DomainError } from "../../core/domain-error.js";

export type RiskLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export interface RiskTrendProps {
  projectId: string;
  periodStart: Date;
  periodEnd: Date;
  riskScore: number;
  riskLevel: RiskLevel;
  contributingFactors: RiskFactor[];
  missingEvidenceCount: number;
  deadlineSlipsCount: number;
  overdueChecklistItemsCount: number;
  lastUpdated: Date;
}

export interface RiskFactor {
  type: "missing_evidence" | "deadline_slip" | "indicator_gap" | "budget_variance" | "staffing_gap" | "compliance_flag";
  weight: number;
  description: string;
  affectedIndicatorIds: string[];
  severity: RiskLevel;
}

export class ProjectRiskTrend extends Entity<string> {
  private constructor(
    id: string,
    readonly tenantIdValue: string,
    private props: RiskTrendProps,
    createdAt?: Date,
  ) {
    super(id, createdAt);
  }

  static create(input: {
    id: string;
    tenantId: string;
    projectId: string;
    periodStart: Date;
    periodEnd: Date;
    riskScore?: number;
  }): ProjectRiskTrend {
    if (!input.id.trim() || !input.tenantId.trim() || !input.projectId.trim()) {
      throw DomainError.validation("Risk trend identifiers are required");
    }
    if (input.periodStart >= input.periodEnd) {
      throw DomainError.validation("Risk trend period start must precede period end");
    }
    if (input.riskScore !== undefined && (!Number.isFinite(input.riskScore) || input.riskScore < 0 || input.riskScore > 100)) {
      throw DomainError.validation("Risk score must be between 0 and 100");
    }
    const initialScore = input.riskScore ?? 0;
    return new ProjectRiskTrend(
      input.id,
      input.tenantId,
      {
        projectId: input.projectId,
        periodStart: input.periodStart,
        periodEnd: input.periodEnd,
        riskScore: initialScore,
        riskLevel: ProjectRiskTrend.calculateRiskLevel(initialScore),
        contributingFactors: [],
        missingEvidenceCount: 0,
        deadlineSlipsCount: 0,
        overdueChecklistItemsCount: 0,
        lastUpdated: new Date(),
      },
    );
  }

  static rehydrate(input: {
    id: string;
    tenantId: string;
    props: RiskTrendProps;
    createdAt: Date;
  }): ProjectRiskTrend {
    return new ProjectRiskTrend(input.id, input.tenantId, input.props, input.createdAt);
  }

  get projectId(): string { return this.props.projectId; }
  get periodStart(): Date { return new Date(this.props.periodStart.getTime()); }
  get periodEnd(): Date { return new Date(this.props.periodEnd.getTime()); }
  get riskScore(): number { return this.props.riskScore; }
  get riskLevel(): RiskLevel { return this.props.riskLevel; }
  get contributingFactors(): RiskFactor[] {
    return this.props.contributingFactors.map((factor) => ({
      ...factor,
      affectedIndicatorIds: [...factor.affectedIndicatorIds],
    }));
  }
  get missingEvidenceCount(): number { return this.props.missingEvidenceCount; }
  get deadlineSlipsCount(): number { return this.props.deadlineSlipsCount; }
  get overdueChecklistItemsCount(): number { return this.props.overdueChecklistItemsCount; }
  get lastUpdated(): Date { return new Date(this.props.lastUpdated.getTime()); }

  static calculateRiskLevel(score: number): RiskLevel {
    if (score >= 75) return "CRITICAL";
    if (score >= 50) return "HIGH";
    if (score >= 25) return "MEDIUM";
    return "LOW";
  }

  updateMetrics(patches: {
    missingEvidenceCount?: number;
    deadlineSlipsCount?: number;
    overdueChecklistItemsCount?: number;
    contributingFactors?: RiskFactor[];
  }): void {
    for (const value of [patches.missingEvidenceCount, patches.deadlineSlipsCount, patches.overdueChecklistItemsCount]) {
      if (value !== undefined && (!Number.isInteger(value) || value < 0)) {
        throw DomainError.validation("Risk metric counts must be non-negative integers");
      }
    }
    if (patches.contributingFactors?.some((factor) => !Number.isFinite(factor.weight) || factor.weight < 0 || factor.weight > 100)) {
      throw DomainError.validation("Risk factor weights must be between 0 and 100");
    }
    if (patches.missingEvidenceCount !== undefined) {
      this.props.missingEvidenceCount = patches.missingEvidenceCount;
    }
    if (patches.deadlineSlipsCount !== undefined) {
      this.props.deadlineSlipsCount = patches.deadlineSlipsCount;
    }
    if (patches.overdueChecklistItemsCount !== undefined) {
      this.props.overdueChecklistItemsCount = patches.overdueChecklistItemsCount;
    }
    if (patches.contributingFactors !== undefined) {
      this.props.contributingFactors = patches.contributingFactors;
    }
    this.recalculateScore();
    this.props.lastUpdated = new Date();
    this.touch();
  }

  private recalculateScore(): void {
    const maxScores = {
      missingEvidence: 30,
      deadlineSlip: 25,
      overdueChecklist: 20,
      budgetVariance: 15,
      staffingGap: 10,
    };

    let score = 0;

    score += Math.min(this.props.missingEvidenceCount * 3, maxScores.missingEvidence);
    score += Math.min(this.props.deadlineSlipsCount * 5, maxScores.deadlineSlip);
    score += Math.min(this.props.overdueChecklistItemsCount * 4, maxScores.overdueChecklist);

    for (const factor of this.props.contributingFactors) {
      if (factor.type === "budget_variance") {
        score += Math.min(factor.weight, 100) * 0.15;
      }
      if (factor.type === "staffing_gap") {
        score += Math.min(factor.weight, 100) * 0.10;
      }
    }

    this.props.riskScore = Math.min(100, Math.round(score));
    this.props.riskLevel = ProjectRiskTrend.calculateRiskLevel(this.props.riskScore);
  }

  addRiskFactor(factor: RiskFactor): void {
    if (!Number.isFinite(factor.weight) || factor.weight < 0 || factor.weight > 100) {
      throw DomainError.validation("Risk factor weight must be between 0 and 100");
    }
    const existing = this.props.contributingFactors.findIndex(
      (f) => f.type === factor.type && f.affectedIndicatorIds.some((id) => factor.affectedIndicatorIds.includes(id)),
    );
    if (existing >= 0) {
      this.props.contributingFactors[existing] = factor;
    } else {
      this.props.contributingFactors.push(factor);
    }
    this.recalculateScore();
    this.props.lastUpdated = new Date();
    this.touch();
  }

  removeRiskFactor(type: RiskFactor["type"], indicatorId?: string): void {
    this.props.contributingFactors = this.props.contributingFactors.filter((f) => {
      if (f.type !== type) return true;
      if (indicatorId && f.affectedIndicatorIds.includes(indicatorId)) return false;
      return true;
    });
    this.recalculateScore();
    this.props.lastUpdated = new Date();
    this.touch();
  }
}

export interface OrganizationRiskSummary {
  tenantId: string;
  organizationId: string;
  totalProjects: number;
  highRiskProjects: number;
  criticalRiskProjects: number;
  averageRiskScore: number;
  riskTrend: "improving" | "stable" | "deteriorating";
  topRiskFactors: Array<{ factor: string; count: number; averageSeverity: number }>;
  lastUpdated: Date;
}
