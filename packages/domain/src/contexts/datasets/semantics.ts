import type { JoinKey } from "../visual-data/types.js";

/**
 * What a column means beyond its type (§3.1): the place, the period, who did the work, who paid. Each row declares the join key it
 * gives the catalogue, whether a share link may show it, which column kinds it may sit on and how its values are matched. Nothing
 * branches on a semantic's name. A dataset has at most one column of a `unique` semantic.
 */
export interface Semantic {
  key: string;
  label: string;
  joinKey?: JoinKey | undefined;
  /** false = never shown on a share link (the Phase 50 rule for partner and funder names). */
  shareable: boolean;
  unique: boolean;
  kinds: readonly string[];
  /** How a value is resolved at save time: against the places list, as a period, or kept as typed. */
  resolver: "PLACE" | "PERIOD" | "NONE";
  meaning: string;
}

const rows = [
  { key: "NONE", label: "Ordinary column", shareable: true, unique: false, kinds: ["TEXT", "COUNT", "NUMBER", "AMOUNT", "RATE", "DATE", "MONTH", "WEEK", "YES_NO"], resolver: "NONE", meaning: "A figure or a label with no special meaning." },
  { key: "PLACE", label: "Place", joinKey: "PLACE", shareable: true, unique: false, kinds: ["TEXT"], resolver: "PLACE", meaning: "A place in your places list (matched by code, then alias, then a unique name; never guessed)." },
  { key: "PERIOD", label: "Period", joinKey: "PERIOD", shareable: true, unique: true, kinds: ["MONTH", "WEEK", "DATE"], resolver: "PERIOD", meaning: "When the figures happened." },
  { key: "PARTNER", label: "Partner", shareable: false, unique: false, kinds: ["TEXT"], resolver: "NONE", meaning: "The organisation that did the work. Never shown on a share link." },
  { key: "DONOR", label: "Donor or funding source", joinKey: "DONOR", shareable: false, unique: false, kinds: ["TEXT"], resolver: "NONE", meaning: "Who paid. Never shown on a share link." },
  { key: "FACILITY", label: "Facility or site", shareable: true, unique: false, kinds: ["TEXT"], resolver: "NONE", meaning: "The facility or site the row is about." },
  { key: "SEX", label: "Sex", shareable: true, unique: false, kinds: ["TEXT"], resolver: "NONE", meaning: "A sex group." },
  { key: "AGE_GROUP", label: "Age group", shareable: true, unique: false, kinds: ["TEXT"], resolver: "NONE", meaning: "An age band." },
  { key: "PROGRAMME", label: "Programme or service", shareable: true, unique: false, kinds: ["TEXT"], resolver: "NONE", meaning: "The programme or service the row is about." },
  { key: "CURRENCY", label: "Currency", joinKey: "CURRENCY", shareable: false, unique: true, kinds: ["TEXT"], resolver: "NONE", meaning: "The currency of the amounts on the row." },
] as const satisfies readonly Semantic[];

export type SemanticKey = (typeof rows)[number]["key"];
export const SEMANTICS: readonly Semantic[] = rows;
export const SEMANTIC_KEYS = rows.map((r) => r.key) as readonly SemanticKey[];
const BY_KEY = new Map<string, Semantic>(rows.map((r) => [r.key, r]));
export const semanticOf = (key: string): Semantic | undefined => BY_KEY.get(key);
export const isSemantic = (key: string): key is SemanticKey => BY_KEY.has(key);
