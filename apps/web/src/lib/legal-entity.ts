/**
 * Single source for the facts legal pages must state. Confirm every value
 * marked TO CONFIRM before publishing; the pages render these verbatim.
 */
export const LEGAL = {
  entityName: "DonorDesk.Online", // TO CONFIRM: registered company name
  address: "Registered address to be confirmed", // TO CONFIRM
  /** Contractual notices (the Terms). */
  legalEmail: "legal@donordesk.online",
  /** Privacy questions, data requests, security reports and the DPA. */
  privacyEmail: "support@donordesk.online", // privacy and sales requests share the support mailbox
  /** Billing and refund requests (handled case by case from the support mailbox). */
  billingEmail: "support@donordesk.online",
  hostingLocation: "Contabo data centre",
  /** One label for every legal page, so the pages do not carry several versions. */
  updated: "Product version 1.93 · 7 October 2026",
  /**
   * The refund policy is re-issued on its own date, so it carries its own
   * effective date rather than the label shared by the other policies.
   */
  refundPolicyUpdated: "21 October 2026 · product version 1.93",
} as const;
