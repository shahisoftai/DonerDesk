/**
 * Single source for the facts legal pages must state. Confirm every value
 * marked TO CONFIRM before publishing; the pages render these verbatim.
 */
export const LEGAL = {
  entityName: "DonorDesk.Online", // TO CONFIRM: registered company name
  address: "Registered address to be confirmed", // TO CONFIRM
  legalEmail: "legal@donordesk.online",
  privacyEmail: "privacy@donordesk.online", // TO CONFIRM mailbox exists
  hostingLocation: "Contabo data centre",
  updated: "7 October 2026 (Version 1.0)",
} as const;
