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
  privacyEmail: "privacy@donordesk.online", // TO CONFIRM mailbox exists
  hostingLocation: "Contabo data centre",
  /** One label for every legal page, so the pages do not carry several versions. */
  updated: "Product version 1.93 · 7 October 2026",
} as const;
