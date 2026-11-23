import type { Role } from "@/lib/shared/capabilities";
import { STAGE_KEYS, type ProjectStage, type ProjectStageKey } from "./project-stages.ts";
import { isRestrictedRole, tabsReachableBy } from "./role-project-pages.ts";

/**
 * Which of the project's stages each role sees in the bar (Phase 59, Phase 65). The others sit under "More" and stay one click away; a
 * page is never made unreachable, and the command palette and direct links still open it. One exhaustive table over `Role`: a new role
 * fails to compile until it has a row. The stage you are on is always in the bar.
 */
export const ROLE_PROJECT_STAGES: Readonly<Record<Role, readonly ProjectStageKey[]>> = {
  ADMIN: STAGE_KEYS,
  PROJECT_MANAGER: STAGE_KEYS,
  ME_OFFICER: STAGE_KEYS,
  GRANTS_OFFICER: ["home", "plan", "collect", "report", "finance"],
  COMPLIANCE_OFFICER: ["home", "collect", "report"],
  FIELD_OFFICER: ["home", "plan", "collect"],
  VIEWER: ["home", "plan", "review", "report"],
};

export interface StageBar { shown: ProjectStage[]; more: ProjectStage[] }

export function stagesFor(stages: readonly ProjectStage[], role: string | null | undefined, currentKey: string): StageBar {
  // A restricted role has no "More": a stage it cannot open anything in is not offered at all (Phase 63).
  if (isRestrictedRole(role)) return { shown: tabsReachableBy(role, stages), more: [] };
  const keys = (ROLE_PROJECT_STAGES[(role ?? "VIEWER") as Role] ?? ROLE_PROJECT_STAGES.VIEWER) as readonly string[];
  const shown = stages.filter((t) => keys.includes(t.key) || t.key === currentKey);
  return { shown, more: stages.filter((t) => !shown.includes(t)) };
}
