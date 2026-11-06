import { z } from "zod";

export const AskOutcomeSchema = z.discriminatedUnion("available", [
  z.object({ available: z.literal(false), reason: z.string() }),
  z.object({
    available: z.literal(true),
    status: z.enum(["ANSWERED", "NOT_FOUND"]),
    answer: z.array(z.string()),
    sentences: z.array(z.object({
      text: z.string(),
      sources: z.array(z.object({ id: z.string(), label: z.string(), kind: z.enum(["PROJECT", "INDICATOR", "ACTIVITY", "EVIDENCE"]), status: z.string().optional() })),
    })),
    missing: z.array(z.string()),
    dropped: z.object({ uncited: z.number(), ungrounded: z.number() }),
    looked: z.object({ indicators: z.number(), activities: z.number(), evidence: z.number() }),
  }),
]);
export type AskOutcomeView = z.infer<typeof AskOutcomeSchema>;
