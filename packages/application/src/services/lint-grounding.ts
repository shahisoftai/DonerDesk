import type { TenantId, VerifiedFinding } from "@donordesk/domain";
import type { IEvidencePackageBuilder, IRecordChunkBuilder, RecordChunk } from "../ports/reporting.js";
import type { IFinanceInputs } from "./finance-inputs.js";
import { figuresInRecords, recordChunksFromEvidence, recordChunksFromFinance, recordChunksFromFindings } from "./record-chunk-builder.js";

/** The figures a report of one period may legitimately quote beyond its own indicator values. */
export interface ILintGrounding {
  figures(input: { tenantId: TenantId; projectId: string; reportingPeriodId: string; findings: ReadonlyArray<VerifiedFinding> }): Promise<string[]>;
}

/**
 * Standalone figures stated by the project's own records, the verified findings (life-of-project totals,
 * breakdowns), the verified finance and the evidence on file. The cross-section contradiction lint accepts them,
 * so a report quoting the project budget, a participant count or a life-of-project total is not "contradicting"
 * the data. Best-effort: a failed load simply grounds fewer figures.
 */
export class LintGrounding implements ILintGrounding {
  constructor(
    private readonly records: IRecordChunkBuilder,
    private readonly evidencePackages: IEvidencePackageBuilder,
    /** Absent when the deployment has no finance support. */
    private readonly finance?: IFinanceInputs,
  ) {}

  async figures(input: { tenantId: TenantId; projectId: string; reportingPeriodId: string; findings: ReadonlyArray<VerifiedFinding> }): Promise<string[]> {
    const chunks: RecordChunk[] = [];
    const scope = { tenantId: input.tenantId, projectId: input.projectId, reportingPeriodId: input.reportingPeriodId };
    const built = await this.records.build(scope);
    if (built.ok) chunks.push(...built.value);
    chunks.push(...recordChunksFromFindings([...input.findings]));
    if (this.finance) {
      const finance = await this.finance.verifiedForPeriod(input.reportingPeriodId, input.projectId, input.tenantId);
      if (finance.ok && finance.value) chunks.push(...recordChunksFromFinance(finance.value));
    }
    const ids = await this.records.evidenceIds(scope);
    if (ids.ok && ids.value.length > 0) {
      const packages = await this.evidencePackages.build({ tenantId: input.tenantId, evidenceIds: ids.value });
      if (packages.ok) chunks.push(...recordChunksFromEvidence(packages.value));
    }
    return figuresInRecords(chunks);
  }
}
