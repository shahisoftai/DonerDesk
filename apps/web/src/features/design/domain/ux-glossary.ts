/**
 * One name per thing (Version 4.000, plan F38). A retired word is replaced by the current one in every user-visible string;
 * `tests/unit/ux-glossary.test.mts` scans the source for the retired words in strings and JSX text. Pure.
 */
export interface RetiredTerm { retired: RegExp; use: string; why: string }

export const RETIRED_TERMS: readonly RetiredTerm[] = [
  { retired: /\bMy Work\b/i, use: "Inbox", why: "My Work and Notifications became the Inbox (F2/F3)" },
  { retired: /\bReport builder\b/i, use: "Data tables", why: "the builder makes tables of data, not reports (F20)" },
  { retired: /\bReport workspace\b/i, use: "Report", why: "the legacy report workspace was retired (F83)" },
  { retired: /\bclassic (project )?form\b/i, use: "the wizard", why: "the one-page project form was retired (F84)" },
];
