import type { FormDefinition, FormField } from "../form-model.js";
import type { ScoreItem, ScoreSection } from "../scoring.js";
import { GOOD_FAIR_POOR, choice, col, field, grid, num, note, ratingItem, section, yesNo, yesNoItem } from "./builders.js";
import { HF_EQUIPMENT, HF_INFRASTRUCTURE, HF_INTERVENTIONS_HOSPITAL, HF_INTERVENTIONS_RHC, HF_VERTICAL } from "./health-facility-items.js";
import type { FormKit } from "./model.js";

/**
 * The Health Facility Assessment kit: the Khyber Pakhtunkhwa Health Foundation's 24-section tool (Nov 2025) as one form. Departments
 * are asked only when the facility has them; each has an infrastructure checklist and an equipment table. The item lists come from
 * the tool's own text. The score uses infrastructure availability, services and conditions only (equipment counts are recorded and
 * reported, not scored). Weights are equal and the bands are illustrative until the Foundation sets its own.
 */
const DEPARTMENTS: ReadonlyArray<{ key: string; title: string; equipment: boolean }> = [
  { key: "admin", title: "Administration", equipment: true },
  { key: "ae", title: "Accident and emergency", equipment: true },
  { key: "lab", title: "Laboratory", equipment: true },
  { key: "imaging", title: "Imaging and radiology", equipment: false },
  { key: "medical", title: "Medical ward", equipment: true },
  { key: "surgical", title: "Surgical ward", equipment: true },
  { key: "gynae", title: "Gynae ward", equipment: true },
  { key: "paeds", title: "Paediatric ward", equipment: true },
  { key: "opd", title: "Out-patient department", equipment: true },
  { key: "labour", title: "Labour room", equipment: true },
  { key: "ot", title: "Operation theatre", equipment: true },
  { key: "icu", title: "ICU / CCU / HDU", equipment: true },
  { key: "dental", title: "Dental unit", equipment: true },
];

const has = (key: string) => ({ field: `has_${key}`, op: "EQ" as const, value: "yes" });

function departmentFields(): { fields: FormField[]; scored: ScoreSection[] } {
  const fields: FormField[] = [];
  const scored: ScoreSection[] = [];
  for (const d of DEPARTMENTS) {
    fields.push(yesNo(`has_${d.key}`, `Does the facility have a ${d.title.toLowerCase()}?`, { required: true }));
    fields.push(field(`${d.key}_why`, `Why is there no ${d.title.toLowerCase()}?`, "TEXT", { relevantWhen: { field: `has_${d.key}`, op: "EQ", value: "no" } }));
    fields.push(section(`sec_${d.key}`, d.title, "Mark each item Available or not; give the number functional and non-functional where it applies. Attach a photo where useful.", has(d.key)));
    fields.push(grid(`${d.key}_infra`, `${d.title}: infrastructure`, HF_INFRASTRUCTURE[d.key] ?? [], [
      col.yesNo("available", "Available", { allowNotApplicable: true }), col.num("functional", "Functional"), col.num("non_functional", "Non-functional"), col.text("remarks", "Remarks"),
    ]));
    if (d.equipment) fields.push(grid(`${d.key}_equip`, `${d.title}: equipment`, HF_EQUIPMENT[d.key] ?? [], [
      col.num("quantity", "Quantity"), col.num("functional", "Functional"), col.num("non_functional", "Non-functional"), col.text("make", "Model and make"), col.num("purchase_year", "Purchase year", { min: 1950, max: 2100 }), col.text("remarks", "Remarks"),
    ]));
    scored.push({ key: d.key, title: d.title, relevantWhen: has(d.key), items: [yesNoItem(`${d.key}_infra.*.available`, `${d.title}: infrastructure available`)] });
  }
  return { fields, scored };
}

