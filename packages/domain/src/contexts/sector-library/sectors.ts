/**
 * The one list of sectors (Phase 46). It replaces three lists that used to drift: the identity `Sector` the project stores, the
 * dashboard `SectorKey` templates use, and the wizard's pack sectors. Every library sector says which of the older words it
 * maps to, so nothing that reads the older words changes. A sector is added with a row here; no code branches on a sector id.
 */
import type { Sector } from "../identity/role.js";
import type { SectorKey } from "../dashboards/dashboard-templates.js";
import type { LibrarySectorId } from "./model.js";

export type SectorGroup = "HUMANITARIAN" | "DEVELOPMENT" | "ATTACHED";

export interface SectorDef {
  id: LibrarySectorId;
  label: string;
  group: SectorGroup;
  /** The word a project stores in `Project.sector`. */
  projectSector: Sector;
  /** The word dashboard templates are filed under. */
  templateSector: SectorKey;
  /** Other words people use for it (matched after `normalize`), so a typed sector finds its row. */
  aliases: readonly string[];
  /** Attached sectors are offered with every project and cannot be a project's main sector. */
  attached: boolean;
}

const s = (id: LibrarySectorId, label: string, group: SectorGroup, projectSector: Sector, templateSector: SectorKey, aliases: readonly string[] = [], attached = false): SectorDef =>
  ({ id, label, group, projectSector, templateSector, aliases, attached });

export const SECTOR_REGISTRY: Readonly<Record<LibrarySectorId, SectorDef>> = {
  WASH: s("WASH", "Water, sanitation and hygiene", "HUMANITARIAN", "WASH", "WASH", ["water", "sanitation", "hygiene", "wash"]),
  HEALTH: s("HEALTH", "Health", "HUMANITARIAN", "HEALTH", "HEALTH", ["public health", "medical"]),
  NUTRITION: s("NUTRITION", "Nutrition", "HUMANITARIAN", "NUTRITION", "NUTRITION", ["malnutrition", "iycf"]),
  FOOD_SECURITY: s("FOOD_SECURITY", "Food security", "HUMANITARIAN", "FOOD_SECURITY", "FOOD_SECURITY", ["food assistance", "food"]),
  SHELTER_NFI: s("SHELTER_NFI", "Shelter and household items", "HUMANITARIAN", "SHELTER", "SHELTER", ["shelter", "nfi", "non food items", "settlements"]),
  CCCM: s("CCCM", "Camp coordination and management", "HUMANITARIAN", "SHELTER", "SHELTER", ["camp management", "idp sites", "collective centres"]),
  PROTECTION: s("PROTECTION", "Protection", "HUMANITARIAN", "PROTECTION", "PROTECTION", ["general protection", "protection monitoring"]),
  CHILD_PROTECTION: s("CHILD_PROTECTION", "Child protection", "HUMANITARIAN", "PROTECTION", "PROTECTION", ["children", "cp"]),
  GBV: s("GBV", "Gender-based violence", "HUMANITARIAN", "PROTECTION", "PROTECTION", ["sgbv", "violence against women"]),
  HLP: s("HLP", "Housing, land and property", "HUMANITARIAN", "PROTECTION", "PROTECTION", ["land", "tenure", "housing"]),
  MINE_ACTION: s("MINE_ACTION", "Mine action", "HUMANITARIAN", "PROTECTION", "PROTECTION", ["explosive ordnance", "eore", "demining"]),
  EDUCATION: s("EDUCATION", "Education", "HUMANITARIAN", "EDUCATION", "EDUCATION", ["education in emergencies", "eie", "schooling"]),
  EARLY_RECOVERY: s("EARLY_RECOVERY", "Early recovery and livelihoods", "HUMANITARIAN", "LIVELIHOODS", "ECONOMIC_DEVELOPMENT", ["recovery", "livelihoods"]),
  LOGISTICS: s("LOGISTICS", "Logistics", "HUMANITARIAN", "OTHER", "HUMANITARIAN", ["supply chain"]),
  TELECOMS: s("TELECOMS", "Emergency telecommunications", "HUMANITARIAN", "OTHER", "HUMANITARIAN", ["etc", "connectivity"]),
  COORDINATION: s("COORDINATION", "Coordination and information management", "HUMANITARIAN", "OTHER", "HUMANITARIAN", ["im", "information management", "clusters"]),
  CASH: s("CASH", "Cash and voucher assistance", "HUMANITARIAN", "LIVELIHOODS", "ECONOMIC_DEVELOPMENT", ["cva", "multi purpose cash", "mpc", "vouchers"]),
  AGRICULTURE: s("AGRICULTURE", "Agriculture and livestock", "DEVELOPMENT", "LIVELIHOODS", "AGRICULTURE", ["farming", "livestock", "crops"]),
  ECONOMIC_DEVELOPMENT: s("ECONOMIC_DEVELOPMENT", "Economic development", "DEVELOPMENT", "LIVELIHOODS", "ECONOMIC_DEVELOPMENT", ["enterprise", "jobs", "markets", "microfinance"]),
  SOCIAL_PROTECTION: s("SOCIAL_PROTECTION", "Social protection", "DEVELOPMENT", "LIVELIHOODS", "ECONOMIC_DEVELOPMENT", ["safety nets", "social safety net"]),
  GOVERNANCE: s("GOVERNANCE", "Governance and civil society", "DEVELOPMENT", "OTHER", "GOVERNANCE", ["civil society", "accountability", "rule of law"]),
  PEACEBUILDING: s("PEACEBUILDING", "Peacebuilding and social cohesion", "DEVELOPMENT", "OTHER", "GOVERNANCE", ["peace", "cohesion", "conflict"]),
  CLIMATE_DRR: s("CLIMATE_DRR", "Climate, resilience and disaster risk reduction", "DEVELOPMENT", "OTHER", "CLIMATE", ["resilience", "drr", "climate adaptation", "disaster risk"]),
  ENVIRONMENT_ENERGY: s("ENVIRONMENT_ENERGY", "Environment and energy", "DEVELOPMENT", "OTHER", "CLIMATE", ["energy", "environment", "renewable"]),
  GENDER_EQUALITY: s("GENDER_EQUALITY", "Gender equality", "DEVELOPMENT", "PROTECTION", "PROTECTION", ["gender", "women's empowerment"]),
  DISABILITY_INCLUSION: s("DISABILITY_INCLUSION", "Disability inclusion", "DEVELOPMENT", "OTHER", "GOVERNANCE", ["disability", "inclusion"]),
  MIGRATION_DISPLACEMENT: s("MIGRATION_DISPLACEMENT", "Migration and displacement", "DEVELOPMENT", "PROTECTION", "PROTECTION", ["refugees", "idps", "returnees", "migration"]),
  MHPSS: s("MHPSS", "Mental health and psychosocial support", "DEVELOPMENT", "HEALTH", "HEALTH", ["mental health", "psychosocial"]),
  INFRASTRUCTURE: s("INFRASTRUCTURE", "Infrastructure", "DEVELOPMENT", "OTHER", "ECONOMIC_DEVELOPMENT", ["roads", "construction", "public works"]),
  LOCALISATION: s("LOCALISATION", "Localisation and capacity strengthening", "DEVELOPMENT", "OTHER", "GOVERNANCE", ["capacity building", "local partners"]),
  PROTECTION_AAP: s("PROTECTION_AAP", "Protection principles and accountability", "ATTACHED", "MULTI_SECTOR", "HUMANITARIAN", ["aap", "chs", "psea"], true),
  MEAL: s("MEAL", "Monitoring, evaluation, accountability and learning", "ATTACHED", "MULTI_SECTOR", "HUMANITARIAN", ["m&e", "monitoring", "evaluation"], true),
  FINANCE_GRANTS: s("FINANCE_GRANTS", "Finance and grants management", "ATTACHED", "MULTI_SECTOR", "HUMANITARIAN", ["finance", "grants"], true),
  SAFEGUARDING: s("SAFEGUARDING", "Safeguarding", "ATTACHED", "MULTI_SECTOR", "HUMANITARIAN", ["psea", "child safeguarding"], true),
};

