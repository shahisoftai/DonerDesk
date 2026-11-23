import type { FormFieldType } from "@donordesk/domain/contexts/collection/index.js";
import type { FieldView } from "../field-types";
import { CalculatedFieldView } from "./calculated-field";
import { GridFieldView } from "./grid-field";
import { MultiSelectFieldView } from "./multi-select-field";
import { RepeatFieldView } from "./repeat-field";
import { SignatureFieldView } from "./signature-field";
import { DateFieldView, FileFieldView, GpsFieldView, NumberFieldView, PlaceFieldView, SelectFieldView, TextFieldView, YesNoFieldView } from "./simple-fields";

/**
 * The one table of question views, typed over every field type so a type without a view does not compile. A heading or a note takes no
 * answer and has no view here: the filler draws those itself.
 */
export const FIELD_VIEWS: Readonly<Record<FormFieldType, FieldView | null>> = {
  NUMBER: NumberFieldView, TEXT: TextFieldView, DATE: DateFieldView, SELECT: SelectFieldView, YES_NO: YesNoFieldView, PLACE: PlaceFieldView, GPS: GpsFieldView, FILE: FileFieldView,
  MULTI_SELECT: MultiSelectFieldView, SIGNATURE: SignatureFieldView, REPEAT: RepeatFieldView, GRID: GridFieldView, CALCULATED: CalculatedFieldView,
  SECTION: null, NOTE: null,
};
