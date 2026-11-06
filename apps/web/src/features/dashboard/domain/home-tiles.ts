/**
 * Which parts each kind of Home shows (Phase 35.H5): one table, exhaustive over the Home variants, so what a role sees is a decision in one place and a new part is a new
 * key here (the test fails until every variant has decided). A part a variant does not show is not rendered at all: hidden, never disabled.
 */
import type { HomeVariant } from "../../navigation/domain/role-navigation.ts";

export const HOME_TILES = [
  "NEEDS_YOU", "PINNED", "BOOKMARKS", "HEADLINES", "FUNDING", "MAP", "BREAKDOWNS", "PROJECT_HEALTH", "GRANTS",
  "UPCOMING_REPORTS", "PIPELINE", "RISKS", "DELIVERY", "DATA_EVIDENCE", "RESULTS", "YOUR_WORK", "NOTIFICATIONS", "QUICK_LINKS",
] as const;
export type HomeTile = (typeof HOME_TILES)[number];

/** The body panels a director and a manager share; a director adds Grants. */
const PORTFOLIO_BODY: ReadonlyArray<HomeTile> = [
  "HEADLINES", "FUNDING", "MAP", "BREAKDOWNS", "PROJECT_HEALTH", "UPCOMING_REPORTS", "PIPELINE", "RISKS", "DELIVERY", "DATA_EVIDENCE", "RESULTS", "YOUR_WORK", "NOTIFICATIONS", "QUICK_LINKS",
];

export const HOME_TILES_BY_VARIANT: Readonly<Record<HomeVariant, ReadonlySet<HomeTile>>> = {
  DIRECTOR: new Set<HomeTile>([...PORTFOLIO_BODY, "NEEDS_YOU", "PINNED", "BOOKMARKS", "GRANTS"]),
  MANAGER: new Set<HomeTile>([...PORTFOLIO_BODY, "NEEDS_YOU", "PINNED", "BOOKMARKS"]),
  // Field, grants and compliance Homes keep their own screens; they gain the person's pins and bookmarks only.
  FIELD: new Set<HomeTile>(["PINNED", "BOOKMARKS"]),
  GRANTS: new Set<HomeTile>(["NEEDS_YOU", "PINNED", "BOOKMARKS", "FUNDING", "MAP"]),
  COMPLIANCE: new Set<HomeTile>(["NEEDS_YOU", "PINNED", "BOOKMARKS"]),
};

export const showsTile = (variant: HomeVariant, tile: HomeTile): boolean => HOME_TILES_BY_VARIANT[variant].has(tile);
