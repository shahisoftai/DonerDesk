/**
 * Starter dashboard templates (Phase 34.0), one per sector to begin with. They use only chart kinds the renderer draws today
 * (bar, line and pie), so every one is usable now; richer kinds are added by editing a copy, and the catalogue grows
 * as the Chart Studio lands. Every template is a DRAFT and is meant to be copied and changed.
 */
import type { IndicatorRole, DashboardTemplate, SectorKey, TemplateAudience, TemplateWidget } from "./dashboard-templates.js";

const role = (key: string, label: string, hint: string, keywords: string[], o: { types?: IndicatorRole["types"]; required?: boolean } = {}): IndicatorRole => ({
  key,
  label,
  hint,
  keywords,
  types: o.types ?? ["COUNT"],
  required: o.required ?? true,
});

/**
 * The standard shape of a results dashboard: progress of every role against target, the first two over time, the third against its
 * baseline and target, the fourth by period, and how much of the data is verified. Positions are on the 12-column grid.
 */
function standardTemplate(input: { id: string; sector: SectorKey; title: string; description: string; audience: TemplateAudience; roles: IndicatorRole[] }): DashboardTemplate {
  const [r1, r2, r3, r4] = input.roles;
  const allKeys = input.roles.map((r) => r.key);
  const chart = (id: string, title: string, x: number, y: number, w: number, h: number, c: NonNullable<TemplateWidget["chart"]>): TemplateWidget => ({ id, kind: "CHART", title, x, y, w, h, chart: c });
  const widgets: TemplateWidget[] = [
    chart("progress", "Progress against targets", 0, 0, 12, 4, { kind: "BAR", template: "INDICATORS_PROGRESS", roleKeys: allKeys, measure: "PERCENT_OF_TARGET", showTarget: false }),
    chart("trend-1", r1!.label, 0, 4, 6, 4, { kind: "LINE", template: "INDICATOR_OVER_TIME", roleKeys: [r1!.key], measure: "CUMULATIVE", showTarget: true }),
    chart("trend-2", r2!.label, 6, 4, 6, 4, { kind: "LINE", template: "INDICATOR_OVER_TIME", roleKeys: [r2!.key], measure: "CUMULATIVE", showTarget: true }),
    chart("vs-target", `${r3!.label}: baseline, target and result`, 0, 8, 6, 4, { kind: "BAR", template: "INDICATOR_VS_TARGET", roleKeys: [r3!.key], measure: "CUMULATIVE", showTarget: false }),
    chart("by-period", `${r4!.label} by period`, 6, 8, 6, 4, { kind: "BAR", template: "INDICATOR_OVER_TIME", roleKeys: [r4!.key], measure: "PERIOD", showTarget: false }),
    chart("data-status", "How much of the data is verified", 0, 12, 6, 4, { kind: "PIE", template: "STATUS_DISTRIBUTION", roleKeys: [], measure: "PERIOD", showTarget: false }),
  ];
  return { id: input.id, sector: input.sector, title: input.title, description: input.description, audience: input.audience, status: "DRAFT", origin: "BUILT_IN", revision: 1, roles: input.roles, widgets };
}

