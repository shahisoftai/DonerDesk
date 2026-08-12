import { z } from "zod";

export const AuthResponseSchema = z.object({
  token: z.string().min(1),
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

export type AuthFormState = { error: string | null; fields?: Record<string, string[]> };

export type SessionInfo = z.infer<typeof SessionInfoSchema>;
