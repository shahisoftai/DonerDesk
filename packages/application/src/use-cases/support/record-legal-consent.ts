import type { Result } from "@donordesk/domain";
import { DomainError } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { IAuditLogger } from "../../ports/core.js";

export const LEGAL_DOCUMENT_VERSIONS = {
  terms: "2026-08-14",
  privacy: "2026-08-14",
} as const;

export type LegalConsentRecord = {
  accepted: boolean;
  termsVersion: string;
  privacyVersion: string;
  acceptedAt?: string;
  actorId?: string;
  source?: string;
};

export const CONSENT_EVENT_TYPE = "legal.consent.recorded";

export interface RecordLegalConsentCommand {
  accepted: boolean;
  source?: string;
}

export class RecordLegalConsentHandler {
  constructor(private readonly audit: IAuditLogger) {}

  async handle(
    ctx: AuthenticatedContext,
    cmd: RecordLegalConsentCommand,
  ): Promise<Result<LegalConsentRecord, DomainError>> {
    if (!cmd.accepted) {
      return {
        ok: false,
        error: DomainError.validation("Consent must be explicitly accepted before it can be recorded."),
      };
    }

    const acceptedAt = new Date();
    const record: LegalConsentRecord = {
      accepted: true,
      termsVersion: LEGAL_DOCUMENT_VERSIONS.terms,
      privacyVersion: LEGAL_DOCUMENT_VERSIONS.privacy,
      acceptedAt: acceptedAt.toISOString(),
      actorId: ctx.tenant.userId,
      source: cmd.source ?? "onboarding",
    };

    await this.audit.record({
      tenantId: ctx.tenant.tenantId,
      actorId: ctx.tenant.userId,
      eventType: CONSENT_EVENT_TYPE,
      entityType: "organization",
      entityId: ctx.tenant.tenantId.toString(),
      newValue: JSON.stringify(record),
      ipAddress: ctx.ipAddress,
      systemNote: `User ${ctx.tenant.userId} accepted the Terms of Service (${record.termsVersion}) and Privacy Policy (${record.privacyVersion}) via ${record.source}.`,
    });

    return { ok: true, value: record };
  }
}
