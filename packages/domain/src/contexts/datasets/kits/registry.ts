import type { Kit } from "./model.js";
import { NUTRITION_KIT } from "./data/nutrition.js";
import { WASH_KIT } from "./data/wash.js";

/** The kits DonorDesk ships (§3.8, §1.4). A new sector's kit is a data file and a row here; no other code changes. */
export const KITS: readonly Kit[] = [NUTRITION_KIT, WASH_KIT];
const BY_KEY = new Map(KITS.map((k) => [k.key, k]));
export const kitOf = (key: string): Kit | undefined => BY_KEY.get(key);

/** The kit a dataset's columns fit best: at least 6 of its roles matched, or a third of them (a monthly export rarely has every kit column). */
export function bestKit<T extends { score: number; matched: number }>(match: (kit: Kit) => T): { kit: Kit; match: T } | undefined {
  const scored = KITS.map((kit) => ({ kit, match: match(kit) })).sort((a, b) => b.match.matched - a.match.matched);
  return scored[0] && (scored[0].match.matched >= 6 || scored[0].match.score >= 1 / 3) ? scored[0] : undefined;
}

/** The kit's template sheet: its headers (the kit's own labels) and one empty row to fill. */
export function kitTemplate(kit: Kit): { headers: string[] } {
  return { headers: kit.templateRoles.map((r) => kit.columns.find((c) => c.role === r)!.label) };
}
