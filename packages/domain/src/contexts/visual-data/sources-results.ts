import type { DataSourceDef } from "./types.js";

/** The results side: indicators, their values and targets, the framework, periods and where results happened. */
export const RESULTS_SOURCES: readonly DataSourceDef[] = [
  {
    id: "indicator-values", label: "Indicator values", description: "What was recorded for each indicator in each reporting period, with targets and status.",
    grain: "an indicator in a period", permission: "project.view", guest: true, reader: "GetProjectDataSheetHandler",
    joins: ["PROJECT", "PERIOD", "INDICATOR", "LOGFRAME_NODE", "SECTOR"],
    fields: [
      { id: "indicator", label: "Indicator", meaning: "The indicator measured.", role: "DIMENSION", type: "TEXT", joinKey: "INDICATOR" },
      { id: "period", label: "Reporting period", meaning: "The period the value belongs to.", role: "DIMENSION", type: "DATE", joinKey: "PERIOD" },
      { id: "level", label: "Result level", meaning: "Goal, outcome, output or activity.", role: "DIMENSION", type: "TEXT", joinKey: "LOGFRAME_NODE" },
      { id: "status", label: "Value status", meaning: "Draft, handed in, verified, returned or not applicable.", role: "DIMENSION", type: "STATUS" },
      { id: "period_value", label: "Value this period", meaning: "What was recorded for the period.", role: "MEASURE", type: "COUNT", additive: true },
      { id: "cumulative", label: "Cumulative to date", meaning: "The running figure to the end of the period.", role: "MEASURE", type: "COUNT", additive: true },
      { id: "life_of_project", label: "Life of project", meaning: "The figure for the whole project to date, by the indicator's own aggregation.", role: "MEASURE", type: "COUNT", additive: true },
      { id: "target", label: "Target", meaning: "The scheduled cumulative target, or the final target.", role: "MEASURE", type: "COUNT", additive: true },
      { id: "baseline", label: "Baseline", meaning: "The starting figure.", role: "MEASURE", type: "COUNT", additive: true },
      { id: "percent_of_target", label: "Percent of target", meaning: "Cumulative figure against the target; never shown for a rate.", role: "MEASURE", type: "RATE" },
      { id: "rate_value", label: "Rate or ratio", meaning: "A percentage or ratio indicator's own value, shown as recorded and never added up.", role: "MEASURE", type: "RATE" },
    ],
  },
  {
    id: "disaggregation", label: "Breakdowns", description: "A period value split by a recorded group (sex, age, disability, location).",
    grain: "a group of a period value", permission: "project.view", guest: true, reader: "GetProjectDataSheetHandler",
    joins: ["PROJECT", "PERIOD", "INDICATOR", "PLACE"],
    fields: [
      { id: "indicator", label: "Indicator", meaning: "The indicator the split belongs to.", role: "DIMENSION", type: "TEXT", joinKey: "INDICATOR" },
      { id: "period", label: "Reporting period", meaning: "The period the split belongs to.", role: "DIMENSION", type: "DATE", joinKey: "PERIOD" },
      { id: "dimension", label: "Group type", meaning: "What the split is by: sex, age band, disability, location.", role: "DIMENSION", type: "TEXT" },
      { id: "category", label: "Group", meaning: "The category inside the split.", role: "DIMENSION", type: "TEXT" },
      { id: "group_value", label: "Value for the group", meaning: "What was recorded for the group; the total is the recorded total, never the sum of groups.", role: "MEASURE", type: "COUNT", additive: false },
    ],
  },
  {
    id: "logframe", label: "Results framework", description: "The goal, outcomes, outputs and activities and how they nest.",
    grain: "a framework node", permission: "project.view", guest: true, reader: "ListLogframeHandler",
    joins: ["PROJECT", "LOGFRAME_NODE", "INDICATOR"],
    fields: [
      { id: "node", label: "Result", meaning: "A goal, outcome, output or activity.", role: "DIMENSION", type: "TEXT", joinKey: "LOGFRAME_NODE" },
      { id: "node_level", label: "Level", meaning: "Where the node sits in the framework.", role: "DIMENSION", type: "TEXT" },
      { id: "indicator_count", label: "Indicators", meaning: "How many indicators measure the node.", role: "MEASURE", type: "COUNT", additive: true },
    ],
  },
  {
    id: "periods", label: "Reporting periods", description: "The reporting calendar and where each report stands.",
    grain: "a reporting period", permission: "project.view", guest: false, reader: "ListReportingPeriodsHandler",
    joins: ["PROJECT", "PERIOD"],
    fields: [
      { id: "period_label", label: "Period", meaning: "The period's name.", role: "DIMENSION", type: "DATE", joinKey: "PERIOD" },
      { id: "report_status", label: "Report status", meaning: "Not started, drafted, in review, approved or submitted.", role: "DIMENSION", type: "STATUS" },
      { id: "entry_window", label: "Entry window", meaning: "Whether values may still be entered.", role: "DIMENSION", type: "FLAG" },
    ],
  },
  {
    id: "results-by-place", label: "Results by place", description: "An indicator's value at each level of the place tree, with partly-reported marks.",
    grain: "an indicator at a place", permission: "project.view", guest: true, reader: "GetProjectPlaceResultsHandler",
    joins: ["PROJECT", "PERIOD", "INDICATOR", "PLACE"],
    fields: [
      { id: "place", label: "Place", meaning: "A country, area or site.", role: "DIMENSION", type: "PLACE", joinKey: "PLACE" },
      { id: "place_level", label: "Place level", meaning: "Country, first-level area, district or site.", role: "DIMENSION", type: "TEXT" },
      { id: "place_value", label: "Value at the place", meaning: "Counts add up the tree; a rate is shown for the place that recorded it and never combined.", role: "MEASURE", type: "COUNT", additive: true },
    ],
  },
];
