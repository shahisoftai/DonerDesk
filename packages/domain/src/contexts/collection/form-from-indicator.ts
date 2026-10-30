/**
 * A collection form drafted from one indicator (Phase 36): "enter small, compile automatically". Staff record each event (a
 * training, a distribution, a visit) with the day it happened and how many; the totals are added up for each reporting period by
 * the existing record aggregation. Pure; the handler saves the draft and a person reviews it before publishing.
 *
 * Only an indicator whose period value is a sum of records can be drafted this way. A rate, a ratio, a "latest reading" or a
 * calculated value is not made of records, so no form is offered and the reason is given in plain words.
 */
import type { FormDefinition, FormField } from "./form-rules.js";
import type { RecordMapping } from "./record-aggregation.js";

export interface IndicatorForForm {
  id: string;
  code: string;
  name: string;
  unit?: string | undefined;
  /** How the indicator's period value is formed (`effectiveIndicatorSemantics(...).aggregation`). */
  aggregation: string;
  /** Calculated from other indicators. */
  isCalculated?: boolean | undefined;
}

export type FormDraft =
  | { ok: true; name: string; fields: FormField[]; mappings: RecordMapping[]; notes: string[] }
  | { ok: false; reason: string };

/** The form's name is the indicator, kept short enough for a list. */
function nameFor(i: IndicatorForForm): string {
  const full = `${i.code}: ${i.name}`;
  return full.length > 120 ? `${full.slice(0, 117)}...` : full;
}

export function formFromIndicator(indicator: IndicatorForForm): FormDraft {
  if (indicator.isCalculated) {
    return { ok: false, reason: `${indicator.code} is calculated from other indicators, so there is nothing to record. Record the indicators it is calculated from instead.` };
  }
  if (indicator.aggregation !== "SUM") {
    return { ok: false, reason: `${indicator.code} is not a total of records (it is read as ${readAs(indicator.aggregation)}), so a form cannot add it up. Enter its value directly with Enter data.` };
  }
  const what = indicator.unit?.trim() ? indicator.unit.trim() : "people";
  const fields: FormField[] = [
    { key: "date", label: "Date", type: "DATE", required: true },
    { key: "value", label: `Number of ${what}`, type: "NUMBER", required: true, min: 0 },
    { key: "place", label: "Where", type: "PLACE" },
    { key: "note", label: "Note (optional)", type: "TEXT", maxLength: 500 },
  ];
  return {
    ok: true,
    name: nameFor(indicator),
    fields,
    mappings: [{ indicatorId: indicator.id, method: "SUM", valueField: "value", dateField: "date" }],
    notes: [
      `Each record adds its number to ${indicator.code} for the reporting period its date falls in.`,
      "Only accepted records are counted, and totals arrive as drafts for you to check.",
      "Change the questions if you need to, then publish the form.",
    ],
  };
}

function readAs(aggregation: string): string {
  switch (aggregation) {
    case "LATEST": return "the latest reading";
    case "AVERAGE": return "an average";
    case "PERCENTAGE": return "a percentage";
    case "RATIO": return "a ratio";
    default: return "something other than a sum";
  }
}

/** Is the draft a valid form as it stands? (Kept next to the draft so a change to the fields cannot silently break publishing.) */
export function draftDefinition(draft: Extract<FormDraft, { ok: true }>): FormDefinition {
  return { fields: draft.fields };
}
