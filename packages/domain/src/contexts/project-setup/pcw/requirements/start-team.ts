/** Requirements of slides 1 (Start) and 2 (Project and team). */
import type { RequirementDef } from "../requirement.js";
import type { SetupDraft } from "../draft.js";
import { MET, isLive, open, present } from "./shared.js";

const chosen = (key: string, field: "donor" | "sector" | "country", steps: number[]): RequirementDef => ({
  key, slide: "START", coversSteps: steps, allowsNotUsed: false,
  check: (d) => (present(d.extras.start[field]) ? MET : open(`${field}Missing`)),
});

const hasRole = (d: SetupDraft, role: string): boolean => d.extras.team.some((p) => p.role === role);

export const START_REQUIREMENTS: readonly RequirementDef[] = [
  chosen("start.donor", "donor", [13]),
  chosen("start.sector", "sector", [43]),
  chosen("start.country", "country", [13]),
];

export const TEAM_REQUIREMENTS: readonly RequirementDef[] = [
  {
    key: "project.facts", slide: "PROJECT_TEAM", coversSteps: [1, 2], allowsNotUsed: false,
    check: (d) => {
      const f = d.proposal.facts;
      const missing = (["name", "code", "startDate", "endDate", "currency"] as const).filter((k) => !isLive(f[k]));
      if (missing.length > 0) return open("factsMissing", { count: missing.length, first: missing[0]! }, missing[0]);
      const start = f.startDate.value as string;
      const end = f.endDate.value as string;
      return end > start ? MET : open("datesOrder", {}, "endDate");
    },
  },
  {
    key: "project.manager", slide: "PROJECT_TEAM", coversSteps: [3], allowsNotUsed: false,
    check: (d) => (hasRole(d, "PROJECT_MANAGER") ? MET : open("managerMissing")),
  },
  {
    key: "project.me", slide: "PROJECT_TEAM", coversSteps: [3], allowsNotUsed: false,
    check: (d) => (hasRole(d, "ME_OFFICER") ? MET : open("meMissing")),
  },
  {
    // "No outside partners" is an answer.
    key: "project.partners", slide: "PROJECT_TEAM", coversSteps: [4], allowsNotUsed: true,
    check: (d) => (d.extras.team.some((p) => p.external) ? MET : open("partnersMissing")),
  },
];
