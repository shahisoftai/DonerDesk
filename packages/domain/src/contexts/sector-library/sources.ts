/**
 * Where library content comes from (Phase 46). A row per source with its edition and licence, so an entry can always say what it
 * follows and when. Entries are our own concise wording with a citation (decision R1): no long source text is copied, and a
 * source's licence is read before anything is bundled. Editions are what the entries were written against, not a promise that
 * they are the newest; a new edition is a new row.
 */
import type { LibrarySource, LibrarySourceId } from "./model.js";

const src = (s: LibrarySource): LibrarySource => s;

export const SOURCE_REGISTRY: Readonly<Record<LibrarySourceId, LibrarySource>> = {
  SPHERE_2018: src({ id: "SPHERE_2018", name: "The Sphere Handbook", publisher: "Sphere Association", edition: "2018 (4th edition); the 5th edition is in revision", licence: "Check before reuse of text; indicators restated in our own words", url: "https://spherestandards.org", mainlyFor: ["WASH", "HEALTH", "NUTRITION", "FOOD_SECURITY", "SHELTER_NFI"] }),
  CHS_2014: src({ id: "CHS_2014", name: "Core Humanitarian Standard on Quality and Accountability", publisher: "CHS Alliance, Groupe URD, Sphere", edition: "2014", licence: "Open for use with attribution (check)", url: "https://corehumanitarianstandard.org", mainlyFor: ["PROTECTION_AAP", "MEAL"] }),
  CPMS_2019: src({ id: "CPMS_2019", name: "Minimum Standards for Child Protection in Humanitarian Action", publisher: "Alliance for Child Protection in Humanitarian Action", edition: "2019", licence: "Check before reuse of text", mainlyFor: ["CHILD_PROTECTION"] }),
  INEE_2010: src({ id: "INEE_2010", name: "INEE Minimum Standards for Education", publisher: "INEE", edition: "2010 handbook; later updates to be checked", licence: "Check before reuse of text", mainlyFor: ["EDUCATION"] }),
  LEGS: src({ id: "LEGS", name: "Livestock Emergency Guidelines and Standards", publisher: "LEGS Project", edition: "3rd edition", licence: "Check before reuse of text", mainlyFor: ["AGRICULTURE", "EARLY_RECOVERY"] }),
  MERS: src({ id: "MERS", name: "Minimum Economic Recovery Standards", publisher: "SEEP Network", edition: "2017", licence: "Check before reuse of text", mainlyFor: ["EARLY_RECOVERY", "ECONOMIC_DEVELOPMENT"] }),
  CCCM_CLUSTER: src({ id: "CCCM_CLUSTER", name: "CCCM Cluster standards and indicators", publisher: "Global CCCM Cluster", edition: "to be recorded at review", licence: "Check before reuse of text", mainlyFor: ["CCCM"] }),
  GBVIE_2019: src({ id: "GBVIE_2019", name: "Inter-Agency Minimum Standards for GBV in Emergencies Programming", publisher: "UNFPA and partners", edition: "2019", licence: "Check before reuse of text", mainlyFor: ["GBV"] }),
  IASC: src({ id: "IASC", name: "IASC guidelines and frameworks", publisher: "Inter-Agency Standing Committee", edition: "various; recorded per entry at review", licence: "Check before reuse of text", mainlyFor: ["MHPSS", "GBV", "DISABILITY_INCLUSION", "COORDINATION"] }),
  MISP: src({ id: "MISP", name: "Minimum Initial Service Package for sexual and reproductive health", publisher: "Inter-Agency Working Group on Reproductive Health in Crises", edition: "to be recorded at review", licence: "Check before reuse of text", mainlyFor: ["HEALTH"] }),
  IMAS: src({ id: "IMAS", name: "International Mine Action Standards", publisher: "UNMAS", edition: "to be recorded at review", licence: "Check before reuse of text", mainlyFor: ["MINE_ACTION"] }),
  CALP: src({ id: "CALP", name: "CaLP cash and voucher assistance guidance", publisher: "Cash Learning Partnership", edition: "to be recorded at review", licence: "Check before reuse of text", mainlyFor: ["CASH"] }),
  WHO: src({ id: "WHO", name: "WHO indicator and survey guidance", publisher: "World Health Organization", edition: "various; recorded per entry at review", licence: "Check before reuse (often CC BY-NC-SA)", mainlyFor: ["HEALTH", "NUTRITION", "WASH", "MHPSS"] }),
  SMART: src({ id: "SMART", name: "SMART survey methodology", publisher: "SMART initiative", edition: "to be recorded at review", licence: "Check before reuse of text", mainlyFor: ["NUTRITION"] }),
  IPC: src({ id: "IPC", name: "Integrated Food Security Phase Classification", publisher: "IPC Global Support Unit", edition: "to be recorded at review", licence: "Check before reuse of text", mainlyFor: ["FOOD_SECURITY", "NUTRITION"] }),
  DHIS2: src({ id: "DHIS2", name: "DHIS2 health metadata packages", publisher: "HISP / University of Oslo", edition: "to be recorded at review", licence: "Check before reuse of text", mainlyFor: ["HEALTH"] }),
  CLUSTER_REGISTRY: src({ id: "CLUSTER_REGISTRY", name: "Global cluster indicator registries", publisher: "Global clusters", edition: "per cluster; recorded at review", licence: "Check before reuse of text", mainlyFor: ["WASH", "HEALTH", "NUTRITION", "FOOD_SECURITY", "SHELTER_NFI", "PROTECTION", "EDUCATION", "LOGISTICS", "TELECOMS", "COORDINATION"] }),
  OCHA_HRP: src({ id: "OCHA_HRP", name: "Humanitarian response plan monitoring indicators", publisher: "OCHA", edition: "per plan year; recorded at review", licence: "Check before reuse of text", mainlyFor: ["COORDINATION"] }),
  SDG: src({ id: "SDG", name: "SDG global indicator framework", publisher: "United Nations Statistical Commission", edition: "current framework; recorded at review", licence: "UN public information; check terms", url: "https://unstats.un.org/sdgs/indicators/indicators-list/", mainlyFor: ["HEALTH", "EDUCATION", "WASH", "GENDER_EQUALITY", "CLIMATE_DRR", "ENVIRONMENT_ENERGY", "GOVERNANCE", "AGRICULTURE", "ECONOMIC_DEVELOPMENT", "SOCIAL_PROTECTION", "INFRASTRUCTURE"] }),
  UNHCR_RBM: src({ id: "UNHCR_RBM", name: "UNHCR results-based management indicators", publisher: "UNHCR", edition: "to be recorded at review", licence: "Check before reuse of text", mainlyFor: ["MIGRATION_DISPLACEMENT", "PROTECTION", "CCCM"] }),
  UNICEF_CCC: src({ id: "UNICEF_CCC", name: "Core Commitments for Children in Humanitarian Action", publisher: "UNICEF", edition: "2020", licence: "Check before reuse of text", mainlyFor: ["CHILD_PROTECTION", "EDUCATION", "NUTRITION", "WASH", "HEALTH"] }),
  WFP_CRF: src({ id: "WFP_CRF", name: "WFP corporate results framework", publisher: "World Food Programme", edition: "to be recorded at review", licence: "Check before reuse of text", mainlyFor: ["FOOD_SECURITY", "CASH"] }),
  FAO: src({ id: "FAO", name: "FAO food security and agriculture measures", publisher: "FAO", edition: "various; recorded per entry at review", licence: "Check before reuse (often CC BY-NC-SA)", mainlyFor: ["FOOD_SECURITY", "AGRICULTURE"] }),
  IFRC: src({ id: "IFRC", name: "IFRC indicator guidance", publisher: "IFRC", edition: "to be recorded at review", licence: "Check before reuse of text", mainlyFor: ["CLIMATE_DRR", "HEALTH"] }),
  IATI: src({ id: "IATI", name: "IATI standard result indicators", publisher: "International Aid Transparency Initiative", edition: "to be recorded at review", licence: "Open standard", mainlyFor: ["FINANCE_GRANTS", "MEAL"] }),
  DONOR_FRAMEWORKS: src({ id: "DONOR_FRAMEWORKS", name: "Donor standard indicator sets", publisher: "Various donors", edition: "each set records its own edition and status at review", licence: "Check each set", mainlyFor: ["ECONOMIC_DEVELOPMENT", "GOVERNANCE", "AGRICULTURE"] }),
  DONORDESK: src({ id: "DONORDESK", name: "DonorDesk practice notes", publisher: "DonorDesk", edition: "2026", licence: "Own wording", mainlyFor: ["MEAL", "FINANCE_GRANTS", "LOCALISATION"] }),
};