export const SECTOR_ORDER: readonly LibrarySectorId[] = Object.values(SECTOR_REGISTRY).map((d) => d.id);
export const MAIN_SECTORS: readonly SectorDef[] = Object.values(SECTOR_REGISTRY).filter((d) => !d.attached);
export const ATTACHED_SECTORS: readonly SectorDef[] = Object.values(SECTOR_REGISTRY).filter((d) => d.attached);

const norm = (v: string): string => v.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/** A library sector for any word people use: its id, its label, an alias, or the older project/template sector. Never guesses between two. */
export function findSector(word: string | null | undefined): SectorDef | null {
  const w = norm(word ?? "");
  if (!w) return null;
  const all = Object.values(SECTOR_REGISTRY);
  const exact = all.filter((d) => norm(d.id) === w || norm(d.label) === w || d.aliases.some((a) => norm(a) === w));
  if (exact.length === 1) return exact[0]!;
  // An older project sector maps to its first (main) library sector: "SHELTER" opens "Shelter and household items".
  const legacy = all.filter((d) => !d.attached && norm(d.projectSector) === w);
  return legacy[0] ?? null;
}

/** The library sectors a project's stored sector word opens first. */
export function sectorsForProjectSector(projectSector: string | null | undefined): SectorDef[] {
  const w = norm(projectSector ?? "");
  return MAIN_SECTORS.filter((d) => norm(d.projectSector) === w);
}
