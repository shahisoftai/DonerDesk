"use server";

import { requireSession } from "@/lib/server/auth-context";
import { gatewayRequest } from "@/lib/server/api-gateway";
import { EvidenceResponseSchema, ProjectsResponseSchema } from "@/lib/server/schemas";

export interface SearchHit { kind: "PROJECT" | "EVIDENCE"; id: string; title: string; detail: string; href: string }

/**
 * What the command palette finds as you type (plan F6): projects by title, code, donor or country, and evidence by its text.
 * Reads only what the person may already open (the same endpoints as the Projects and Evidence pages). Never throws.
 */
export async function searchWorkspaceAction(query: string): Promise<SearchHit[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  const ctx = await requireSession();
  const [projects, evidence] = await Promise.all([
    gatewayRequest("/v1/projects", ProjectsResponseSchema, ctx.token),
    gatewayRequest("/v1/evidence/search", EvidenceResponseSchema, ctx.token, { method: "POST", body: { query: q, page: 1, pageSize: 6 } }),
  ]);
  const needle = q.toLowerCase();
  const hits: SearchHit[] = [];
  if (projects.ok) {
    for (const p of projects.value.items) {
      const text = `${p.title} ${p.projectCode} ${p.donorName} ${p.country}`.toLowerCase();
      if (needle.split(/\s+/).every((w) => text.includes(w))) {
        hits.push({ kind: "PROJECT", id: p.id, title: p.title, detail: [p.projectCode, p.donorName, p.country].filter(Boolean).join(" · "), href: `/projects/${p.id}` });
      }
      if (hits.length >= 8) break;
    }
  }
  if (evidence.ok) {
    for (const e of evidence.value.items.slice(0, 6)) {
      hits.push({
        kind: "EVIDENCE",
        id: e.id,
        title: e.title || e.fileName,
        detail: e.fileName,
        href: e.projectId ? `/projects/${e.projectId}/evidence/${e.id}` : `/evidence?query=${encodeURIComponent(q)}`,
      });
    }
  }
  return hits;
}