export const SECTOR_TEMPLATES: ReadonlyArray<DashboardTemplate> = [
  standardTemplate({
    id: "tpl-wash-access-hygiene",
    sector: "WASH",
    title: "Water, sanitation and hygiene: access and results",
    description: "Progress of the main water, sanitation and hygiene results, with the first two over time.",
    audience: "PROGRAMME",
    roles: [
      role("people_basic_water", "People with basic water access", "The indicator counting people who gained access to basic drinking water.", ["water", "drinking water", "basic water", "access"]),
      role("people_basic_sanitation", "People with basic sanitation", "The indicator counting people who gained a basic toilet or latrine.", ["sanitation", "latrine", "toilet"]),
      role("handwashing_facilities", "Handwashing facilities", "Handwashing stations built or supported.", ["handwashing", "handwash", "hand washing"]),
      role("hygiene_promotion_reach", "People reached by hygiene promotion", "People who took part in hygiene promotion sessions.", ["hygiene", "promotion", "sessions"]),
      role("water_points_functional", "Water points functioning", "Share of water points that work. A rate, so it is shown as recorded, never as % of target.", ["water point", "functional", "functioning", "borehole"], { types: ["PERCENTAGE", "RATIO"], required: false }),
    ],
  }),
  standardTemplate({
    id: "tpl-health-mnch",
    sector: "HEALTH",
    title: "Health: maternal, newborn and child services",
    description: "Reach of antenatal care, safe delivery and immunisation, and the facilities and workers behind them.",
    audience: "PROGRAMME",
    roles: [
      role("pregnant_women_anc", "Pregnant women attending antenatal care", "Women who attended antenatal visits.", ["antenatal", "anc", "pregnant"]),
      role("skilled_birth_attendance", "Births attended by skilled staff", "Deliveries assisted by a trained health worker.", ["skilled", "birth", "delivery", "deliveries"]),
      role("children_immunised", "Children immunised", "Children who received the vaccines the project supports.", ["immunised", "immunized", "vaccinated", "vaccine", "immunisation"]),
      role("health_workers_trained", "Health workers trained", "Staff who completed a training the project ran.", ["health workers", "trained", "training"]),
      role("health_facilities_supported", "Health facilities supported", "Facilities receiving supplies, repairs or mentoring.", ["facilities", "facility", "clinic"], { required: false }),
    ],
  }),
  standardTemplate({
    id: "tpl-nutrition-screening-treatment",
    sector: "NUTRITION",
    title: "Nutrition: screening and treatment",
    description: "Children screened and admitted to treatment, with counselling and supported sites.",
    audience: "PROGRAMME",
    roles: [
      role("children_screened", "Children screened", "Children screened for malnutrition.", ["screened", "screening", "muac"]),
      role("children_admitted_treatment", "Children admitted to treatment", "Children admitted for treatment of acute malnutrition.", ["admitted", "admission", "treatment", "malnutrition"]),
      role("caregivers_counselled", "Caregivers counselled", "Caregivers who received infant and young child feeding counselling.", ["caregivers", "counselled", "counselling", "feeding"]),
      role("nutrition_sites_supported", "Nutrition sites supported", "Treatment or screening sites the project supports.", ["sites", "site", "centres", "centers"]),
      role("recovery_rate", "Recovery rate", "Share of treated children who recovered. A rate, shown as recorded.", ["recovery", "recovered", "cured"], { types: ["PERCENTAGE", "RATIO"], required: false }),
    ],
  }),
  standardTemplate({
    id: "tpl-education-access-learning",
    sector: "EDUCATION",
    title: "Education: access and learning",
    description: "Enrolment, attendance, teacher training and materials delivered.",
    audience: "PROGRAMME",
    roles: [
      role("children_enrolled", "Children enrolled", "Children enrolled in the schools or classes the project supports.", ["enrolled", "enrolment", "enrollment"]),
      role("children_attending", "Children attending", "Children attending regularly.", ["attending", "attendance"]),
      role("teachers_trained", "Teachers trained", "Teachers who completed a training.", ["teachers", "trained", "training"]),
      role("learning_materials_distributed", "Learning materials distributed", "Books, kits or supplies handed out.", ["materials", "books", "kits", "supplies"]),
      role("schools_supported", "Schools supported", "Schools receiving any support.", ["schools", "school"], { required: false }),
    ],
  }),
  standardTemplate({
    id: "tpl-food-security-livelihoods",
    sector: "FOOD_SECURITY",
    title: "Food security and livelihoods: assistance and results",
    description: "Households assisted, transfers made, farmers trained and food distributed.",
    audience: "PROGRAMME",
    roles: [
      role("households_assisted", "Households assisted", "Households that received cash, food or inputs.", ["households", "household", "assisted"]),
      role("cash_transferred", "Cash transferred", "The value of cash transfers made.", ["cash", "transfer", "transferred"], { types: ["CURRENCY", "COUNT"] }),
      role("farmers_trained", "Farmers trained", "Farmers who completed a training.", ["farmers", "trained", "training"]),
      role("food_distributed", "Food distributed", "Food handed out, in the unit the project records.", ["food", "distributed", "distribution", "rations"]),
      role("community_assets_built", "Community assets built", "Assets such as ponds, roads or stores created or rehabilitated.", ["assets", "asset", "rehabilitated"], { required: false }),
    ],
  }),
  standardTemplate({
    id: "tpl-protection-services",
    sector: "PROTECTION",
    title: "Protection: services reached",
    description: "People reached and cases referred, shown as counts only. Individual records never appear here.",
    audience: "PROGRAMME",
    roles: [
      role("people_reached_protection", "People reached with protection services", "People who received any protection service.", ["protection", "reached", "services"]),
      role("cases_referred", "Cases referred", "Cases referred to another service.", ["referred", "referral", "referrals", "cases"]),
      role("safe_spaces_operating", "Safe spaces operating", "Safe spaces open and running.", ["safe spaces", "safe space", "spaces"]),
      role("awareness_sessions", "Awareness sessions held", "Awareness or prevention sessions delivered.", ["awareness", "sessions", "prevention"]),
      role("staff_trained_protection", "Staff trained", "Staff trained in protection practice.", ["staff", "trained", "training"], { required: false }),
    ],
  }),
];

/** The built-in templates of one sector. */
export function templatesForSector(sector: SectorKey): DashboardTemplate[] {
  return SECTOR_TEMPLATES.filter((t) => t.sector === sector);
}
