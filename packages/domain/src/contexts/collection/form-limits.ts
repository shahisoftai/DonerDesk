/** The limits of a form, in one place. A form over any of them is refused with a sentence, never cut silently. */
export const FORM_LIMITS = {
  fields: 600,
  sections: 60,
  options: 100,
  repeatFields: 40,
  repeatRows: 100,
  gridRows: 120,
  gridColumns: 12,
  constraints: 100,
  formulaLength: 400,
} as const;
