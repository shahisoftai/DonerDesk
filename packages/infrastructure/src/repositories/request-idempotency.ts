import { randomUUID } from "node:crypto";
import type { PrismaClient } from "@prisma/client";
import type { IRequestIdempotencyStore, RequestIdempotencyScope, StoredRequest } from "@donordesk/application";
import type { Result } from "@donordesk/domain";
import { DomainError } from "@donordesk/domain";

const unavailable = (): DomainError => new DomainError("INVARIANT_VIOLATION", "Idempotency store unavailable");

const where = (s: RequestIdempotencyScope) => ({ tenantId_userId_route_key: { tenantId: s.tenantId, userId: s.userId, route: s.route, key: s.key } });

export class PrismaRequestIdempotencyRepository implements IRequestIdempotencyStore {
  constructor(private readonly prisma: PrismaClient) {}

  async insertPending(scope: RequestIdempotencyScope, now: Date): Promise<Result<"CREATED" | "EXISTS", DomainError>> {
    try {
      // ON CONFLICT DO NOTHING: the unique key still decides atomically which of two simultaneous requests wins, and a
      // repeated key is an ordinary outcome here, not an error to log.
      const inserted = await this.prisma.requestIdempotency.createMany({
        data: [{ id: randomUUID(), tenantId: scope.tenantId, userId: scope.userId, route: scope.route, key: scope.key, state: "PENDING", createdAt: now }],
        skipDuplicates: true,
      });
      return { ok: true, value: inserted.count === 1 ? "CREATED" : "EXISTS" };
    } catch {
      return { ok: false, error: unavailable() };
    }
  }

  async find(scope: RequestIdempotencyScope): Promise<Result<StoredRequest | null, DomainError>> {
    try {
      const row = await this.prisma.requestIdempotency.findUnique({ where: where(scope) });
      if (!row) return { ok: true, value: null };
      return {
        ok: true,
        value: {
          state: row.state === "DONE" ? "DONE" : "PENDING",
          createdAt: row.createdAt,
          ...(row.statusCode !== null ? { statusCode: row.statusCode } : {}),
          ...(row.responseJson !== null ? { body: row.responseJson } : {}),
          ...(row.contentType ? { contentType: row.contentType } : {}),
        },
      };
    } catch {
      return { ok: false, error: unavailable() };
    }
  }

  async complete(scope: RequestIdempotencyScope, response: { statusCode: number; body: string; contentType?: string }, now: Date): Promise<Result<void, DomainError>> {
    try {
      await this.prisma.requestIdempotency.update({
        where: where(scope),
        data: { state: "DONE", statusCode: response.statusCode, responseJson: response.body, contentType: response.contentType ?? null, completedAt: now },
      });
      return { ok: true, value: undefined };
    } catch {
      return { ok: false, error: unavailable() };
    }
  }

  async release(scope: RequestIdempotencyScope): Promise<Result<void, DomainError>> {
    try {
      await this.prisma.requestIdempotency.deleteMany({ where: { tenantId: scope.tenantId, userId: scope.userId, route: scope.route, key: scope.key } });
      return { ok: true, value: undefined };
    } catch {
      return { ok: false, error: unavailable() };
    }
  }
}
