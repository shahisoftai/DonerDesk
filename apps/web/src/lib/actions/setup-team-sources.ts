"use server";

import { requireSession } from "@/lib/server/auth-context";
import { gatewayRequest } from "@/lib/server/api-gateway";
import { ProjectMembersResponseSchema, ProjectsResponseSchema, TeamResponseSchema } from "@/lib/server/schemas";
import type { Result } from "@/lib/shared/result";
import type { AppError } from "@/lib/shared/app-error";

/** Projects the person can see, to copy a team from. */
export async function listProjectsForTeamCopyAction(): Promise<Result<Array<{ id: string; name: string }>, AppError>> {
  const context = await requireSession();
  const r = await gatewayRequest("/v1/projects", ProjectsResponseSchema, context.token);
  return r.ok ? { ok: true, value: r.value.items.map((p) => ({ id: p.id, name: `${p.projectCode} · ${p.title}` })) } : r;
}

/** The active members of one project, with name and email, outside partners left out (they are added on purpose, not by copying). */
export async function getProjectTeamForCopyAction(projectId: string): Promise<Result<Array<{ name: string; email: string; role: string }>, AppError>> {
  const context = await requireSession();
  const [members, users] = await Promise.all([
    gatewayRequest(`/v1/projects/${encodeURIComponent(projectId)}/members`, ProjectMembersResponseSchema, context.token),
    gatewayRequest("/v1/users", TeamResponseSchema, context.token),
  ]);
  if (!members.ok) return members;
  if (!users.ok) return users;
  const byId = new Map(users.value.items.map((u) => [u.id, u]));
  return {
    ok: true,
    value: members.value.items.flatMap((m) => {
      const u = byId.get(m.userId);
      return m.status === "ACTIVE" && u && u.status === "ACTIVE" && !u.external ? [{ name: u.name, email: u.email, role: m.role }] : [];
    }),
  };
}
