/**
 * The organisation's manual, dated currency rates (no feed). A conversion uses the rate in force on the transaction's date: the latest rate
 * dated on or before it, for that exact pair or the inverse of the opposite pair (and says so). With no rate it answers "Rate needed" —
 * never a guessed or the nearest-in-future conversion. Arithmetic is integer (BigInt): a rate has at most 8 decimals, rounding is half away
 * from zero to the minor unit.
 */
import { CURRENCY_CODE, type Amount } from "./money.js";

export interface CurrencyRate {
  id: string;
  from: string;
  to: string;
  /** Units of `to` for one unit of `from`, as a plain decimal text ("0.92", "1310.5"). */
  rate: string;
  /** The day the rate takes effect (YYYY-MM-DD). */
  effectiveOn: string;
  source: string;
}

const RATE_PATTERN = /^\d{1,9}(\.\d{1,8})?$/;
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const SCALE = 8n;
const ONE = 10n ** SCALE;

export function checkRate(r: Pick<CurrencyRate, "from" | "to" | "rate" | "effectiveOn">): string | null {
  if (!CURRENCY_CODE.test(r.from) || !CURRENCY_CODE.test(r.to)) return "Use three-letter currency codes, such as USD.";
  if (r.from === r.to) return "A rate is between two different currencies.";
  if (!RATE_PATTERN.test(r.rate)) return "Write the rate as a number with at most 8 decimals.";
  if (/^0+(\.0+)?$/.test(r.rate)) return "A rate must be more than zero.";
  if (!DAY.test(r.effectiveOn)) return "Give the day the rate takes effect.";
  return null;
}

function scaled(rate: string): bigint {
  const [whole, frac = ""] = rate.split(".");
  return BigInt(whole!) * ONE + BigInt(frac.padEnd(Number(SCALE), "0"));
}

export interface RateUsed {
  from: string;
  to: string;
  rate: string;
  effectiveOn: string;
  /** True when the opposite pair's rate was inverted. */
  inverted: boolean;
}

/** The rate in force on `date`: latest on or before it; the direct pair beats an inverse pair dated the same or earlier only if it is at least as recent. */
export function rateOn(rates: ReadonlyArray<CurrencyRate>, from: string, to: string, date: string): RateUsed | null {
  if (from === to) return { from, to, rate: "1", effectiveOn: date, inverted: false };
  const latest = (a: string, b: string) => rates.filter((r) => r.from === a && r.to === b && r.effectiveOn <= date).sort((x, y) => (x.effectiveOn < y.effectiveOn ? 1 : x.effectiveOn > y.effectiveOn ? -1 : 0))[0];
  const direct = latest(from, to);
  const opposite = latest(to, from);
  if (direct && (!opposite || direct.effectiveOn >= opposite.effectiveOn)) return { from, to, rate: direct.rate, effectiveOn: direct.effectiveOn, inverted: false };
  if (opposite) return { from, to, rate: opposite.rate, effectiveOn: opposite.effectiveOn, inverted: true };
  return null;
}

export type Conversion = { ok: true; money: Amount; used: RateUsed } | { ok: false; reason: "RATE_NEEDED"; message: string };

function roundDiv(n: bigint, d: bigint): bigint {
  const negative = n < 0n;
  const abs = negative ? -n : n;
  const q = (abs * 2n + d) / (d * 2n); // half away from zero
  return negative ? -q : q;
}

/** Converts with the rate dated on `date`. The result always carries the rate used, so the screen can show it beside the figure. */
export function convert(amount: Amount, to: string, date: string, rates: ReadonlyArray<CurrencyRate>): Conversion {
  const used = rateOn(rates, amount.currency, to, date);
  if (!used) return { ok: false, reason: "RATE_NEEDED", message: `Rate needed: ${amount.currency} to ${to} on ${date}.` };
  if (amount.currency === to) return { ok: true, money: amount, used };
  const r = scaled(used.rate);
  const minor = used.inverted ? roundDiv(BigInt(amount.minor) * ONE * ONE, r * ONE) : roundDiv(BigInt(amount.minor) * r, ONE);
  return { ok: true, money: { minor: Number(minor), currency: to }, used };
}
