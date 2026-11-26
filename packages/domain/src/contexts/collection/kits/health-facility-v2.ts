import type { FormDefinition, FormField } from "../form-model.js";
import type { ScoreSection } from "../scoring.js";
import { field, grid, note, section, yesNo } from "./builders.js";
import { FACILITY_TYPES, GRID_COLUMNS, moduleA, moduleAD, moduleAE, moduleB, repeatsFor } from "./health-facility-v2-core.js";
import { HFA_V2_MODULES } from "./health-facility-v2-items.js";
import type { FormKit } from "./model.js";

/**
 * Health facility assessment, Master Version 2.0 (KP Health Foundation, November 2026 draft): one master tool with a common core and
 * service modules that are asked only when the service is mandated or provided. Modules A, B, AD and AE record facts; every other
 * module is a table of its items, each rated on the tool's 0-3 scale with how it was verified. Field keys are the tool's own item ids.
 */
const RECORD_MODULES = new Set(["A", "B", "AD", "AE"]);
const SERVICE_MODULES = ["R", "S", "T", "U", "V", "W", "X", "Y", "Z", "AA", "AB", "AC"];
const GATE_OPTIONS = [
  { value: "provided", label: "Mandated and provided" }, { value: "suspended", label: "Mandated, temporarily suspended" }, { value: "not_provided", label: "Mandated, not provided" },
  { value: "not_mandated", label: "Not mandated (not applicable)" }, { value: "planned", label: "Planned" },
];
const lower = (c: string) => c.toLowerCase();
const gateKey = (c: string) => `svc_${lower(c)}`;
const asked = (c: string) => ({ field: gateKey(c), op: "IN" as const, value: ["provided", "suspended"] });

function gateFields(code: string, title: string): FormField[] {
  const k = gateKey(code);
  const optional = code === "AC";
  const f: FormField[] = [field(k, optional ? `Module ${code}: are staff residences in the scope of this assessment?` : `Module ${code}: ${title}. Is the service mandated or provided here?`, "SELECT", { required: true, options: optional ? [{ value: "provided", label: "Yes, in scope" }, { value: "not_mandated", label: "No" }] : GATE_OPTIONS })];
  if (!optional) {
    f.push(field(`${k}_basis`, "Where does this come from (notification, package, order)?", "TEXT", { relevantWhen: { field: k, op: "EQ", value: "not_mandated" } }));
    f.push(field(`${k}_gap`, `Why is it not running, since when, who is affected and what will be done?`, "TEXT", { maxLength: 1000, relevantWhen: { field: k, op: "IN", value: ["suspended", "not_provided"] }, requiredWhen: { field: k, op: "IN", value: ["suspended", "not_provided"] } }));
  }
  return f;
}

function moduleFields(): { fields: FormField[]; scored: ScoreSection[] } {
  const fields: FormField[] = [];
  const scored: ScoreSection[] = [];
  for (const m of HFA_V2_MODULES) {
    const service = SERVICE_MODULES.includes(m.code);
    const gate = service ? asked(m.code) : undefined;
    if (service) fields.push(...gateFields(m.code, m.title));
    fields.push(section(`sec_${lower(m.code)}`, `Module ${m.code}: ${m.title}`, m.purpose.replace(/^Purpose:\s*/, ""), gate));
    if (m.code === "A") fields.push(...moduleA());
    else if (m.code === "B") fields.push(...moduleB());
    else if (m.code === "AD") fields.push(...moduleAD());
    else if (m.code === "AE") fields.push(...moduleAE());
    if (!RECORD_MODULES.has(m.code)) {
      const labels = m.items.map((i) => `${i.id} ${i.question}: ${i.response}`.slice(0, 295));
      fields.push(grid(`${lower(m.code)}_items`, `Module ${m.code}: ${m.title}`, labels, GRID_COLUMNS, {
        help: "Rate each item 3 to 0, or mark it Not applicable (with the reason) or Not assessed. Not applicable and Not assessed are never counted as 0. Record how you verified it and a reference for the evidence.",
        ...(gate ? { relevantWhen: gate } : {}),
      }));
      fields.push(...repeatsFor(m.code).map((f) => (gate ? { ...f, relevantWhen: gate } : f)));
      scored.push({ key: lower(m.code), title: `${m.code} ${m.title}`, ...(gate ? { relevantWhen: gate } : {}), items: [{ path: `${lower(m.code)}_items.*.rating`, label: m.title, points: { s3: 3, s2: 2, s1: 1, s0: 0 } }] });
    }
  }
  return { fields, scored };
}

function build(): FormDefinition {
  const { fields, scored } = moduleFields();
  const lead: FormField[] = [
    note("hfa_note", "This is one master tool. Complete modules A and B first, then every core module. Service modules open only where the service is mandated or provided. N/A needs a reason; Not assessed is not N/A and is never counted as 0."),
    note("hfa_types", `Facility types in the tool: ${FACILITY_TYPES.join(", ")}. The modules a type is expected to have are a guide set by the approved package, not a rule in this form.`),
  ];
  return {
    subject: "FACILITY",
    fields: [...lead, ...fields],
    constraints: [{ kind: "LTE", fields: ["h_tracer_available", "h_tracer_required"] }, { kind: "LTE", fields: ["k_spent", "k_allocated"] }, { kind: "LTE", fields: ["p_days_delivered", "p_days_planned"] }, { kind: "LTE", fields: ["p_reports_in", "p_reports_due"] }],
    score: { illustrative: true, minAnsweredShare: 0.6, bands: [{ min: 0, label: "Read the module results; there is no overall rating", tone: "FAIR" }], sections: scored },
  };
}

export const HEALTH_FACILITY_V2_KIT: FormKit = {
  id: "health-facility-assessment-v2",
  name: "Health facility assessment (Master Version 2.0)",
  sector: "HEALTH",
  description: "One master tool for any public facility, from dispensary to specialised hospital: a core of 17 modules and 12 service modules asked only where the service is mandated or provided.",
  source: "Khyber Pakhtunkhwa Health Foundation, Comprehensive Health Facility Assessment Tool, Master Version 2.0 (draft for technical validation, November 2026).",
  unreviewed: true,
  build,
  suggestedIndicators: [
    { code: "HFA2-1", name: "Facilities with a completed assessment", unit: "facilities", method: "COUNT", plain: "How many facilities have a reviewed assessment in the period." },
  ],
  notes: [
    "The tool says not to average every question into one facility score. Each module is scored on its own (0-3 items, illustrative), no band is shown, and critical findings are listed separately; ignore the overall figure.",
    "Module A, B, AD and AE are records. Equipment, staff and medicine tables are repeatable rows, not fixed lists: the facility's own approved lists must be mapped before rollout.",
    "Which modules a facility type should have is not hard-coded (the tool says an administrator must configure it): the assessor answers each service gate.",
    "Not built here: the technical-review workflow (Draft to Approved), document uploads per question (use the evidence reference), a facility-type default for the gates.",
  ],
};
