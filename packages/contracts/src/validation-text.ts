/**
 * Plain-language text for a failed request body. One place knows how a field path and a validator message become a
 * sentence a person can act on ("Main needs: each line may be up to 200 characters"), so the API title and the
 * web form errors never show a bare "scope: String must contain at most 200 character(s)".
 */

export interface ValidationIssueLike {
  path: ReadonlyArray<string | number>;
  message: string;
  code?: string;
}

/** Field labels, most specific path first. A row is matched by the path with numeric segments removed. */
const FIELD_LABELS: ReadonlyArray<readonly [string, string]> = [
  ["timeZone", "Time zone"],
  ["scope.affectedPopulation.group", "Affected population: who"],
  ["scope.affectedPopulation.figure", "Affected population: figure"],
  ["scope.affectedPopulation.source", "Affected population: source"],
  ["scope.affectedPopulation", "Affected population"],
  ["scope.needs", "Main needs (one per line)"],
  ["scope.summary", "Situation summary"],
  ["scope.eventName", "Event / situation"],
  ["scope.situationDate", "Situation date"],
  ["scope.location", "Location / affected area"],
  ["scope.title", "Report title"],
  ["scope.purpose", "Purpose"],
  ["scope.activityIds", "Activities"],
  ["startDate", "Start date"],
  ["endDate", "End date"],
  ["deadline", "Donor deadline"],
  ["internalReviewDeadline", "Internal review deadline"],
  ["plannedStart", "Start date"],
  ["plannedEnd", "End date"],
  ["ownerUserId", "Lead"],
  ["supportUserIds", "Other people helping"],
  ["logframeActivityId", "Logframe activity"],
  ["latitude", "Latitude"],
  ["longitude", "Longitude"],
  ["plannedActivityId", "Planned activity"],
  ["targetParticipants", "People expected"],
  ["targetCount", "Number of sessions"],
  ["repeats.until", "Repeats until"],
  ["repeats", "Repeats"],
  ["reason", "Why?"],
  ["rows.plannedStart", "Start date"],
  ["rows.plannedEnd", "End date"],
  ["rows.ownerUserId", "Lead"],
  ["rows.logframeActivityId", "Logframe activity"],
  ["assigneeId", "Who"],
  ["dueDate", "By when"],
  ["note", "Note"],
  ["subjectId", "What it is about"],
  ["reportingPeriodId", "Reporting period"],
  ["userId", "Person"],
  ["title", "What"],
];

const humanise = (segment: string): string => {
  const spaced = segment.replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/[_-]+/g, " ").trim().toLowerCase();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
};

/** The label of a *known* field path, if there is one. */
export function knownFieldLabel(path: ReadonlyArray<string | number>): string | undefined {
  const key = path.filter((s): s is string => typeof s === "string").join(".");
  return FIELD_LABELS.find(([prefix]) => key === prefix || key.startsWith(`${prefix}.`))?.[1];
}

/** The label of the field a path points at: the known label, else the last segment in words. */
export function fieldLabelForPath(path: ReadonlyArray<string | number>): string {
  const known = knownFieldLabel(path);
  if (known) return known;
  const last = [...path].reverse().find((s): s is string => typeof s === "string");
  return last ? humanise(last) : "";
}

/** A validator message as a sentence. Unknown messages are returned unchanged. */
export function friendlyIssueMessage(message: string): string {
  const most = /^String must contain at most (\d+) character\(s\)$/.exec(message);
  if (most) return `can be up to ${most[1]} characters; shorten it or split it across lines`;
  const least = /^String must contain at least (\d+) character\(s\)$/.exec(message);
  if (least) return Number(least[1]) <= 1 ? "is required" : `needs at least ${least[1]} characters`;
  const items = /^Array must contain at most (\d+) element\(s\)$/.exec(message);
  if (items) return `can have up to ${items[1]} entries`;
  return message;
}

/**
 * One sentence per issue. A known field is named by its label ("Main needs (one per line): can be up to 200
 * characters…"); any other field keeps its path and message so existing API clients see what they always saw.
 */
export function describeValidationIssue(issue: ValidationIssueLike): string {
  const known = knownFieldLabel(issue.path);
  if (known) return `${known}: ${friendlyIssueMessage(issue.message)}`;
  const path = issue.path.join(".");
  const message = friendlyIssueMessage(issue.message);
  return path ? `${path}: ${message}` : message;
}
