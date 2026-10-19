/**
 * Custom fields per project (phase 28.1-C): a donor's own tags and codes on each planned activity. A project defines a
 * few fields (text, number, date, or one choice from a list); a person fills them on the plan item. Blank stays blank:
 * an empty value is stored as nothing, never as 0 or "".
 */
import { DomainError } from "../../core/domain-error.js";
import { err, ok, type Result } from "../../core/result.js";
import { isPlainDate, type PlainDate } from "./plain-date.js";

export const CUSTOM_FIELD_TYPES = ["TEXT", "NUMBER", "DATE", "CHOICE"] as const;
export type CustomFieldType = (typeof CUSTOM_FIELD_TYPES)[number];

export const CUSTOM_FIELD_TYPE_LABEL: Readonly<Record<CustomFieldType, string>> = {
  TEXT: "Text", NUMBER: "Number", DATE: "Date", CHOICE: "One choice from a list",
};
export const MAX_CUSTOM_FIELDS = 20;
export const MAX_CHOICES = 30;
export const MAX_TEXT_VALUE = 500;
export const MAX_FIELD_LABEL = 80;

export interface CustomFieldDefinitionInput {
  label: string;
  type: CustomFieldType;
  choices?: ReadonlyArray<string>;
}

export interface CustomFieldDefinition {
  key: string;
  label: string;
  type: CustomFieldType;
  choices: string[];
}

/** A stable key from the label: lower-case letters and digits joined by underscores. */
export function customFieldKey(label: string): string {
  return label.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

/** Checks a new definition against the project's existing ones. Returns the stored form. */
export function defineCustomField(input: CustomFieldDefinitionInput, existing: ReadonlyArray<{ key: string }>): Result<CustomFieldDefinition> {
  const label = input.label.trim();
  if (!label) return err(DomainError.validation("Name the field", { field: "label" }));
  if (label.length > MAX_FIELD_LABEL) return err(DomainError.validation(`Keep the name to ${MAX_FIELD_LABEL} characters`, { field: "label" }));
  if (!CUSTOM_FIELD_TYPES.includes(input.type)) return err(DomainError.validation("Choose text, number, date or one choice", { field: "type" }));
  const key = customFieldKey(label);
  if (!key) return err(DomainError.validation("Use letters or numbers in the name", { field: "label" }));
  if (existing.length >= MAX_CUSTOM_FIELDS) return err(DomainError.validation(`A project can have up to ${MAX_CUSTOM_FIELDS} fields`));
  if (existing.some((f) => f.key === key)) return err(DomainError.validation("A field with this name already exists", { field: "label" }));

  const choices = (input.choices ?? []).map((c) => c.trim()).filter((c) => c !== "");
  if (input.type === "CHOICE") {
    if (choices.length < 2) return err(DomainError.validation("A list needs at least two choices", { field: "choices" }));
    if (choices.length > MAX_CHOICES) return err(DomainError.validation(`A list can have up to ${MAX_CHOICES} choices`, { field: "choices" }));
    if (new Set(choices).size !== choices.length) return err(DomainError.validation("Each choice must be different", { field: "choices" }));
  } else if (choices.length > 0) {
    return err(DomainError.validation("Only a choice field takes a list", { field: "choices" }));
  }
  return ok({ key, label, type: input.type, choices });
}

/**
 * The value a person typed for a field. Blank is `null` (never 0 and never an empty string). A number is written in its
 * plain form, a date must be a real day, and a choice must be one of the project's choices.
 */
export function checkCustomFieldValue(field: CustomFieldDefinition, raw: string | null | undefined): Result<string | null> {
  const value = (raw ?? "").trim();
  if (value === "") return ok(null);
  if (field.type === "TEXT") {
    if (value.length > MAX_TEXT_VALUE) return err(DomainError.validation(`Keep it to ${MAX_TEXT_VALUE} characters`, { field: field.key }));
    return ok(value);
  }
  if (field.type === "NUMBER") {
    if (!/^-?\d+(\.\d+)?$/.test(value)) return err(DomainError.validation(`${field.label} must be a number, or left blank`, { field: field.key }));
    return ok(String(Number(value)));
  }
  if (field.type === "DATE") {
    if (!isPlainDate(value as PlainDate)) return err(DomainError.validation(`${field.label} must be a date like 2026-11-04`, { field: field.key }));
    return ok(value);
  }
  if (!field.choices.includes(value)) return err(DomainError.validation(`Choose one of the listed options for ${field.label}`, { field: field.key }));
  return ok(value);
}
