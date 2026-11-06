import type { IMemberDirectory } from "@donordesk/application";
import { ok } from "@donordesk/domain";
import type { TenantId } from "@donordesk/domain";
import type { PrismaClient } from "@prisma/client";

/** Active project members by lower-cased email. */
export class PrismaMemberDirectory implements IMemberDirectory {
  constructor(private readonly prisma: PrismaClient) {}

  async activeUserIdsByEmail(projectId: string, tenantId: TenantId) {
    const members = await this.prisma.projectMember.findMany({ where: { projectId, tenantId: tenantId.toString(), status: "ACTIVE" }, select: { userId: true } });
    const users = await this.prisma.user.findMany({ where: { tenantId: tenantId.toString(), id: { in: members.map((m) => m.userId) } }, select: { id: true, email: true } });
    return ok(new Map(users.map((u) => [u.email.toLowerCase(), u.id])) as ReadonlyMap<string, string>);
  }
}
