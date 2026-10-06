import { templateAppliesToReportType } from "./report-type-blueprints.js";

/**
 * Which template a new period of a given type starts from, decided in one place. A reviewed template written
 * for exactly that type wins (the most recently updated one, or the profile's default when it is among them);
 * otherwise the profile's default template, as before, when it may structure that type; otherwise none and the
 * built-in structure is used. Pure: the resolver supplies the candidates.
 */
export interface TemplateCandidate {
  id: string;
  reportType: string;
  status: string;
  updatedAt: Date;
}

export type DefaultTemplateSource = "TYPE_MATCH" | "PROFILE_DEFAULT" | "NONE";

export function pickDefaultTemplate(input: {
  reportType: string;
  profileDefaultId?: string;
  candidates: ReadonlyArray<TemplateCandidate>;
}): { templateId?: string; source: DefaultTemplateSource } {
  const exact = input.candidates.filter((c) => c.reportType === input.reportType && c.status === "REVIEWED");
  const preferred = exact.find((c) => c.id === input.profileDefaultId);
  if (preferred) return { templateId: preferred.id, source: "TYPE_MATCH" };
  const newest = [...exact].sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime() || a.id.localeCompare(b.id))[0];
  if (newest) return { templateId: newest.id, source: "TYPE_MATCH" };

  const profileDefault = input.candidates.find((c) => c.id === input.profileDefaultId);
  if (profileDefault && templateAppliesToReportType(input.reportType, profileDefault.reportType)) {
    return { templateId: profileDefault.id, source: "PROFILE_DEFAULT" };
  }
  return { source: "NONE" };
}

/** Every report type a period can have, for the places that show a default per type. */
export const ALL_REPORT_TYPES: ReadonlyArray<string> = ["MONTHLY", "QUARTERLY", "SEMI_ANNUAL", "ANNUAL", "FINAL", "ACTIVITY", "SITUATION", "CUSTOM"];
