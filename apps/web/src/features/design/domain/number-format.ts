/**
 * The one place a figure on a data surface becomes text (Phase 39.4). Full digits up to a million, compact above it (1.2M); the full
 * figure is always available for a tooltip. Arabic keeps Latin digits, like the infographics. Pure.
 */
export const COMPACT_FROM = 1_000_000;

const intlLocale = (locale: string): string => (locale === "ar" ? "ar-u-nu-latn" : locale);

export function formatTileNumber(n: number, locale: string): string {
  const tag = intlLocale(locale);
  if (Math.abs(n) >= COMPACT_FROM) return new Intl.NumberFormat(tag, { notation: "compact", maximumFractionDigits: 1 }).format(n);
  return new Intl.NumberFormat(tag, { maximumFractionDigits: 2 }).format(n);
}

export const formatFullNumber = (n: number, locale: string): string => new Intl.NumberFormat(intlLocale(locale), { maximumFractionDigits: 6 }).format(n);

/** A signed amount for a change line ("+12", "−3"); the sign is the direction's, so the sentence around it does not repeat it. */
export const formatChangeAmount = (delta: number, locale: string): string => formatTileNumber(Math.abs(delta), locale);
