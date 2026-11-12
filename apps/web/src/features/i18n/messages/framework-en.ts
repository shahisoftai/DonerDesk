/**
 * Text of the results framework and logframe screens (Phase 52): the donor wording picker, editing a result's logic, the two
 * lenses, the framework history and the reason box. Counts are written number-neutral ("…: {count}"), so no plural forms are needed.
 * The other languages are drafts until a native reader has checked them.
 */
export const frameworkEn = {
  "framework.wording.title": "Results framework wording",
  "framework.wording.help": "Choose the words your donor uses for the levels. Your results and indicators are not changed; only the words on screen and in downloaded files are.",
  "framework.wording.preset": "Donor wording",
  "framework.wording.custom": "My own words",
  "framework.wording.document": "Document name",
  "framework.wording.levelCalled": "The {level} level is called",
  "framework.wording.save": "Save wording",
  "framework.wording.saved": "Saved.",

  "framework.edit.open": "Edit",
  "framework.edit.close": "Close",
  "framework.edit.title": "Title",
  "framework.edit.description": "Description",
  "framework.edit.rationale": "Why this leads to the result above it",
  "framework.edit.rationaleHint": "The reasoning, in a sentence or two.",
  "framework.edit.assumptions": "Assumptions",
  "framework.edit.assumptionsHint": "What must hold for this result to lead to the one above it.",
  "framework.edit.save": "Save",
  "framework.edit.cancel": "Cancel",
  "framework.logic.summary": "Logic (optional)",
  "framework.node.why": "Why:",
  "framework.node.assumes": "Assumes:",

  "framework.view.label": "How to read the framework",
  "framework.view.edit": "Edit",
  "framework.view.RESULTS": "Results framework",
  "framework.view.LOGFRAME": "Logframe",
  "framework.download.word": "Download Word",
  "framework.download.pdf": "Download PDF",
  "framework.empty": "Nothing to show yet. Add results to the framework to see them here.",
  "framework.notSet": "Not set",

  "framework.col.level": "Level",
  "framework.col.resultCode": "Code",
  "framework.col.title": "Result",
  "framework.col.description": "Description",
  "framework.col.rationale": "Why this leads to the result above",
  "framework.col.assumptions": "Assumptions",
  "framework.col.code": "Indicator code",
  "framework.col.name": "Indicator",
  "framework.col.baseline": "Baseline",
  "framework.col.target": "Target",
  "framework.col.unit": "Unit",
  "framework.col.meansOfVerification": "Means of verification",
  "framework.col.dataSource": "Data source",
  "framework.col.frequency": "How often",

  "framework.history.structure": "Results or reasoning changed",
  "framework.history.measurement": "Measurement changed",
  "framework.history.signedOff": "Signed off {date}",
  "framework.history.pending": "Since the last sign-off: {summary}",
  "framework.history.pendingResults": "changes to the results or reasoning: {count}",
  "framework.history.pendingMeasures": "changes to the measurement: {count}",

  "framework.reason.label": "Why are you changing this? (optional)",
  "framework.reason.hint": "Needed when a report that has been approved used this indicator and you change its baseline or target. Kept with the framework's history.",

  "framework.risk.result": "Which result does it affect? (optional)",
  "framework.risk.none": "None in particular",
} as const;
