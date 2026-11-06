import { z } from "zod";

/** Where a person accepted the Terms; every place the web records consent must be listed here. */
export const CONSENT_SOURCES = ["onboarding", "invitation", "portal", "api"] as const;

export const RecordConsentSchema = z.object({
  accepted: z.literal(true, { errorMap: () => ({ message: "Consent must be explicitly accepted." }) }),
  source: z.enum(CONSENT_SOURCES).default("onboarding"),
});
export type RecordConsentInput = z.infer<typeof RecordConsentSchema>;
