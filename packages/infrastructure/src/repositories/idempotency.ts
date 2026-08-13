import { randomUUID } from "node:crypto";
import { PrismaClient, Prisma } from "@prisma/client";
import type { IIdempotencyStore, IdempotencyAcquireInput } from "@donordesk/application";
import type { Result } from "@donordesk/domain";
import { DomainError } from "@donordesk/domain";

export class PrismaIdempotencyRepository implements IIdempotencyStore {
  constructor(private readonly prisma: PrismaClient) {}

  async acquire(input: IdempotencyAcquireInput): Promise<Result<{ acquired: boolean }, DomainError>> {
    try {
      await this.prisma.idempotencyRecord.create({
        data: {
          id: randomUUID(),
          tenantId: input.tenantId,
          key: input.key,
          jobName: input.jobName,
          entityId: input.entityId,
        },
      });
      return { ok: true, value: { acquired: true } };
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        return { ok: true, value: { acquired: false } };
      }
      return { ok: false, error: new DomainError("INVARIANT_VIOLATION", "Idempotency store unavailable") };
    }
  }
}
