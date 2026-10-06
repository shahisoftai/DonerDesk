import type { DomainError, Result } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";

export const MAX_BULK_VERIFY = 100;

export interface BulkVerifyItemResult {
  evidenceId: string;
  ok: boolean;
  error?: string;
}

/** What a bulk verify needs: the one-file verify (which writes its own audit event per file). */
export interface EvidenceVerifier {
  handle(ctx: AuthenticatedContext, evidenceId: string): Promise<Result<void, DomainError>>;
}

/** Verifies a month's files in one action, one result per file, so a failure never hides behind a total. */
export class BulkVerifyEvidenceHandler {
  constructor(private readonly verifier: EvidenceVerifier) {}

  async handle(ctx: AuthenticatedContext, input: { evidenceIds: string[] }): Promise<{ results: BulkVerifyItemResult[]; succeeded: number; failed: number }> {
    const ids = [...new Set(input.evidenceIds)].slice(0, MAX_BULK_VERIFY);
    const results: BulkVerifyItemResult[] = [];
    for (const evidenceId of ids) {
      const r = await this.verifier.handle(ctx, evidenceId);
      results.push(r.ok ? { evidenceId, ok: true } : { evidenceId, ok: false, error: r.error.message });
    }
    const succeeded = results.filter((r) => r.ok).length;
    return { results, succeeded, failed: results.length - succeeded };
  }
}
