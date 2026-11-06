/**
 * Amount for the finance register: whole minor units (cents) with a currency, so sums never drift (the convention of the budget lines).
 * Two currencies never add: summing is always per currency, and a total across currencies exists only through `convert` with a dated rate.
 */
export interface Amount {
  /** Whole minor units (cents). Never a float. */
  minor: number;
  /** ISO 4217-style code, three capital letters. */
  currency: string;
}

export const CURRENCY_CODE = /^[A-Z]{3}$/;

export const amountOf = (minor: number, currency: string): Amount => ({ minor, currency });

/** Adds two amounts of the SAME currency; throwing here would hide a bug, so a mismatch is the caller's to prevent (use `sumByCurrency`). */
export function addAmounts(a: Amount, b: Amount): Amount | null {
  return a.currency === b.currency ? { minor: a.minor + b.minor, currency: a.currency } : null;
}

/** Totals per currency, in first-seen order. Nothing is converted or mixed. */
export function sumByCurrency(items: ReadonlyArray<Amount>): Amount[] {
  const totals = new Map<string, number>();
  for (const m of items) totals.set(m.currency, (totals.get(m.currency) ?? 0) + m.minor);
  return [...totals].map(([currency, minor]) => ({ minor, currency }));
}

/** "1,234.50" from 123450 (two decimals always; the grouping is the reader's locale in the UI, this is for exports and tests). */
export function formatMinorUnits(minor: number): string {
  const sign = minor < 0 ? "-" : "";
  const abs = Math.abs(minor);
  return `${sign}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, "0")}`;
}
