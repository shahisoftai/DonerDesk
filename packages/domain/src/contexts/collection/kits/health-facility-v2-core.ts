import type { FormField, GridColumn } from "../form-model.js";
import { choice, col, field, num, yesNo } from "./builders.js";

/** The hand-written parts of the Master Version 2.0 tool: modules whose items are records, not ratings (A, B, AD, AE) and the repeatable records. */
const when = (f: string, v: string) => ({ field: f, op: "EQ" as const, value: v });
const txt = (key: string, label: string, extra: Partial<FormField> = {}) => field(key, label, "TEXT", extra);
const date = (key: string, label: string, extra: Partial<FormField> = {}) => field(key, label, "DATE", extra);

export const VERIFICATION = ["Physically verified", "Document verified", "Reported only", "Not verified"] as const;
export const EVIDENCE_SOURCE = ["Direct observation", "Official record", "Register", "Electronic system", "Staff interview", "Patient or community feedback", "Other"] as const;
export const FACILITY_TYPES = ["Dispensary", "BHU", "RHC", "Civil Hospital", "THQ", "DHQ", "Teaching hospital", "Specialised hospital", "Other"] as const;

export function moduleA(): FormField[] {
  return [
    choice("a_type", "A-03 Assessment type", ["Baseline", "Follow-up", "Verification", "Special review"], { required: true }),
    date("a_date", "A-02 Assessment date", { required: true }), txt("a_start", "Start time", { maxLength: 10 }), txt("a_end", "End time", { maxLength: 10 }),
    { key: "a_team", label: "A-04 Assessment team", type: "REPEAT", rowLabel: "Team member", minRows: 1, maxRows: 20, fields: [txt("name", "Name", { required: true }), txt("role", "Role"), txt("organisation", "Organisation"), txt("contact", "Contact", { maxLength: 40 })] },
    txt("a_focal_name", "A-05 Facility focal person: name"), txt("a_focal_role", "Designation"), txt("a_focal_contact", "Official contact", { maxLength: 40 }),
    txt("a_head_name", "A-06 Facility head / in-charge: name", { required: true }), txt("a_head_role", "Designation"), txt("a_head_contact", "Contact", { maxLength: 40 }),
    { key: "a_reps", label: "A-07 District / provincial representatives", type: "REPEAT", rowLabel: "Representative", maxRows: 20, fields: [txt("name", "Name"), txt("designation", "Designation"), txt("office", "Office"), txt("role", "Role in the assessment")] },
    choice("a_scope", "A-08 Assessment scope", ["Full assessment", "Selected domains"], { required: true }),
    txt("a_scope_modules", "Modules included and excluded", { maxLength: 500, relevantWhen: when("a_scope", "selected_domains"), requiredWhen: when("a_scope", "selected_domains") }),
    date("a_ref_start", "A-09 Reference period for service, HR and finance data: from"), date("a_ref_end", "to"),
    txt("a_constraints", "A-10 Assessment constraints (access, unavailable records, disruption, security, season)", { maxLength: 1500 }),
    yesNo("a_open_meeting", "A-11 Opening meeting held?"), date("a_open_date", "Opening meeting date", { relevantWhen: when("a_open_meeting", "yes") }),
    yesNo("a_close_meeting", "A-12 Closing discussion held?"), txt("a_close_points", "Key points shared", { maxLength: 1000, relevantWhen: when("a_close_meeting", "yes") }),
  ];
}

