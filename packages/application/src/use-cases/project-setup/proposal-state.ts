import type { Result, Role } from "@donordesk/domain";
import { DomainError, Permissions, emptyProposal } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { StoredSetupProposal } from "../../ports/project-setup.js";

/** A project document's dates are its content, not anyone's birth date: the model must see them, and the grounding check reads the same text. */
export const SETUP_PII_KEEP = ["DATE_OF_BIRTH"] as const;

/** A part still "reading" after this long has stopped (a restart, a lost request); it is shown as failed so it can be read again. */
export const STALE_AREA_RUN_MS = 6 * 60_000;

/** A proposal with nothing proposed yet: every fact "Not stated", every area empty. The domain owns the shape. */
export const emptySetupProposal = emptyProposal;

/**
 * A proposal is private to its creator and to organisation managers: anyone else is told "not found", never "someone
 * else's". Expired proposals are read-only in every direction; the stored source is deleted at expiry.
 */
export function assertProposalAccess(ctx: AuthenticatedContext, stored: StoredSetupProposal, now: Date): Result<void, DomainError> {
  const isCreator = stored.createdById === ctx.tenant.userId;
  const isManager = Permissions.can(ctx.tenant.role as Role, "org.manage");
  if (!isCreator && !isManager) return { ok: false, error: DomainError.notFound("Setup proposal", stored.id) };
  if (stored.expiresAt.getTime() < now.getTime()) {
    return { ok: false, error: DomainError.validation("This proposal has expired and its document was deleted. Start again with a fresh upload.") };
  }
  return { ok: true, value: undefined };
}

export const SETUP_PROPOSAL_TTL_DAYS = 30;

export function proposalExpiry(from: Date): Date {
  return new Date(from.getTime() + SETUP_PROPOSAL_TTL_DAYS * 24 * 60 * 60 * 1000);
}
