import { requireSession } from "@/lib/server/auth-context";
import { gatewayRequest } from "@/lib/server/api-gateway";
import { PlanFieldValuesSchema, ProjectBudgetSchema, WorkPlanResponseSchema } from "@/lib/server/schemas";
import { loadProjectPeople } from "@/features/tasks/application/project-people";
import { decodeSessionPayload } from "@/lib/shared/jwt-session";
import { planCsv } from "@/features/workplan/domain/plan-export";

export const dynamic = "force-dynamic";

/** The project's work plan as a spreadsheet (CSV), with the project's own fields. Only what the person can already see. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const { id } = await params;
  const ctx = await requireSession();
  const [plan, fields, budget, people] = await Promise.all([
    gatewayRequest(`/v1/projects/${encodeURIComponent(id)}/work-plan`, WorkPlanResponseSchema, ctx.token),
    gatewayRequest(`/v1/projects/${encodeURIComponent(id)}/plan-field-values`, PlanFieldValuesSchema, ctx.token),
    gatewayRequest(`/v1/projects/${encodeURIComponent(id)}/budget`, ProjectBudgetSchema, ctx.token),
    loadProjectPeople(ctx.token, id, decodeSessionPayload(ctx.token)?.sub ?? ""),
  ]);
  if (!plan.ok) return new Response(plan.error.message, { status: 502, headers: { "content-type": "text/plain; charset=utf-8" } });
  const names = Object.fromEntries(people.map((p) => [p.id, p.label.replace(/ \(you\)$/, "")]));
  const csv = planCsv({
    rows: plan.value.items,
    fields: fields.ok ? fields.value.fields : [],
    values: fields.ok ? fields.value.values : {},
    names,
    budget: budget.ok ? budget.value.items : [],
  });
  return new Response(`﻿${csv}`, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="work-plan-${id.slice(0, 8)}.csv"`,
      "cache-control": "no-store",
    },
  });
}