export function moduleB(): FormField[] {
  return [
    txt("b_name", "B-01 Official facility name", { required: true }), txt("b_local_name", "Local or former name"),
    txt("b_ddo", "B-02 DDO code", { maxLength: 40 }), txt("b_dhis", "DHIS code", { maxLength: 40 }), txt("b_other_code", "Other official ID", { maxLength: 40 }),
    choice("b_level", "B-03 Facility level", ["Primary", "Secondary", "Tertiary", "Specialised", "Other"], { required: true }),
    choice("b_type", "B-04 Facility type", FACILITY_TYPES, { required: true }),
    choice("b_owner", "B-05 Ownership", ["Government", "Autonomous", "Other"]), txt("b_authority", "Managing authority"),
    num("b_year", "B-06 Year established", { min: 1800, max: 2100, carryForward: true }), date("b_commenced", "Date services commenced"), txt("b_upgrades", "Major upgrade dates", { maxLength: 300 }),
    txt("b_tehsil", "B-07 Tehsil", { carryForward: true }), txt("b_uc", "Union council", { carryForward: true }), txt("b_locality", "Locality / village / urban area", { carryForward: true }),
    field("b_gps", "B-08 GPS coordinates (stand at the main gate)", "GPS"),
    num("b_catchment", "B-09 Catchment population", { carryForward: true }), txt("b_catchment_src", "Source and year of that figure"), num("b_catchment_rural", "Share rural (%)", { max: 100 }),
    { key: "b_catch_kind", label: "B-10 Catchment characteristics", type: "MULTI_SELECT", options: ["Remote", "Mountainous", "Urban", "Peri-urban", "Conflict-affected", "Seasonal", "Mobile population", "Other"].map((o) => ({ value: o.toLowerCase().replace(/[^a-z]+/g, "_"), label: o })) },
    yesNo("b_allseason", "B-11 Accessible in all seasons?"), choice("b_road", "Road surface", ["Asphalt", "PCC", "Kachha", "Other"]), num("b_travel_min", "Typical travel time from the nearest town (minutes)"),
    { key: "b_referral", label: "B-12 Nearest referral facilities", type: "REPEAT", rowLabel: "Facility", maxRows: 10, fields: [txt("name", "Facility", { required: true }), txt("level", "Level"), txt("service", "Service"), num("km", "Distance (km)"), num("minutes", "Travel time (minutes)"), txt("constraints", "Route constraints")] },
    num("b_days", "B-13 Days open per week", { max: 7 }), num("b_hours", "Hours open per day", { max: 24 }), yesNo("b_24x7", "Open 24 hours, 7 days?"),
    txt("b_package", "B-14 Authorised service package (and its notification reference)", { maxLength: 500 }), field("b_package_file", "Attach the notification (optional)", "FILE"),
    choice("b_status", "B-15 Service status", ["Fully operational", "Partially operational", "Temporarily closed", "Under construction", "Other"], { required: true }),
    txt("b_accreditation", "B-16 Registration / accreditation: regulator, number, validity"), yesNo("b_insurance", "B-17 Empanelled for Sehat Card or another purchaser?"),
    txt("b_insurance_detail", "Scheme, contract period and services covered", { relevantWhen: when("b_insurance", "yes"), maxLength: 500 }),
    { key: "b_other_entities", label: "B-18 Other facilities or entities on the premises", type: "REPEAT", rowLabel: "Entity", maxRows: 10, fields: [txt("entity", "Entity"), txt("area", "Area occupied"), txt("purpose", "Purpose"), txt("authorisation", "Authorisation / agreement")] },
  ];
}

