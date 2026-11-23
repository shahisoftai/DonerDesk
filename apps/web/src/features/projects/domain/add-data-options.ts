/**
 * The ways to add data to a project (Phase 65): the one table behind the Collect stage's "Add data" page. A way is a row: what it is for,
 * the page that does it, the capability it needs. It adds no write path of its own: each way opens the screen that already owns the job.
 * Pure: no React.
 */
import type { ProjectFact } from "./project-stages";

export interface AddDataOption {
  id: string;
  /** English title and one line on when to use it (translated through `uiLabel`). */
  title: string;
  when: string;
  /** Path under `/projects/<id>`. */
  path: string;
  /** The person needs ANY of these. */
  anyOf: readonly string[];
  /** Offered only when the project has this. */
  onlyWhen?: ProjectFact;
}

export const ADD_DATA_OPTIONS: readonly AddDataOption[] = [
  { id: "NUMBERS", title: "Type numbers", when: "Enter this period's indicator values, one row each.", path: "/enter", anyOf: ["indicator.update"] },
  { id: "FORM", title: "Fill a form", when: "A survey or assessment someone designed for this project.", path: "/forms", anyOf: ["collection.submit"], onlyWhen: "FORMS" },
  { id: "ACTIVITY", title: "Record an activity", when: "Work that was done: a training, a distribution, a visit.", path: "/activities/new", anyOf: ["activity.create"] },
  { id: "FILES", title: "Upload photos or files", when: "Proof of the work: a photo, a signed list, a report.", path: "/evidence/new", anyOf: ["evidence.upload"] },
  { id: "SPREADSHEET", title: "Bring in a spreadsheet", when: "You already keep the figures, activities or files in Excel or Sheets.", path: "/import", anyOf: ["project.edit", "indicator.update", "activity.create"] },
  { id: "PEOPLE", title: "Register people reached", when: "Who took part, with where they live.", path: "/beneficiaries", anyOf: ["activity.create", "project.edit"] },
  { id: "DATASETS", title: "Open a data file", when: "A table that belongs to this project, such as a survey export.", path: "/datasets", anyOf: ["project.edit", "indicator.update", "results.view"], onlyWhen: "DATASETS" },
];

/** The ways this person may use here, in table order. */
export function addDataOptionsFor(input: { capabilities: ReadonlySet<string>; facts: ReadonlySet<ProjectFact>; reachable?: (path: string) => boolean }): AddDataOption[] {
  return ADD_DATA_OPTIONS.filter((o) => o.anyOf.some((c) => input.capabilities.has(c)) && (!o.onlyWhen || input.facts.has(o.onlyWhen)) && (input.reachable?.(o.path) ?? true));
}
