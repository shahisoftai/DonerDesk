import "server-only";
import { gatewayRequest } from "@/lib/server/api-gateway";
import { ProjectPeopleResponseSchema } from "@/lib/server/schemas";
import type { ProjectPerson } from "../domain/ask-people";

/** The active members of a project with their roles ("(you)" for the current person). One read for every page that picks a person. */
export async function loadProjectPeople(token: string, projectId: string, currentUserId: string): Promise<ProjectPerson[]> {
  const r = await gatewayRequest(`/v1/projects/${encodeURIComponent(projectId)}/people`, ProjectPeopleResponseSchema, token);
  if (!r.ok) return [];
  return r.value.items.map((p) => ({ id: p.userId, label: p.userId === currentUserId ? `${p.name} (you)` : p.name, role: p.role }));
}