export function moduleAD(): FormField[] {
  return [
    { key: "ad_findings", label: "Findings, risks and actions", type: "REPEAT", rowLabel: "Finding", maxRows: 100,
      help: "Add a finding as soon as you see it. A Critical or High finding needs evidence, what was done at once and who is responsible.",
      fields: [
        txt("source", "AD-01 Question it came from (for example E-11)", { maxLength: 20 }), txt("title", "AD-02 Finding", { required: true, maxLength: 500 }), txt("where", "AD-03 Module, department, room or block"),
        choice("category", "AD-04 Category", ["Safety", "Service readiness", "HR", "Infrastructure", "Equipment", "Medicine", "Finance", "Quality", "Data", "Other"], { required: true }),
        choice("severity", "AD-05 Severity", ["Critical", "High", "Medium", "Low"], { required: true }), txt("severity_why", "Why this severity", { maxLength: 500 }),
        choice("verification", "AD-06 How it was verified", VERIFICATION), txt("evidence_ref", "Evidence reference (photo ID, register, document)", { requiredWhen: { any: [when("severity", "critical"), when("severity", "high")] } }),
        choice("cause_state", "AD-07 Cause", ["Confirmed", "Suspected", "Not known"]), txt("cause", "Cause or contributing factors", { maxLength: 500 }), txt("impact", "AD-08 Service and population affected", { maxLength: 500 }),
        txt("action", "AD-09 Recommended corrective action", { maxLength: 800 }), choice("authority", "AD-10 Responsible authority", ["Facility", "District", "Provincial", "Contractor", "Partner", "Other"]),
        date("due", "AD-11 Target date"), choice("cost", "AD-12 Resource needed", ["No cost", "Operational", "Recurrent", "Capital"]), num("cost_pkr", "Indicative cost (PKR), if known"),
        yesNo("escalate", "AD-15 Needs immediate notification?"), txt("escalate_to", "Whom, when and how", { relevantWhen: when("escalate", "yes"), requiredWhen: when("escalate", "yes") }),
        txt("mitigation", "What was done at once", { maxLength: 500, requiredWhen: { any: [when("severity", "critical"), when("severity", "high")] } }),
      ] },
  ];
}

export function moduleAE(): FormField[] {
  return [
    yesNo("ae_core_done", "AE-01 Every core module is complete?"), txt("ae_core_open", "What is outstanding", { maxLength: 800, relevantWhen: when("ae_core_done", "no") }),
    txt("ae_data_quality", "AE-04 Data checks: what was missing, inconsistent or duplicated, and how it was resolved", { maxLength: 1500 }),
    txt("ae_facility_review", "AE-05 Facility comments or corrections (and any disagreement)", { maxLength: 1500 }),
    field("ae_assessor_sig", "AE-06 Assessor declaration: information recorded accurately to the best of my knowledge", "SIGNATURE", { signer: "Assessor" }),
    field("ae_facility_sig", "AE-07 Facility representative: acknowledges the discussion and factual review", "SIGNATURE", { signer: "Facility representative" }),
    txt("ae_reviewer", "AE-08 Technical reviewer: name, designation, date, decision", { maxLength: 500 }),
    date("ae_next", "AE-10 Next assessment due"),
  ];
}

