import { ok, TenantId, type Result } from "@donordesk/domain";
import type { EntitlementService, IEntitlementGrantRepository, ITrialStatus } from "@donordesk/application";
import type { PrismaClient } from "@prisma/client";

/**
 * Reads where an organisation stands on its free trial for the reminder run: the end of its latest trial grant, unless it now pays
 * (a paid subscription supersedes the trial, so there is nothing to warn about), and who administers the account.
 */
export class PrismaTrialStatus implements ITrialStatus {
  constructor(private readonly grants: IEntitlementGrantRepository, private readonly entitlements: EntitlementService, private readonly prisma: PrismaClient) {}

  async trialEnd(tenantId: TenantId): Promise<Result<Date | null>> {
    const all = await this.grants.listByTenant(tenantId.toString());
    if (!all.ok) return all;
    const ends = all.value.filter((g) => g.source === "TRIAL" && g.effectiveUntil).map((g) => g.effectiveUntil!.getTime());
    if (ends.length === 0) return ok(null);
    const current = await this.entitlements.resolve({ tenantId: tenantId.toString() });
    if (current.ok && current.value.source === "CREEM_SUBSCRIPTION") return ok(null);
    return ok(new Date(Math.max(...ends)));
  }

  async administrators(tenantId: TenantId): Promise<Result<string[]>> {
    const rows = await this.prisma.user.findMany({ where: { tenantId: tenantId.toString(), status: "ACTIVE", role: "ADMIN" }, select: { id: true } });
    return ok(rows.map((r) => r.id));
  }
}
