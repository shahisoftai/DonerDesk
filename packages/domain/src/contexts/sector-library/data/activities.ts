import type { LibrarySectorId, LogframeSkeletonNode } from "../model.js";

/**
 * The usual activities under each suggested output (Phase 46). The wizard needs every output to have an activity before a project
 * can start, so a sector's suggested results must come with them. Keyed by sector and output key; merged into the skeleton by
 * `withActivities`. Titles are plain verbs: what the team does.
 */
export const SKELETON_ACTIVITIES: Readonly<Record<LibrarySectorId, Readonly<Record<string, readonly string[]>>>> = {
  WASH: {
    "out-water": ["Build or rehabilitate water points", "Run water trucking where there is no source", "Train water point committees"],
    "out-quality": ["Test water at the point of delivery", "Chlorinate water supplies", "Carry out sanitary surveys"],
    "out-toilets": ["Build or rehabilitate toilets", "Desludge and maintain toilets", "Run safety audits of toilets with women and girls"],
    "out-hyg": ["Hold hygiene promotion sessions", "Distribute hygiene kits", "Provide menstrual hygiene materials"],
  },
  NUTRITION: {
    "out-screen": ["Screen children and women by MUAC", "Refer children with acute malnutrition"],
    "out-treat": ["Run outpatient therapeutic and supplementary feeding", "Manage therapeutic food supply", "Supervise treatment sites"],
    "out-iycf": ["Counsel caregivers on infant and young child feeding", "Support mother-to-mother groups"],
  },
  FOOD_SECURITY: {
    "out-dist": ["Register and verify recipient households", "Distribute food or cash", "Monitor after each distribution"],
    "out-inputs": ["Distribute seeds, tools or livestock inputs", "Train households in production", "Support income-generating activities"],
  },
  SHELTER_NFI: {
    "out-shelter": ["Assess damage and household needs", "Distribute shelter kits", "Build transitional shelters and repair homes"],
    "out-nfi": ["Distribute household item kits", "Monitor use of household items"],
  },
  HEALTH: {
    "out-mnch": ["Provide antenatal, delivery and postnatal care", "Immunise children", "Treat common childhood illnesses"],
    "out-disease": ["Run disease surveillance and outbreak response", "Vaccinate against outbreak-prone diseases"],
    "out-staff": ["Train health workers", "Supervise and mentor facility staff"],
    "out-supplies": ["Supply essential medicines and equipment", "Track stock at facilities"],
  },
  PROTECTION: { "out-case": ["Identify and assess protection cases", "Refer cases to specialist services"], "out-comm": ["Support community protection committees", "Hold protection awareness sessions"] },
  CHILD_PROTECTION: { "out-spaces": ["Run child-friendly spaces", "Provide psychosocial support to children"], "out-case": ["Manage child protection cases", "Trace and reunify separated children"] },
  GBV: { "out-case": ["Provide case management and psychosocial support to survivors", "Refer survivors to health and legal services"], "out-safe": ["Run women and girls safe spaces", "Hold prevention and risk-reduction sessions"] },
  HLP: { "out-legal": ["Provide HLP counselling and legal aid", "Mediate land and property disputes"] },
  MINE_ACTION: { "out-clear": ["Survey and mark hazardous areas", "Clear explosive hazards and hand over land"], "out-eore": ["Deliver explosive ordnance risk education"] },
  EDUCATION: { "out-spaces": ["Build or equip safe learning spaces", "Distribute learning materials"], "out-teach": ["Train teachers and facilitators", "Support teachers with coaching"] },
  EARLY_RECOVERY: { "out-skills": ["Train people in vocational and business skills", "Support job placement"], "out-works": ["Run cash-for-work activities", "Give start-up grants to small businesses"] },
  LOGISTICS: { "out-move": ["Transport cargo for partners", "Operate shared storage"] },
  TELECOMS: { "out-set": ["Install shared connectivity and radio services", "Train responders in communications"] },
  COORDINATION: { "out-3w": ["Hold coordination meetings", "Collect and publish who-does-what-where information"] },
  CASH: { "out-pay": ["Register and verify recipients", "Make payments through the chosen provider", "Monitor after payment"] },
  AGRICULTURE: { "out-inputs": ["Distribute seeds and tools", "Vaccinate and treat livestock"], "out-train": ["Train farmers in improved practices", "Support farmer groups and market links"] },
  ECONOMIC_DEVELOPMENT: { "out-supp": ["Give business development support", "Link enterprises to finance and markets"] },
  SOCIAL_PROTECTION: { "out-sys": ["Support household registration and targeting", "Strengthen payment and grievance systems"] },
  GOVERNANCE: { "out-cso": ["Build the capacity of civil society groups", "Support public consultations and budget forums"] },
  PEACEBUILDING: { "out-dial": ["Hold dialogue and mediation sessions", "Support local peace committees"] },
  CCCM: { "out-struct": ["Set up site management and committees", "Run site coordination meetings and a feedback mechanism"] },
  CLIMATE_DRR: { "out-plan": ["Make community risk reduction plans", "Set up early warning systems"], "out-works": ["Build protective works", "Promote climate-adaptive practices"] },
  ENVIRONMENT_ENERGY: { "out-install": ["Install clean energy systems", "Train local technicians for upkeep"] },
  INFRASTRUCTURE: { "out-works": ["Survey and design works", "Build and inspect works", "Hand works over to the community"] },
  GENDER_EQUALITY: { "out-act": ["Hold women's leadership and rights sessions", "Engage men and boys in gender equality"] },
  DISABILITY_INCLUSION: { "out-adapt": ["Audit accessibility and adapt facilities", "Provide assistive devices"] },
  MIGRATION_DISPLACEMENT: { "out-reg": ["Register people and provide documentation support", "Run information desks on rights and services"], "out-sol": ["Support return, integration or resettlement", "Support host communities"] },
  MHPSS: { "out-comm": ["Run community psychosocial activities", "Train people in psychological first aid"], "out-spec": ["Provide focused and specialised mental health care", "Refer people to specialist care"] },
  LOCALISATION: { "out-cap": ["Assess partner capacity", "Carry out capacity strengthening plans"] },
  PROTECTION_AAP: { "out-mech": ["Set up feedback and complaints channels", "Report back to communities on what changed"] },
  MEAL: { "out-sys": ["Write the monitoring plan", "Collect, check and use data"] },
  FINANCE_GRANTS: { "out-rep": ["Prepare and review financial reports", "Reconcile spending with documents"] },
  SAFEGUARDING: { "out-train": ["Train staff and partners in safeguarding", "Run safe recruitment checks"] },
};

/** Adds the activities under their outputs. An output with none listed stays as it is; the coverage report names it. */
export function withActivities(sector: LibrarySectorId, skeleton: readonly LogframeSkeletonNode[]): LogframeSkeletonNode[] {
  const byOutput = SKELETON_ACTIVITIES[sector] ?? {};
  const extra = skeleton.filter((n) => n.level === "OUTPUT").flatMap((out) => (byOutput[out.key] ?? []).map((title, i): LogframeSkeletonNode => ({ key: `${out.key}-a${i + 1}`, level: "ACTIVITY", title, parent: out.key })));
  return [...skeleton, ...extra];
}
