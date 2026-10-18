/**
 * Who can be asked for what: only people whose role lets them do the thing (the server refuses anyone else), with the
 * subject's own lead first. The rule is the domain's own (`TASK_KINDS[kind].requires` checked with `Permissions`), not a copy of it.
 */
import { Permissions } from "@donordesk/domain/policies/permissions.js";
import { TASK_KINDS, type TaskKind } from "@donordesk/domain/contexts/tasks/index.js";
import type { Role } from "../../../lib/shared/capabilities.ts";

export type AskKind = TaskKind;

export interface ProjectPerson { id: string; label: string; role: string }

export function canDo(kind: AskKind, role: string): boolean {
  return Permissions.can(role as Role, TASK_KINDS[kind].requires);
}

export function peopleFor(kind: AskKind, people: ReadonlyArray<ProjectPerson>, leadId?: string): ProjectPerson[] {
  return people
    .filter((p) => canDo(kind, p.role))
    .sort((a, b) => Number(b.id === leadId) - Number(a.id === leadId) || a.label.localeCompare(b.label));
}
