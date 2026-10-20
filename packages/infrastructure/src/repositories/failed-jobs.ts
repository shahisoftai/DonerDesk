import { randomUUID } from "node:crypto";
import type { PrismaClient } from "@prisma/client";
import type { IFailedJobStore } from "@donordesk/application";

const HOLD_MINUTES = 5;
const MAX_ERROR = 500;

export class PrismaFailedJobStore implements IFailedJobStore {
  constructor(private readonly prisma: PrismaClient) {}

  async record(input: { tenantId: string; jobName: string; payload: Record<string, unknown>; error: string; now: Date }): Promise<void> {
    await this.prisma.jobOutbox.create({
      data: {
        id: randomUUID(),
        tenantId: input.tenantId,
        jobName: input.jobName,
        payloadJson: JSON.stringify(input.payload),
        lastError: input.error.slice(0, MAX_ERROR),
        attempts: 1,
        // The first retry is soon: most failures are a service restarting.
        nextAttemptAt: new Date(input.now.getTime() + 30_000),
      },
    });
  }

  // The columns are `timestamp` (UTC, no zone); a bare Date parameter would be read in the session time zone (the host is
  // CEST), so each is converted to UTC explicitly.
  async claimDue(now: Date, limit: number): Promise<Array<{ id: string; jobName: string; payload: Record<string, unknown>; attempts: number }>> {
    const rows = await this.prisma.$queryRaw<Array<{ id: string; jobName: string; payloadJson: string; attempts: number }>>`
      UPDATE "JobOutbox"
      SET "nextAttemptAt" = (${new Date(now.getTime() + HOLD_MINUTES * 60_000)}::timestamptz AT TIME ZONE 'UTC'), "updatedAt" = (${now}::timestamptz AT TIME ZONE 'UTC')
      WHERE id IN (
        SELECT id FROM "JobOutbox"
        WHERE status = 'PENDING' AND "nextAttemptAt" <= (${now}::timestamptz AT TIME ZONE 'UTC')
        ORDER BY "nextAttemptAt"
        LIMIT ${limit}
        FOR UPDATE SKIP LOCKED
      )
      RETURNING id, "jobName", "payloadJson", attempts`;
    return rows.map((r) => ({ id: r.id, jobName: r.jobName, payload: JSON.parse(r.payloadJson) as Record<string, unknown>, attempts: r.attempts }));
  }

  async markDone(id: string): Promise<void> {
    await this.prisma.jobOutbox.update({ where: { id }, data: { status: "DONE", lastError: null } });
  }

  async markFailed(id: string, error: string, nextAttemptAt: Date | null): Promise<void> {
    await this.prisma.jobOutbox.update({
      where: { id },
      data: {
        attempts: { increment: 1 },
        lastError: error.slice(0, MAX_ERROR),
        ...(nextAttemptAt ? { nextAttemptAt } : { status: "DEAD" }),
      },
    });
  }

  async countDead(): Promise<number> {
    return this.prisma.jobOutbox.count({ where: { status: "DEAD" } });
  }
}