export function repeatsFor(code: string): FormField[] {
  switch (code) {
    case "D": return [
      { key: "d_blocks", label: "D-02 Blocks", type: "REPEAT", rowLabel: "Block", maxRows: 40, fields: [txt("name", "Block name", { required: true }), txt("purpose", "Purpose"), num("storeys", "Storeys"), num("area", "Covered area (sq. ft.)"), num("built", "Year built", { min: 1800, max: 2100 }), num("renovated", "Year renovated", { min: 1800, max: 2100 }), choice("condition", "Structural condition", ["Good", "Fair", "Poor", "Suspected unsafe"]), txt("remarks", "Remarks")] },
      { key: "d_rooms", label: "D-05 Rooms and units", type: "REPEAT", rowLabel: "Room", maxRows: 100, fields: [txt("name", "Room or unit", { required: true }), txt("block", "Block"), txt("floor", "Floor"), txt("dimensions", "Dimensions"), txt("intended", "Intended use"), txt("actual", "Actual use"), choice("condition", "Condition", ["Good", "Fair", "Poor"]), choice("adequacy", "Adequacy", ["Adequate", "Partially adequate", "Inadequate", "Not assessed"])] },
      field("d_photos", "D-18 Photographs: exterior, blocks and deficiencies (optional)", "FILE")];
    case "F": return [
      { key: "f_establishment", label: "F-01 Approved establishment by cadre", type: "REPEAT", rowLabel: "Cadre", maxRows: 60, fields: [txt("cadre", "Cadre", { required: true }), txt("grade", "Grade"), num("sanctioned", "Sanctioned posts"), num("filled", "Posts filled"), num("present", "Present on the day (physically verified)"), txt("source", "Source and date of approval")] },
      { key: "f_fill_rate", label: "Staffing fill rate (%)", type: "CALCULATED", formula: "sum(f_establishment.*.filled) / sum(f_establishment.*.sanctioned) * 100", decimals: 1, help: "Filled posts ÷ sanctioned posts × 100. Staff physically present are reported separately." },
      { key: "f_roster", label: "F-02 Staff roster (restricted: personal data)", type: "REPEAT", rowLabel: "Person", maxRows: 100, help: "Names and registration numbers are personal data. Record person-level detail only where it is needed.",
        fields: [txt("cadre", "Cadre", { required: true }), txt("name", "Name"), txt("designation", "Designation"), choice("employment", "Employment type", ["Regular", "Contractual", "AIP", "Outsourced", "Other"]), date("posted", "Posting date"), yesNo("present", "Present on the assessment day?"), choice("verified_by", "How verified", ["Roll call", "Attendance record", "Reported only"]), txt("registration", "Registration body and number", { maxLength: 60 }), date("valid_to", "Registration valid to")] }];
    case "G": return [
      { key: "g_equipment", label: "G-01 Equipment inventory", type: "REPEAT", rowLabel: "Item", maxRows: 100, fields: [txt("name", "Item", { required: true }), txt("category", "Category"), txt("department", "Department"), txt("model", "Make and model"), txt("serial", "Serial or asset ID"), num("required", "Required"), num("available", "Available"), num("functional", "Functional"), num("partial", "Partly functional"), num("broken", "Non-functional"), choice("use", "Use", ["Routine", "Occasional", "Not used"]), txt("reason", "Reason for non-use or breakdown"), date("service_due", "Next service due")] }];
    case "H": return [
      { key: "h_stock", label: "H-03 Tracer medicines on the day", type: "REPEAT", rowLabel: "Medicine", maxRows: 100, fields: [txt("name", "Generic name", { required: true }), txt("strength", "Strength and form"), yesNo("required", "On the list required for this facility?"), yesNo("available", "Available and usable today?"), num("quantity", "Usable quantity"), date("expiry", "Earliest expiry"), num("stockout_days", "Days out of stock in the reference period")] },
      { key: "h_tracer_required", label: "Tracer medicines required (list version)", type: "NUMBER", min: 0 }, { key: "h_tracer_available", label: "Tracer medicines available and usable today", type: "NUMBER", min: 0 },
      { key: "h_availability", label: "Essential medicine availability (%)", type: "CALCULATED", formula: "h_tracer_available / h_tracer_required * 100", decimals: 1 }, txt("h_list_version", "Tracer list version used")];
    case "K": return [
      num("k_allocated", "K-02 Budget allocated (PKR)"), num("k_released", "K-03 Funds released (PKR)"), num("k_spent", "K-04 Spent to date (PKR)"), { key: "k_utilisation", label: "K-05 Budget utilisation (%)", type: "CALCULATED", formula: "k_spent / k_released * 100", decimals: 1, help: "Spent ÷ released × 100. If the figures are not available, mark the question Not assessed; do not enter 0." }, txt("k_period", "Financial year and period these figures cover"),
      { key: "k_contracts", label: "K-11 Outsourced service contracts", type: "REPEAT", rowLabel: "Contract", maxRows: 30, fields: [txt("service", "Service", { required: true }), txt("provider", "Provider"), txt("number", "Contract number"), num("value", "Value (PKR)"), date("from", "From"), date("to", "To"), txt("kpis", "KPIs and monitoring"), choice("performance", "Performance", ["Good", "Fair", "Poor", "Not assessed"])] }];
    case "N": return [
      { key: "n_destinations", label: "N-01 Referral destinations", type: "REPEAT", rowLabel: "Destination", maxRows: 20, fields: [txt("facility", "Facility", { required: true }), txt("service", "Service"), txt("contact", "Contact"), num("km", "Distance (km)"), num("minutes", "Travel time (minutes)"), yesNo("acceptance", "Acceptance arrangement in place?")] }];
    case "P": return [
      num("p_bed_days", "Inpatient bed-days in the period"), num("p_avail_bed_days", "Available bed-days in the period"), { key: "p_occupancy", label: "P-05 Bed occupancy rate (%)", type: "CALCULATED", formula: "p_bed_days / p_avail_bed_days * 100", decimals: 1 },
      num("p_inpatient_days", "Inpatient days"), num("p_discharges", "Discharges (including deaths)"), { key: "p_los", label: "P-06 Average length of stay (days)", type: "CALCULATED", formula: "p_inpatient_days / p_discharges", decimals: 1 },
      num("p_days_delivered", "Days the service was actually delivered"), num("p_days_planned", "Days the service was scheduled"), { key: "p_service_avail", label: "P-19 Service availability (%)", type: "CALCULATED", formula: "p_days_delivered / p_days_planned * 100", decimals: 1 },
      num("p_reports_in", "Reports received"), num("p_reports_due", "Reports expected"), { key: "p_completeness", label: "Report completeness (%)", type: "CALCULATED", formula: "p_reports_in / p_reports_due * 100", decimals: 1 }];
    case "Q": return [
      { key: "q_proposals", label: "Q-01 Development proposals", type: "REPEAT", rowLabel: "Proposal", maxRows: 40, fields: [txt("title", "Title", { required: true }), txt("location", "Location and department"), choice("type", "Type", ["Repair", "Rehabilitation", "Expansion", "New construction", "Equipment", "ICT", "Utilities", "Staffing", "Other"]), txt("problem", "Problem it solves", { maxLength: 600 }), txt("scope", "Scope and specifications", { maxLength: 600 }), choice("design", "Technical design status", ["Concept", "Feasibility", "Design", "Drawings", "BOQ", "Approved"]), num("capital", "Capital cost (PKR)"), num("recurrent", "Recurrent cost per year (PKR)"), choice("readiness", "Ready to implement?", ["Ready", "Partly ready", "Not ready"]), choice("priority", "Priority", ["Critical", "High", "Medium", "Low"]), txt("route", "Delivery route (government, partner, PPP…)")] }];
    case "V": return [
      { key: "v_wards", label: "V-06 Inpatient wards", type: "REPEAT", rowLabel: "Ward", maxRows: 20, fields: [txt("name", "Ward", { required: true }), num("sanctioned", "Sanctioned beds"), num("functional", "Functional beds"), num("staffed", "Staffed beds"), num("nurses_day", "Nurses on day shift"), num("nurses_night", "Nurses on night shift"), yesNo("toilets", "Working toilets?")] }];
    case "AC": return [
      { key: "ac_units", label: "AC-01 Residences", type: "REPEAT", rowLabel: "Building or unit", maxRows: 100, fields: [txt("name", "Building or unit", { required: true }), num("rooms", "Rooms"), num("area", "Area (sq. ft.)"), choice("occupancy", "Occupancy", ["Occupied", "Vacant", "Uninhabitable"]), choice("condition", "Condition", ["Good", "Fair", "Poor"]), txt("repairs", "Repairs needed")] }];
    default: return [];
  }
}

export const GRID_COLUMNS: GridColumn[] = [
  { key: "rating", label: "Rating", type: "SELECT", options: [{ value: "s3", label: "3 Meets the requirement" }, { value: "s2", label: "2 Minor or moderate gap" }, { value: "s1", label: "1 Major deficiency" }, { value: "s0", label: "0 Absent or not working" }, { value: "not_assessed", label: "Not assessed (say why)" }], allowNotApplicable: true },
  col.choice("verification", "How verified", VERIFICATION), col.text("evidence_ref", "Evidence reference"), col.yesNo("critical", "Critical / safety-related?"), col.text("remarks", "Remarks"),
];
