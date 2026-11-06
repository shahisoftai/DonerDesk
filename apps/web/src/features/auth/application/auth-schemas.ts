import { z } from "zod";

export const AuthResponseSchema = z.object({
  token: z.string().min(1),
  provisioned: z.boolean().optional(),
  trialGranted: z.boolean().optional(),
});

export const SessionInfoSchema = z.object({
  sub: z.string().optional(),
  name: z.string().optional(),
  email: z.string().optional(),
  role: z.string().nullable().optional(),
  tenantId: z.string().optional(),
  exp: z.number().optional(),
  iat: z.number().optional(),
});

/** The password step answered "now the code": the page shows a code field and sends this back with it. */
export const MfaChallengeResponseSchema = z.object({ mfaRequired: z.literal(true), challenge: z.string().min(10) });

export type AuthFormState = { error: string | null; fields?: Record<string, string[]>; mfaChallenge?: string };

export type SessionInfo = z.infer<typeof SessionInfoSchema>;
