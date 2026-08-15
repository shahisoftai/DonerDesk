import type { Result } from "@donordesk/domain";
import { DomainError } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { IAuditRepository } from "../../ports/support.js";
import { CONSENT_EVENT_TYPE, LEGAL_DOCUMENT_VERSIONS, type LegalConsentRecord } from "./record-legal-consent.js";

export class GetLegalConsentHandler {
  constructor(private readonly repo: IAuditRepository) {}

  async handle(ctx: AuthenticatedContext): Promise<Result<LegalConsentRecord, DomainError>> {
    const r = await this.repo.listByTenant(ctx.tenant.tenantId, {
      eventType: CONSENT_EVENT_TYPE,
      actorId: ctx.tenant.userId,
      limit: 1,
    });
    if (!r.ok) return r;

    const latest = r.value[0];
    if (!latest?.newValue) {
      return {
        ok: true,
        value: {
          accepted: false,
          termsVersion: LEGAL_DOCUMENT_VERSIONS.terms,
          privacyVersion: LEGAL_DOCUMENT_VERSIONS.privacy,
        },
      };
    }

    try {
      const stored = JSON.parse(latest.newValue) as Partial<LegalConsentRecord>;
      return {
        ok: true,
        value: {
          accepted: Boolean(stored.accepted),
          termsVersion: stored.termsVersion ?? LEGAL_DOCUMENT_VERSIONS.terms,
          privacyVersion: stored.privacyVersion ?? LEGAL_DOCUMENT_VERSIONS.privacy,
          acceptedAt: stored.acceptedAt,
          actorId: stored.actorId ?? latest.actorId,
          source: stored.source,
        },
      };
    } catch {
      return {
        ok: true,
        value: {
          accepted: false,
          termsVersion: LEGAL_DOCUMENT_VERSIONS.terms,
          privacyVersion: LEGAL_DOCUMENT_VERSIONS.privacy,
        },
      };
    }
  }
}
