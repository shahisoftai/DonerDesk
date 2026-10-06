/**
 * What must never reach a person reading the product: an internal code, an id or a snake_case key. Used by tests that
 * scan every copy table and by the donor-text checks, so there is one definition of "raw".
 */

const UUID_RE = /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/i;
/** UPPER_SNAKE codes ("MISSING_QA", "PROVIDER_TIMEOUT"): at least one underscore, so "PDF" and "USAID" are fine. */
const UPPER_CODE_RE = /\b[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+\b/;
/** snake_case keys ("report_section", "audit_events"). */
const SNAKE_KEY_RE = /\b[a-z][a-z0-9]*(?:_[a-z0-9]+)+\b/;

export interface RawToken {
  kind: "uuid" | "code" | "snake_case";
  token: string;
}

/** Internal tokens in a user-visible string, in the order they appear; empty when the text is clean. */
export function findRawTokens(text: string): RawToken[] {
  const found: RawToken[] = [];
  const scan = (kind: RawToken["kind"], re: RegExp) => {
    const global = new RegExp(re.source, re.flags.includes("g") ? re.flags : `${re.flags}g`);
    for (const match of (text ?? "").matchAll(global)) found.push({ kind, token: match[0] });
  };
  scan("uuid", UUID_RE);
  scan("code", UPPER_CODE_RE);
  scan("snake_case", SNAKE_KEY_RE);
  return found;
}

export function isCleanCopy(text: string): boolean {
  return findRawTokens(text).length === 0;
}
