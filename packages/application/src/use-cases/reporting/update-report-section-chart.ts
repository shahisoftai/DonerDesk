import type { Result } from "@donordesk/domain";
import { DomainError } from "@donordesk/domain";
import { createChartConfig, allowedChartTypes, bindingsForSection } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { IReportSectionRepository } from "../../ports/reporting.js";
import type { IAuditLogger } from "../../ports/core.js";
import type { ChartConfigInput } from "@donordesk/contracts";

export class UpdateReportSectionChartHandler {
  constructor(private readonly sections: IReportSectionRepository, private readonly audit: IAuditLogger) {}

  async handle(
    ctx: AuthenticatedContext,
    sectionId: string,
    input: { chartConfig: ChartConfigInput | null; expectedVersion?: string },
  ): Promise<Result<{ version: string; chartConfig: ChartConfigInput | null }, DomainError>> {
    const r = await this.sections.findById(sectionId, ctx.tenant.tenantId);
    if (!r.ok) return r;
    if (!r.value) return { ok: false, error: DomainError.notFound("ReportSection", sectionId) };
    const sec = r.value;

    const currentVersion = sec.updatedAt.toISOString();
    if (input.expectedVersion !== undefined && input.expectedVersion !== currentVersion) {
      return {
        ok: false,
        error: DomainError.conflict(
          "This section was changed by someone else. Reload to see the latest version before saving.",
        ),
      };
    }

    // A chart must be able to show its data and belong in its section: no pie of baseline/target/achievement, and no indicator
    // chart on a financial section (its chart comes from its own finance table).
    if (input.chartConfig) {
      const { type, dataBinding } = input.chartConfig;
      if (!allowedChartTypes(dataBinding).includes(type)) {
        return { ok: false, error: DomainError.validation(`A ${type.toLowerCase()} chart cannot show this data. Choose ${allowedChartTypes(dataBinding).map((t) => t.toLowerCase()).join(" or ")}.`) };
      }
      if (!bindingsForSection(sec.sectionTitle).includes(dataBinding)) {
        return { ok: false, error: DomainError.validation("This section has no indicator data to chart. Charts for its tables are drawn automatically.") };
      }
    }

    sec.setChartConfig(
      input.chartConfig
        ? createChartConfig({ type: input.chartConfig.type, dataBinding: input.chartConfig.dataBinding, options: input.chartConfig.options })
        : null,
    );
    const saved = await this.sections.update(sec);
    if (!saved.ok) return saved;

    await this.audit.record({
      tenantId: ctx.tenant.tenantId,
      actorId: ctx.tenant.userId,
      eventType: "report.section.chart.updated",
      entityType: "report_section",
      entityId: sectionId,
      newValue: JSON.stringify(sec.chartConfig),
    });

    return {
      ok: true,
      value: {
        version: saved.value.updatedAt.toISOString(),
        chartConfig: sec.chartConfig
          ? { type: sec.chartConfig.type, dataBinding: sec.chartConfig.dataBinding, options: sec.chartConfig.options }
          : null,
      },
    };
  }
}
