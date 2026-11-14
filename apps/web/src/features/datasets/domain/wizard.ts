import type { ColumnDef, TidyStep } from "@donordesk/domain/contexts/datasets/browser.js";

/**
 * The upload wizard's steps and pure helpers (Phase 54, §4.2). One decision per screen; every guess is shown with its reason and
 * changed in one click; nothing is applied silently. The steps list is data; the wizard shows them in order.
 */
export const WIZARD_STEPS = ["UPLOAD", "TABLE", "COLUMNS", "PLACES", "TIDY", "CHECK", "DONE"] as const;
export type WizardStep = (typeof WIZARD_STEPS)[number];

let counter = 0;
export const stepId = (): string => `s${Date.now().toString(36)}${(counter++).toString(36)}`;

/** The SOURCE steps for a chosen sheet and header row, replacing any earlier ones (the other steps are kept in order). */
export function withSource(steps: readonly TidyStep[], sheet: string, headerRow: number): TidyStep[] {
  const rest = steps.filter((s) => s.type !== "USE_SHEET" && s.type !== "HEADER_ROW");
  return [{ id: "sheet", type: "USE_SHEET", params: { sheet } }, { id: "header", type: "HEADER_ROW", params: { row: headerRow } }, ...rest];
}

/** Leaving out personal-data columns is a recorded step, so a refresh leaves them out again (§8.2). */
export function dropColumns(steps: readonly TidyStep[], headers: readonly string[]): TidyStep[] {
  if (headers.length === 0) return [...steps];
  const existing = steps.find((s) => s.type === "DROP_COLUMNS" && s.id === "pii");
  const columns = [...new Set([...(existing ? (existing.params.columns as string[]) : []), ...headers])];
  return [...steps.filter((s) => s.id !== "pii"), { id: "pii", type: "DROP_COLUMNS", params: { columns } }];
}

/** "Read 'Sind' as 'Sindh'" for a place column: one MAP_VALUES step per column, pairs added to it. */
export function readAs(steps: readonly TidyStep[], column: string, from: string, to: string): TidyStep[] {
  const id = `map-${column}`;
  const prev = steps.find((s) => s.id === id);
  const pairs = [...((prev?.params.pairs as Array<{ from: string; to: string }>) ?? []).filter((p) => p.from !== from), { from, to }];
  return [...steps.filter((s) => s.id !== id), { id, type: "MAP_VALUES", params: { column, pairs } }];
}

/** A column changed on the confirm screen: kind, meaning, label or hide switch. Share-link hiding follows a meaning that is never shown. */
export const updateColumn = (cols: readonly ColumnDef[], key: string, patch: Partial<ColumnDef>): ColumnDef[] => cols.map((c) => (c.key === key ? { ...c, ...patch } : c));

/** The header of a column by key (steps name headers, columns have keys). */
export const headerOf = (cols: readonly ColumnDef[], key: string): string => cols.find((c) => c.key === key)?.sourceHeader ?? key;