function build(): FormDefinition {
  const dept = departmentFields();
  const years = [col.num("y2022", "2022"), col.num("y2023", "2023"), col.num("y2024", "2024")];
  const fields: FormField[] = [
    section("sec_details", "Assessment details"),
    field("assessed_on", "Date of assessment", "DATE", { required: true }),
    field("ms_name", "Medical Superintendent / Facility In-Charge", "TEXT", { required: true }),
    field("ms_contact", "Contact number of the Medical Superintendent", "TEXT"),
    field("dho_name", "District Health Officer", "TEXT"),
    field("dho_contact", "Contact number of the DHO", "TEXT"),
    section("sec_overview", "General overview"),
    field("ddo_code", "Facility DDO code", "TEXT"), field("dhis_code", "Facility DHIS code", "TEXT"),
    choice("facility_level", "Facility level", ["Primary", "Secondary", "Specialized"], { required: true }),
    choice("facility_type", "Facility type", ["Category-A", "Category-B", "Category-C", "Category-D", "Rural Health Centre (RHC)"], { required: true }),
    num("year_established", "Year of establishment", { min: 1850, max: 2100, carryForward: true }),
    num("catchment_population", "Catchment population", { carryForward: true }),
    field("tehsil_uc", "Tehsil / UC", "TEXT", { carryForward: true }), field("city_village", "City / village", "TEXT", { carryForward: true }),
    field("gps", "GPS coordinates", "GPS"),
    choice("road_condition", "Main road condition", ["Asphalt", "PCC", "Kachha", "Other"]),
    field("nearest_referral", "Nearest referral facility", "TEXT"), num("referral_km", "Distance to it (km)"),
    num("sanctioned_beds", "Sanctioned beds", { carryForward: true }), num("functional_beds", "Functional beds"),
    grid("annual_use", "Annual figures", ["OPD attendance", "Emergency attendance", "Indoor admissions", "Bed occupancy rate (%)", "Lab utilisation", "X-ray utilisation", "Deliveries (live births)", "Major surgeries"], years),
    num("ambulances", "Number of ambulances available"),
    yesNo("hcc_registered", "Registered with the Health Care Commission"),
    yesNo("non_related_people", "Non-related people living within the hospital premises"),
    field("non_related_details", "Occupied areas and who lives there", "TEXT", { relevantWhen: { field: "non_related_people", op: "EQ", value: "yes" }, requiredWhen: { field: "non_related_people", op: "EQ", value: "yes" } }),
    section("sec_finance", "Financial assessment (FY 2024-25)"),
    num("budget_allocation", "Annual budget allocation (PKR)"),
    grid("budget_source", "Budget source (PKR)", ["Provincial Government", "PCMC", "HMC"], [col.num("amount", "Amount (PKR)")]),
    yesNo("sehat_sahulat", "Empanelled with Sehat Sahulat Card (SHPI)"),
    num("budget_utilised", "Budget utilised (PKR)"), num("salary_spend", "Salary and HR spend (PKR)"), num("om_spend", "Operations and maintenance spend (PKR)"),
    { key: "budget_use_pct", label: "Budget used (%)", type: "CALCULATED", formula: "budget_utilised / budget_allocation * 100", decimals: 1 },
    field("development_work", "Development under way (expansion, new building)", "TEXT"),
    grid("revenue", "Hospital-generated revenue (PKR)", ["User fees", "Diagnostics", "Lab", "OPD", "Emergency", "Pharmacy"], years),
    yesNo("donor_support", "Donor funding support"), field("donor_type", "Type of donor support", "TEXT", { relevantWhen: { field: "donor_support", op: "EQ", value: "yes" } }), num("donor_amount", "Donor amount (PKR)", { relevantWhen: { field: "donor_support", op: "EQ", value: "yes" } }),
    yesNo("outsourced", "Outsourced service contracts (lab, radiology, waste, security…)"), field("outsourced_details", "Which services and cost", "TEXT", { relevantWhen: { field: "outsourced", op: "EQ", value: "yes" } }),
    yesNo("audit_available", "Audit reports available"), field("audit_file", "Attach the audit report", "FILE", { relevantWhen: { field: "audit_available", op: "EQ", value: "yes" } }),
    section("sec_blocks", "Buildings"),
    { key: "blocks", label: "Building blocks", type: "REPEAT", rowLabel: "Block", maxRows: 30, fields: [
      field("name", "Block name (administration, OPD, emergency, IPD, residential…)", "TEXT", { required: true }), num("storeys", "Number of storeys"), num("covered_area", "Covered area (sq. ft.)"), num("built_year", "Year of construction or last renovation", { min: 1850, max: 2100 }),
      choice("masonry", "Masonry type", ["Fabricated", "Concrete blocks", "Container / other", "Mixed"]), choice("roof", "Roof construction", ["RCC", "Metal", "Tiles", "Fabricated"]),
      choice("condition", "Structural condition", GOOD_FAIR_POOR), field("remarks", "Remarks", "TEXT"),
    ] },
    ...dept.fields,
    section("sec_vertical", "Vertical programmes"),
    grid("vertical", "Vertical programmes at the facility", HF_VERTICAL, [col.yesNo("available", "Available / in place", { allowNotApplicable: true }), col.text("remarks", "Remarks")]),
    section("sec_services", "Facility services"),
    choice("water_source", "Main source of water", ["Municipal line", "Bore", "Spring", "Tube well", "Tanker"]),
    choice("water_hours", "Daily water supply hours", ["Under 4 hours", "4 to 8 hours", "8 to 24 hours"]),
    choice("water_reliability", "Reliability of supply", ["Continuous", "Intermittent"]),
    yesNo("clean_drinking_water", "Clean drinking water available"), yesNo("water_quality_tested", "Water quality tested periodically"),
    choice("sanitation_disposal", "Disposal of washroom waste", ["Septic tank", "Main sewer", "Direct disposal", "Other"]),
    choice("power_source", "Main source of electricity", ["WAPDA", "Express line", "Other"]),
    yesNo("power_arrears", "Arrears of electricity bills"), yesNo("generator", "Generator backup"), yesNo("solar", "Solar backup"), yesNo("ups", "UPS or battery backup"),
    yesNo("waste_segregation", "Waste segregated at the point of generation (colour-coded bins)"), yesNo("waste_storage", "Temporary storage room for waste"),
    choice("waste_disposal", "Final disposal of waste", ["Incineration", "Dumping pit", "Other"]), yesNo("waste_sop", "Waste management SOPs available"),
    yesNo("open_burning", "Open burning or dumping seen"),
    section("sec_pharmacy", "Pharmacy and dispensary"),
    grid("pharmacy", "Pharmacy", ["OPD pharmacy / dispensary", "Emergency pharmacy", "Inpatient / central pharmacy", "Storage space (shelves, racks, cold storage)", "Controlled drugs securely stored", "Vaccines and refrigerated medicines stored properly", "Expiry monitoring and FIFO/FEFO", "Computerised pharmacy information system", "Handwashing and hygiene facilities", "Fire safety measures", "Disposal system for expired medicines"], [col.yesNo("available", "Available / in place"), col.text("remarks", "Remarks")]),
    section("sec_interventions", "Interventions offered"),
    grid("interventions_rhc", "Rural health centre level interventions", HF_INTERVENTIONS_RHC, [col.yesNo("available", "Available", { allowNotApplicable: true })]),
    grid("interventions_hospital", "Hospital level interventions", HF_INTERVENTIONS_HOSPITAL, [col.yesNo("available", "Available", { allowNotApplicable: true })]),
    section("sec_staff", "Human resources", "Add a row for each member of staff."),
    note("staff_note", "Staff names and registration numbers are personal data. Keep this form to people who need it."),
    { key: "staff", label: "Staff", type: "REPEAT", rowLabel: "Person", maxRows: 100, fields: [
      choice("group", "Group", ["Management staff", "Specialists", "Medical officers", "Nursing staff", "Paramedics", "Class-IV / support"], { required: true }),
      field("name", "Name", "TEXT", { required: true }), field("designation", "Designation", "TEXT"), field("personnel_no", "Personnel number", "TEXT"),
      choice("filled_by", "Filled by", ["Regular", "Contractual", "AIP"]), yesNo("detailed_in", "Detailed IN on general duty"), yesNo("detailed_out", "Detailed OUT on general duty"),
      field("registration_no", "PMDC / CPSP / PNC / HEC number", "TEXT"), field("joined_on", "Joining date", "DATE"), num("gross_pay", "Gross pay"),
      yesNo("verified", "Verified and physically present"), field("remarks", "Remarks", "TEXT"),
    ] },
    section("sec_signoff", "Sign-off"),
    field("ms_signature", "Signature of the Medical Superintendent", "SIGNATURE", { signer: "Medical Superintendent" }),
    field("dho_signature", "Signature of the DHO", "SIGNATURE", { signer: "District Health Officer" }),
  ];
  const scoreItems = (key: string, title: string, items: ScoreItem[]): ScoreSection => ({ key, title, items });
  return {
    subject: "FACILITY",
    fields,
    constraints: [
      { kind: "LTE", fields: ["functional_beds", "sanctioned_beds"] },
      { kind: "LTE", fields: ["budget_utilised", "budget_allocation"] },
    ],
    score: {
      illustrative: true, minAnsweredShare: 0.6,
      bands: [{ min: 80, label: "Ready", tone: "GOOD" }, { min: 50, label: "Partly ready", tone: "FAIR" }, { min: 0, label: "Not ready", tone: "POOR" }],
      sections: [
        ...dept.scored,
        scoreItems("buildings", "Buildings", [ratingItem("blocks.*.condition", "Building condition")]),
        scoreItems("programmes", "Vertical programmes and pharmacy", [yesNoItem("vertical.*.available", "Programme in place"), yesNoItem("pharmacy.*.available", "Pharmacy item in place")]),
        scoreItems("services", "Services and safety", [yesNoItem("clean_drinking_water", "Clean drinking water"), yesNoItem("water_quality_tested", "Water quality tested"), yesNoItem("generator", "Generator backup"), yesNoItem("waste_segregation", "Waste segregated"), yesNoItem("waste_sop", "Waste SOPs")]),
        scoreItems("interventions", "Interventions offered", [yesNoItem("interventions_rhc.*.available", "RHC-level intervention"), yesNoItem("interventions_hospital.*.available", "Hospital-level intervention")]),
      ],
    },
  };
}

