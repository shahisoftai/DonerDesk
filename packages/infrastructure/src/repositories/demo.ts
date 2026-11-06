import { PrismaClient } from "@prisma/client";
import { DomainError, type Result, type TenantId } from "@donordesk/domain";
import type { IDemoProjectRepository } from "@donordesk/application";

interface ForeignKey { child: string; childColumn: string; parent: string; parentColumn: string }

/**
 * Deletes everything a DonorDesk Academy demo project (Feature 22) owns.
 * Scoped to `isDemo` projects only by the calling handler.
 *
 * The rows to remove are found from the database's own foreign keys, children first, so a table added later (a report revision,
 * a planned activity, a risk, a mapping decision) is covered without anyone remembering to list it here. The old hand-kept list
 * missed `ReportRevision` and failed with a foreign-key error as soon as the demo had a generated report. `AuditEvent` and
 * `Comment` carry no foreign keys (plain string references), so they are never deleted: the audit trail survives the entity it
 * describes. The whole delete is one transaction: it all happens or none of it does.
 */
export class PrismaDemoProjectRepository implements IDemoProjectRepository {
  constructor(private readonly prisma: PrismaClient) {}

  /** Single-column foreign keys of the schema (every relation Prisma creates is one). */
  private async foreignKeys(tx: Pick<PrismaClient, "$queryRawUnsafe">): Promise<ForeignKey[]> {
    return tx.$queryRawUnsafe<ForeignKey[]>(`
      SELECT quote_ident(cc.relname) AS child, quote_ident(ca.attname) AS "childColumn",
             quote_ident(pc.relname) AS parent, quote_ident(pa.attname) AS "parentColumn"
      FROM pg_constraint con
      JOIN pg_class cc ON cc.oid = con.conrelid
      JOIN pg_class pc ON pc.oid = con.confrelid
      JOIN pg_namespace ns ON ns.oid = cc.relnamespace AND ns.nspname = 'public'
      JOIN pg_attribute ca ON ca.attrelid = con.conrelid AND ca.attnum = con.conkey[1]
      JOIN pg_attribute pa ON pa.attrelid = con.confrelid AND pa.attnum = con.confkey[1]
      WHERE con.contype = 'f' AND array_length(con.conkey, 1) = 1`);
  }

  async deleteDemoProjectData(tenantId: TenantId, projectId: string): Promise<Result<void, DomainError>> {
    const tid = tenantId.toString();
    try {
      await this.prisma.$transaction(async (tx) => {
        const keys = await this.foreignKeys(tx);
        // Removes the rows of `table` matching `where` after everything that points at them (children first).
        const purge = async (table: string, where: string, path: ReadonlySet<string>): Promise<void> => {
          for (const fk of keys) {
            if (fk.parent !== table || fk.child === table || path.has(fk.child)) continue;
            await purge(fk.child, `${fk.childColumn} IN (SELECT ${fk.parentColumn} FROM ${table} WHERE ${where})`, new Set([...path, table]));
          }
          await tx.$executeRawUnsafe(`DELETE FROM ${table} WHERE ${where}`, projectId, tid);
        };
        await purge('"Project"', `"id" = $1 AND "tenantId" = $2 AND "isDemo" = true`, new Set());
      });
      return { ok: true, value: undefined };
    } catch (e) {
      return { ok: false, error: DomainError.conflict(`Failed to delete demo project: ${String(e)}`) };
    }
  }
}
