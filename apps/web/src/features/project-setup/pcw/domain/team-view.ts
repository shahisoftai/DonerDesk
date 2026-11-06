import type { DraftPerson } from "@donordesk/domain";
import type { SetupDraftView } from "../../../../lib/server/schemas-project-setup-draft.ts";

/** The roles a person can be given on a new project, in the order they are offered. An outside partner is a flag on the person, not a role. */
export const TEAM_ROLES = ["PROJECT_MANAGER", "ME_OFFICER", "GRANTS_OFFICER", "FIELD_OFFICER", "COMPLIANCE_OFFICER", "VIEWER"] as const;
export type TeamRole = (typeof TEAM_ROLES)[number];

export const ROLE_LABEL: Record<TeamRole, string> = {
  PROJECT_MANAGER: "Project manager",
  ME_OFFICER: "Monitoring and evaluation officer",
  GRANTS_OFFICER: "Grants officer",
  FIELD_OFFICER: "Field officer",
  COMPLIANCE_OFFICER: "Compliance officer",
  VIEWER: "Viewer",
};

export const roleLabel = (role: string): string => (role in ROLE_LABEL ? ROLE_LABEL[role as TeamRole] : role);

/** A draft key for a new person: readable, unique among the people already named. */
export function newPersonKey(team: readonly DraftPerson[], name: string): string {
  const base = `p-${name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "person"}`;
  let key = base;
  for (let n = 2; team.some((p) => p.key === key); n += 1) key = `${base}-${n}`;
  return key;
}

export interface PersonForm {
  name: string;
  email: string;
  role: string;
  external: boolean;
  invite: "NOW" | "LATER";
}

export const EMPTY_PERSON: PersonForm = { name: "", email: "", role: "FIELD_OFFICER", external: false, invite: "LATER" };

/** The operation that adds the person, or the one sentence that says why the form is not ready. */
export function addPersonOperation(team: readonly DraftPerson[], form: PersonForm): { ok: true; operation: unknown } | { ok: false; reason: string } {
  const name = form.name.trim();
  const email = form.email.trim();
  if (!name) return { ok: false, reason: "Give the person a name." };
  if (form.invite === "NOW" && !email) return { ok: false, reason: "To invite someone now, give an email address; otherwise choose to invite later." };
  return { ok: true, operation: { kind: "ADD_PERSON", person: { key: newPersonKey(team, name), name, email: email || null, role: form.role, external: form.external, invite: form.invite } } };
}

/** The facts a project needs before anything else, in the order the form shows them, with what each is called. */
export const FACT_FIELDS = [
  { key: "name", label: "Project name", kind: "text" },
  { key: "code", label: "Project code", kind: "text" },
  { key: "startDate", label: "Start date", kind: "date" },
  { key: "endDate", label: "End date", kind: "date" },
  { key: "currency", label: "Currency (for example USD)", kind: "text" },
  { key: "summary", label: "Short summary", kind: "area" },
] as const;
export type FactKey = (typeof FACT_FIELDS)[number]["key"];

/** Whether a typed value differs from what is stored, so a blur that changed nothing saves nothing. */
export function factChanged(view: SetupDraftView, key: FactKey, typed: string): boolean {
  return typed.trim() !== (view.facts[key] ?? "");
}

/** The edit that stores one fact; a currency is kept upper case. Clearing is an edit to null, never an empty string. */
export function factEdit(key: FactKey, typed: string): { area: "FACTS"; path: string; op: "EDIT"; value: string | null } {
  const value = typed.trim();
  return { area: "FACTS", path: `facts.${key}`, op: "EDIT", value: value === "" ? null : key === "currency" ? value.toUpperCase() : value };
}