export const HEALTH_FACILITY_KIT: FormKit = {
  id: "health-facility-assessment",
  name: "Health facility assessment",
  sector: "HEALTH",
  description: "A facility-by-facility assessment of buildings, departments, equipment, services, staffing and interventions, with a readiness score.",
  source: "Khyber Pakhtunkhwa Health Foundation, Health Facility Assessment Tool (November 2025).",
  unreviewed: true,
  build,
  suggestedIndicators: [
    { code: "HFA-1", name: "Facilities assessed", unit: "facilities", method: "COUNT", plain: "How many facilities have a reviewed assessment in the period." },
    { code: "HFA-2", name: "Share of facilities rated Ready", unit: "%", method: "PERCENT_WHERE", plain: "Of facilities assessed, the share whose score reaches the Ready band." },
    { code: "HFA-3", name: "Average readiness score", unit: "%", method: "AVERAGE_SCORE", plain: "The average overall score of facilities assessed (never added up)." },
  ],
  notes: [
    "Equipment counts are recorded and reported but not scored.",
    "Weights are equal and the bands are illustrative until the Foundation sets its own.",
    "Section 21 (the EPHS infrastructure checklist) is not included: its text was not readable in the source file. Add it as a table.",
    "The wording and item lists come from the source tool and have not been reviewed by a health sector reviewer.",
  ],
};
