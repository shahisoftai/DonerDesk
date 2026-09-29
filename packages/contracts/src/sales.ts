import { z } from "zod";

export const ContactSalesInquirySchema = z.object({
  name: z.string().min(2).max(120),
  email: z.string().email().max(254),
  organization: z.string().min(2).max(200),
  message: z.string().min(10).max(4000),
  /**
   * Honeypot: accepted (not rejected) so a bot that fills every field gets the
   * same success response as a real submission — the route drops the inquiry
   * without processing it. A schema-level max(0) would instead 400 the bot,
   * leaking that the field is a tripwire and inviting retry logic.
   */
  website: z.string().max(2000).optional().default(""),
});
export type ContactSalesInquiryInput = z.infer<typeof ContactSalesInquirySchema>;
