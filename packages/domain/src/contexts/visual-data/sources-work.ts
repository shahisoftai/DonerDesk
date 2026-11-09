import type { DataSourceDef } from "./types.js";

/** The delivery side: the plan, completed activities, people reached, data collection, risks and tasks. */
export const WORK_SOURCES: readonly DataSourceDef[] = [
  {
    id: "plan", label: "Work plan", description: "Planned activities and milestones with their delivery state.",
    grain: "a planned activity", permission: "project.view", guest: true, reader: "ListWorkPlanHandler",
    joins: ["PROJECT", "PERIOD", "PLACE", "LOGFRAME_NODE", "PERSON"],
    fields: [
      { id: "activity", label: "Planned activity", meaning: "The work planned.", role: "DIMENSION", type: "TEXT" },
      { id: "delivery_state", label: "Delivery state", meaning: "On time, late, done or cancelled.", role: "DIMENSION", type: "STATUS" },
      { id: "planned_start", label: "Planned start", meaning: "The first planned day.", role: "DIMENSION", type: "DATE" },
      { id: "planned_end", label: "Planned end", meaning: "The last planned day.", role: "DIMENSION", type: "DATE", joinKey: "PERIOD" },
      { id: "activity_count", label: "Activities", meaning: "How many activities (milestones are counted apart).", role: "MEASURE", type: "COUNT", additive: true },
    ],
  },
  {
    id: "activities", label: "Completed activities", description: "Activities that were done and accepted, by day and place.",
    grain: "a completed activity", permission: "project.view", guest: true, reader: "DatasetExtrasService.activityDays",
    joins: ["PROJECT", "PERIOD", "PLACE", "LOGFRAME_NODE"],
    fields: [
      { id: "activity_date", label: "Day", meaning: "The day the activity started.", role: "DIMENSION", type: "DATE", joinKey: "PERIOD" },
      { id: "activity_place", label: "Where", meaning: "The place the activity took place.", role: "DIMENSION", type: "PLACE", joinKey: "PLACE" },
      { id: "done_count", label: "Activities done", meaning: "Accepted, not withdrawn activities.", role: "MEASURE", type: "COUNT", additive: true },
      { id: "participants", label: "Participants", meaning: "People counted at activities; may repeat across activities.", role: "MEASURE", type: "COUNT", additive: false },
    ],
  },
  {
    id: "reach", label: "People reached", description: "Registered people and their attendance; unique reach is never the sum of attendances.",
    grain: "a registered person or an attendance", permission: "project.view", guest: false, reader: "GetBeneficiariesHandler",
    joins: ["PROJECT", "PLACE", "PERIOD"],
    fields: [
      { id: "unique_registered", label: "Registered unique people", meaning: "People registered, counted once, by where they live.", role: "MEASURE", type: "COUNT", additive: false },
      { id: "attendances", label: "Attendances", meaning: "Times people attended, by where the activity was.", role: "MEASURE", type: "COUNT", additive: true },
      { id: "overall_unique", label: "Overall unique people", meaning: "People counted once across everything.", role: "MEASURE", type: "COUNT", additive: false },
      { id: "sex", label: "Sex", meaning: "As recorded.", role: "DIMENSION", type: "TEXT" },
      { id: "age_band", label: "Age band", meaning: "As recorded.", role: "DIMENSION", type: "TEXT" },
    ],
  },
  {
    id: "collection", label: "Collection records", description: "Records from forms, sheets and connectors; only accepted records feed figures.",
    grain: "an accepted record", permission: "indicator.update", guest: false, reader: "ListCollectionRecordsHandler",
    joins: ["PROJECT", "PERIOD", "PLACE", "INDICATOR"],
    fields: [
      { id: "form", label: "Form", meaning: "The form the record answers.", role: "DIMENSION", type: "TEXT" },
      { id: "record_status", label: "Record status", meaning: "Waiting, accepted or rejected.", role: "DIMENSION", type: "STATUS" },
      { id: "record_count", label: "Records", meaning: "How many records.", role: "MEASURE", type: "COUNT", additive: true },
    ],
  },
  {
    id: "risks", label: "Problems and risks", description: "Open and closed risks with seriousness and review dates.",
    grain: "a risk", permission: "project.view", guest: false, reader: "ListRisksHandler",
    joins: ["PROJECT", "PERSON"],
    fields: [
      { id: "risk_kind", label: "Kind", meaning: "Problem or risk.", role: "DIMENSION", type: "TEXT" },
      { id: "seriousness", label: "Seriousness", meaning: "As rated by the owner.", role: "DIMENSION", type: "STATUS" },
      { id: "risk_count", label: "Risks", meaning: "How many.", role: "MEASURE", type: "COUNT", additive: true },
    ],
  },
  {
    id: "tasks", label: "Requests and tasks", description: "What people were asked to do and whether it is done.",
    grain: "a request", permission: "team.view-work", guest: false, reader: "ListTeamWorkHandler",
    joins: ["PROJECT", "PERSON", "PERIOD"],
    fields: [
      { id: "task_state", label: "State", meaning: "Open, late or done.", role: "DIMENSION", type: "STATUS" },
      { id: "task_count", label: "Requests", meaning: "How many.", role: "MEASURE", type: "COUNT", additive: true },
    ],
  },
  {
    id: "evidence", label: "Evidence", description: "Counts and verification state of evidence files; never the content of a restricted file.",
    grain: "an evidence file", permission: "project.view", guest: false, reader: "SearchEvidenceHandler",
    joins: ["PROJECT", "PERIOD", "INDICATOR"],
    fields: [
      { id: "verification", label: "Verification", meaning: "Waiting, verified, needs correction or rejected.", role: "DIMENSION", type: "STATUS" },
      { id: "file_count", label: "Files", meaning: "How many files the person may open.", role: "MEASURE", type: "COUNT", additive: true },
    ],
  },
];
