"use server";

import { requireSession } from "@/lib/server/auth-context";
import { gatewayRequest } from "@/lib/server/api-gateway";
import { LegalConsentSchema, type LegalConsent } from "@/lib/server/schemas";
import type { Result } from "@/lib/shared/result";
import type { AppError } from "@/lib/shared/app-error";

export type AcceptLegalTermsResult = Result<LegalConsent, AppError>;

export async function acceptLegalTermsAction(source = "onboarding"): Promise<AcceptLegalTermsResult> {
  const context = await requireSession();
  return gatewayRequest("/v1/legal/consent", LegalConsentSchema, context.token, {
    method: "POST",
    body: { accepted: true, source },
  });
}
