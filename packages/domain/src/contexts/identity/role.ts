export type Role =
  | "ADMIN"
  | "PROJECT_MANAGER"
  | "ME_OFFICER"
  | "GRANTS_OFFICER"
  | "FIELD_OFFICER"
  | "COMPLIANCE_OFFICER"
  | "VIEWER";

export const ALL_ROLES: Role[] = [
  "ADMIN",
  "PROJECT_MANAGER",
  "ME_OFFICER",
  "GRANTS_OFFICER",
  "FIELD_OFFICER",
  "COMPLIANCE_OFFICER",
  "VIEWER",
];

export type OrganizationType =
  | "LOCAL_NGO"
  | "NATIONAL_NGO"
  | "INGO"
  | "UN_IMPLEMENTING_PARTNER"
  | "CONSULTING_FIRM"
  | "GOVERNMENT_UNIT"
  | "OTHER";

export const ORGANIZATION_TYPES: OrganizationType[] = [
  "LOCAL_NGO",
  "NATIONAL_NGO",
  "INGO",
  "UN_IMPLEMENTING_PARTNER",
  "CONSULTING_FIRM",
  "GOVERNMENT_UNIT",
  "OTHER",
];

export type Sector =
  | "NUTRITION"
  | "FOOD_SECURITY"
  | "WASH"
  | "HEALTH"
  | "PROTECTION"
  | "EDUCATION"
  | "LIVELIHOODS"
  | "SHELTER"
  | "MULTI_SECTOR"
  | "OTHER";

export const SECTORS: Sector[] = [
  "NUTRITION",
  "FOOD_SECURITY",
  "WASH",
  "HEALTH",
  "PROTECTION",
  "EDUCATION",
  "LIVELIHOODS",
  "SHELTER",
  "MULTI_SECTOR",
  "OTHER",
];

export type LanguageCode = "en" | "ar" | "ur" | "fr" | "ps";

export const LANGUAGES: LanguageCode[] = ["en", "ar", "ur", "fr", "ps"];

export type UserStatus = "INVITED" | "ACTIVE" | "SUSPENDED" | "REMOVED";
