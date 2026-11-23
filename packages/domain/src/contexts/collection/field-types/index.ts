import type { FormFieldType } from "../form-model.js";
import { CHOICE_FIELD_TYPES } from "./choice.js";
import type { FieldTypeDef } from "./contract.js";
import { NESTED_FIELD_TYPES } from "./nested.js";
import { SIMPLE_FIELD_TYPES } from "./simple.js";
import { STRUCTURE_FIELD_TYPES } from "./structure.js";

/** The one table of field types. Typed over every `FormFieldType`, so a type without a row does not compile. */
export const FIELD_TYPE_DEFS: Readonly<Record<FormFieldType, FieldTypeDef>> = {
  ...SIMPLE_FIELD_TYPES, ...CHOICE_FIELD_TYPES, ...NESTED_FIELD_TYPES, ...STRUCTURE_FIELD_TYPES,
};

export type { FieldTypeDef, FieldCtx, DefinitionCtx, FieldOutcome } from "./contract.js";
