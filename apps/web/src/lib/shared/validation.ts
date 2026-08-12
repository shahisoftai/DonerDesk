import type { ZodError, z } from "zod";

export function flattenZodFields(error: z.ZodError | ZodError): Record<string, string[]> {
  const flat = error.flatten().fieldErrors;
  const fields: Record<string, string[]> = {};
  for (const [key, messages] of Object.entries(flat)) {
    if (messages && messages.length > 0) fields[key] = messages;
  }
  return fields;
}
