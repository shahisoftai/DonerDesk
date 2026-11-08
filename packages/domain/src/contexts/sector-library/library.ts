/**
 * The built-in library, assembled (Phase 46). One content value per sector, typed as a record over every sector id, so a sector
 * in the registry without content does not compile. Entries are listed once under their own sector; `alsoIn` makes them appear
 * under others without a copy.
 */
import type { LibraryIndicator, LibrarySectorId, SectorContent } from "./model.js";
import { LIBRARY_SECTOR_IDS } from "./model.js";
import { withActivities } from "./data/activities.js";
import { WASH } from "./data/wash.js";
import { NUTRITION } from "./data/nutrition.js";
import { FOOD_SECURITY } from "./data/food-security.js";
import { SHELTER_NFI } from "./data/shelter.js";
import { HEALTH } from "./data/health.js";
import { PROTECTION, CHILD_PROTECTION, GBV } from "./data/protection.js";
import { HLP, MINE_ACTION } from "./data/protection-two.js";
import { EDUCATION } from "./data/education.js";
import { EARLY_RECOVERY, CASH, AGRICULTURE } from "./data/livelihoods.js";
import { ECONOMIC_DEVELOPMENT, SOCIAL_PROTECTION, GOVERNANCE, PEACEBUILDING } from "./data/development.js";
import { CCCM, LOGISTICS, TELECOMS, COORDINATION } from "./data/operations.js";
import { CLIMATE_DRR, ENVIRONMENT_ENERGY, INFRASTRUCTURE } from "./data/climate.js";
import { GENDER_EQUALITY, DISABILITY_INCLUSION, MIGRATION_DISPLACEMENT, MHPSS, LOCALISATION } from "./data/inclusion.js";
import { PROTECTION_AAP, MEAL, FINANCE_GRANTS, SAFEGUARDING } from "./data/attached.js";

/** Changes when any content changes, so a project can tell the library it adopted from has moved on. */
export const LIBRARY_CONTENT_VERSION = "2026-11-08.1";

const AUTHORED: Readonly<Record<LibrarySectorId, SectorContent>> = {
  WASH, HEALTH, NUTRITION, FOOD_SECURITY, SHELTER_NFI, CCCM, PROTECTION, CHILD_PROTECTION, GBV, HLP, MINE_ACTION, EDUCATION, EARLY_RECOVERY,
  LOGISTICS, TELECOMS, COORDINATION, CASH, AGRICULTURE, ECONOMIC_DEVELOPMENT, SOCIAL_PROTECTION, GOVERNANCE, PEACEBUILDING, CLIMATE_DRR,
  ENVIRONMENT_ENERGY, GENDER_EQUALITY, DISABILITY_INCLUSION, MIGRATION_DISPLACEMENT, MHPSS, INFRASTRUCTURE, LOCALISATION,
  PROTECTION_AAP, MEAL, FINANCE_GRANTS, SAFEGUARDING,
};

/** Every sector with its suggested results completed by the usual activities under each output (the wizard needs them before a project can start). */
export const BUILT_IN_CONTENT: Readonly<Record<LibrarySectorId, SectorContent>> = Object.fromEntries(
  LIBRARY_SECTOR_IDS.map((id) => [id, { ...AUTHORED[id], logframe: withActivities(id, AUTHORED[id].logframe) }]),
) as unknown as Record<LibrarySectorId, SectorContent>;

export const BUILT_IN_INDICATORS: readonly LibraryIndicator[] = LIBRARY_SECTOR_IDS.flatMap((id) => BUILT_IN_CONTENT[id].indicators);

const BY_ID: ReadonlyMap<string, LibraryIndicator> = new Map(BUILT_IN_INDICATORS.map((e) => [e.id, e]));
export const libraryIndicator = (id: string): LibraryIndicator | undefined => BY_ID.get(id);
export const sectorContent = (id: LibrarySectorId): SectorContent => BUILT_IN_CONTENT[id];
