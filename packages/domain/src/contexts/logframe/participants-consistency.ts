/**
 * Non-blocking hints about participant counts. They never stop a save and never reach the report
 * writer; people attend more than one activity, so a gap is a prompt to check, not an error.
 */
export interface ParticipantFacts {
  participantsTotal?: number | undefined;
  participantsMale?: number | undefined;
  participantsFemale?: number | undefined;
  participantsChildren?: number | undefined;
  participantsDisability?: number | undefined;
}

export interface ConsistencyHint {
  code: "SEX_SPLIT_EXCEEDS_TOTAL" | "SEX_SPLIT_BELOW_TOTAL" | "SUBGROUP_EXCEEDS_TOTAL" | "ACTIVITIES_EXCEED_INDICATOR" | "ACTIVITIES_BELOW_INDICATOR";
  message: string;
}

const isNum = (n: number | undefined): n is number => typeof n === "number" && Number.isFinite(n);

/** Checks a single record: male + female against the total, and children / disability against the total. */
export function recordParticipantHints(p: ParticipantFacts): ConsistencyHint[] {
  const hints: ConsistencyHint[] = [];
  if (!isNum(p.participantsTotal)) return hints;
  const total = p.participantsTotal;
  if (isNum(p.participantsMale) && isNum(p.participantsFemale)) {
    const split = p.participantsMale + p.participantsFemale;
    if (split > total) hints.push({ code: "SEX_SPLIT_EXCEEDS_TOTAL", message: `Male (${p.participantsMale}) plus female (${p.participantsFemale}) is ${split}, more than the total of ${total}.` });
    else if (split < total) hints.push({ code: "SEX_SPLIT_BELOW_TOTAL", message: `Male plus female is ${split}, below the total of ${total}. If other participants are not counted by sex, ignore this.` });
  }
  for (const [label, n] of [["Children", p.participantsChildren], ["Participants with a disability", p.participantsDisability]] as const) {
    if (isNum(n) && n > total) hints.push({ code: "SUBGROUP_EXCEEDS_TOTAL", message: `${label} (${n}) is more than the total of ${total}.` });
  }
  return hints;
}

const PEOPLE_WORDS = /(people|persons?|participants?|beneficiar|individuals?|children|students?|pupils?|learners?|women|men|girls?|boys?|households?)/i;

/** An indicator counts people when its name or unit says so. */
export function indicatorCountsPeople(indicator: { name: string; unit?: string | undefined; type?: string | undefined }): boolean {
  if (indicator.type && indicator.type !== "NUMBER") return false;
  return PEOPLE_WORDS.test(`${indicator.name} ${indicator.unit ?? ""}`);
}

export interface IndicatorParticipantHintInput {
  indicator: { name: string; unit?: string | undefined; type?: string | undefined };
  /** The value reported for the period (a number as typed), if any. */
  reportedValue: string | undefined;
  /** Participant totals of the accepted activities linked to the indicator in the period. */
  activityTotals: ReadonlyArray<number | undefined>;
  /** Relative gap that is worth a hint (default 5 %). */
  tolerance?: number;
}

/** Compares the people counted in linked activities with the people the indicator reports. */
export function indicatorParticipantHint(input: IndicatorParticipantHintInput): ConsistencyHint | undefined {
  if (!indicatorCountsPeople(input.indicator)) return undefined;
  const reported = Number(String(input.reportedValue ?? "").replace(/,/g, "").trim());
  if (!input.reportedValue || !Number.isFinite(reported)) return undefined;
  const totals = input.activityTotals.filter(isNum);
  if (totals.length === 0) return undefined;
  const sum = totals.reduce((a, b) => a + b, 0);
  const tolerance = input.tolerance ?? 0.05;
  const base = Math.max(reported, sum, 1);
  if (Math.abs(sum - reported) / base <= tolerance) return undefined;
  return {
    code: sum > reported ? "ACTIVITIES_EXCEED_INDICATOR" : "ACTIVITIES_BELOW_INDICATOR",
    message: `Linked activities record ${sum} participants; the indicator says ${reported}. People may attend more than one activity, so this may be fine.`,
  };
}
