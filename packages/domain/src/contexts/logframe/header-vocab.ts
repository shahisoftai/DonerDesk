/**
 * Header vocabulary of the Indicators sheet of the import templates. Shared by
 * the indicator parser (column mapping) and the logframe parser (sheet
 * boundary detection) so the two can never drift apart.
 */

export const INDICATOR_CODE_HEADERS: ReadonlyArray<string> = ["code", "indicatorcode", "indicatortode"];
export const INDICATOR_NAME_HEADERS: ReadonlyArray<string> = ["name", "indicator", "indicatorname", "indicatorstatement"];
export const INDICATOR_TYPE_HEADERS: ReadonlyArray<string> = ["type", "indicatortype", "indicatorstype"];
export const INDICATOR_BASELINE_HEADERS: ReadonlyArray<string> = ["baseline", "baselinevalue"];
export const INDICATOR_TARGET_HEADERS: ReadonlyArray<string> = ["target", "targetvalue"];
export const INDICATOR_UNIT_HEADERS: ReadonlyArray<string> = ["unit", "unitofmeasure"];
export const INDICATOR_MOV_HEADERS: ReadonlyArray<string> = ["meansofverification", "meansofverificationmov", "mov"];
export const INDICATOR_DATA_SOURCE_HEADERS: ReadonlyArray<string> = ["datasource", "source", "sourcedata"];
export const INDICATOR_FREQUENCY_HEADERS: ReadonlyArray<string> = ["frequency", "reportingfrequency"];
export const INDICATOR_DISAGG_HEADERS: ReadonlyArray<string> = ["disaggregationrequired", "disaggregated"];

export const INDICATOR_SHEET_HEADERS: ReadonlyArray<string> = [
  ...INDICATOR_CODE_HEADERS,
  ...INDICATOR_NAME_HEADERS,
  ...INDICATOR_TYPE_HEADERS,
  ...INDICATOR_BASELINE_HEADERS,
  ...INDICATOR_TARGET_HEADERS,
  ...INDICATOR_UNIT_HEADERS,
  ...INDICATOR_MOV_HEADERS,
  ...INDICATOR_DATA_SOURCE_HEADERS,
  ...INDICATOR_FREQUENCY_HEADERS,
  ...INDICATOR_DISAGG_HEADERS,
];
