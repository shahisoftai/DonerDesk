import { DomainError, Permissions, type EntryFileItem, type Result, type Role } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { ListPeriodIndicatorsHandler } from "./list-period-indicators.js";

export interface IndicatorEntryFileItem extends EntryFileItem {
  type: string;
  unit?: string | undefined;
}

/**
 * The rows of the period's entry sheet for a downloaded workbook: the same rows and values the Entry Sheet shows, so the file and the
 * screen cannot disagree. Verified and calculated rows are marked locked. The workbook itself is built by the route (infrastructure).
 */
export class GetIndicatorEntryFileHandler {
  constructor(private readonly list: Pick<ListPeriodIndicatorsHandler, "handle">) {}

  async handle(ctx: AuthenticatedContext, reportingPeriodId: string): Promise<Result<{ items: IndicatorEntryFileItem[] }, DomainError>> {
    if (!Permissions.can(ctx.tenant.role as Role, "project.view")) return { ok: false, error: DomainError.forbidden("You cannot download this sheet") };
    const rows = await this.list.handle(ctx, reportingPeriodId);
    if (!rows.ok) return rows;
    return {
      ok: true,
      value: {
        items: rows.value.indicators.map((r) => ({
          id: r.id, code: r.code, name: r.name, type: r.type, ...(r.unit ? { unit: r.unit } : {}),
          baseline: r.baseline, target: r.target,
          previousCumulative: r.previous?.cumulativeAchievement ?? "",
          periodAchievement: r.update?.periodAchievement ?? "",
          cumulativeAchievement: r.update?.cumulativeAchievement ?? "",
          comments: r.update?.comments ?? "",
          dataSource: r.update?.dataSource ?? "",
          locked: Boolean(r.calculation) || r.update?.verificationStatus === "VERIFIED",
        })),
      },
    };
  }
}
