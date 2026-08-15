import "server-only";
import { cache } from "react";
import { gatewayRequest } from "@/lib/server/api-gateway";
import {
  TeamResponseSchema,
  OrganizationProfileSchema,
  LegalConsentSchema,
  type LegalConsent,
} from "@/lib/server/schemas";
import type { Result } from "@/lib/shared/result";
import type { AppError } from "@/lib/shared/app-error";

/**
 * Account-level onboarding snapshot. Project-specific counts (templates,
 * logframe, evidence) are intentionally absent — project setup is tracked per
 * project via Feature 18's setup checklist, not at account onboarding.
 */
export type OnboardingSnapshot = {
  orgName: string;
  hasOrg: boolean;
  orgProfileComplete: boolean;
  storageProvider: string;
  teamCount: number;
  legalConsent: LegalConsent;
  reportingDefaultsComplete: boolean;
  defaultReportingTone?: string;
  defaultReportingLanguage?: string;
};

export type OnboardingLoad = {
  snapshot: Result<OnboardingSnapshot, AppError>;
};

export const loadOnboarding = cache(async (token: string): Promise<OnboardingLoad> => {
  const [orgResult, teamResult, consentResult] = await Promise.all([
    gatewayRequest("/v1/organization", OrganizationProfileSchema, token),
    gatewayRequest("/v1/users", TeamResponseSchema, token),
    gatewayRequest("/v1/legal/consent", LegalConsentSchema, token),
  ]);

  if (!orgResult.ok && !teamResult.ok) {
    const primaryError = orgResult.ok ? teamResult.error : orgResult.error;
    return {
      snapshot: {
        ok: false,
        error: primaryError ?? { kind: "unavailable", message: "Could not load onboarding status.", retryable: true },
      },
    };
  }

  const org = orgResult.ok ? orgResult.value : null;
  const orgName = org?.name ?? "";
  const hasOrg = orgResult.ok && orgName.length > 0;
  const orgProfileComplete = hasOrg && Boolean(org?.country) && org?.country !== "UNKNOWN";

  const defaults = org?.reportingDefaults;
  const reportingDefaultsComplete = Boolean(
    defaults && (defaults.tone !== "FORMAL" || (defaults.formattingRules ?? []).length > 0 || defaults.autoPeriodCreation),
  );

  const snapshot: OnboardingSnapshot = {
    orgName,
    hasOrg,
    orgProfileComplete,
    storageProvider: orgResult.ok ? (org?.storageProvider ?? "LOCAL") : "LOCAL",
    teamCount: teamResult.ok ? teamResult.value.items.length : 0,
    legalConsent: consentResult.ok
      ? consentResult.value
      : { accepted: false, termsVersion: "", privacyVersion: "" },
    reportingDefaultsComplete,
    defaultReportingTone: defaults?.tone,
    defaultReportingLanguage: defaults ? org?.defaultLanguage : undefined,
  };

  return { snapshot: { ok: true, value: snapshot } };
});
