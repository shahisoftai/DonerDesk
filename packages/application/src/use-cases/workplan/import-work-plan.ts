import { DomainError, PlaceRegistry, PlannedActivity, expandRecurrence, parseWorkPlanText, placesFromLocationText, resolvePlace, err, ok, type PlainDate, type Result } from "@donordesk/domain";
import type { ImportWorkPlanInput } from "@donordesk/contracts";
import type { AuthenticatedContext } from "../../context.js";
import type { IAuditLogger, IIdGenerator } from "../../ports/core.js";
import type { ILogframeRepository } from "../../ports/logframe.js";
import type { IMemberDirectory, IPlanContextReader, IPlannedActivityPlaceRepository, IPlannedActivityRepository } from "../../ports/workplan.js";
import type { IPlaceRepository } from "../../ports/places.js";
import { toRecord } from "../places/place-support.js";
import { PlanAccess } from "../../services/plan-access.js";

export interface ImportWorkPlanResult {
  applied: boolean;
  created: number;
  skipped: number;
  /** Activities linked to places from the list (a typed location is read as ;-separated place names). */
  withPlaces?: number;
  warnings: string[];
  /** Rows that need fixing. Any problem stops the whole import. */
  problems: string[];
  items: Array<{ id?: string; title: string; plannedStart: PlainDate; plannedEnd: PlainDate }>;
}

/** Work plan import: preview, then apply. A row that cannot be understood blocks all of it; exact repeats of existing rows are skipped. */
export class ImportWorkPlanHandler {
  constructor(
    private readonly ids: IIdGenerator, private readonly repo: IPlannedActivityRepository, private readonly context: IPlanContextReader,
    private readonly directory: IMemberDirectory, private readonly logframe: ILogframeRepository, private readonly audit: IAuditLogger,
    private readonly placeLinks?: IPlannedActivityPlaceRepository, private readonly placeList?: IPlaceRepository,
  ) {}

  async handle(ctx: AuthenticatedContext, projectId: string, input: ImportWorkPlanInput): Promise<Result<ImportWorkPlanResult, DomainError>> {
    const allowed = PlanAccess.requireManage(ctx);
    if (!allowed.ok) return allowed;
    const tenantId = ctx.tenant.tenantId;
    const parsed = parseWorkPlanText(input.text);
    const problems = [...parsed.problems];
    const [nodes, people, existing, dates] = await Promise.all([
      this.logframe.findByProject(projectId, tenantId), this.directory.activeUserIdsByEmail(projectId, tenantId),
      this.repo.findByProject(projectId, tenantId), this.context.projectDates(projectId, tenantId),
    ]);
    if (!nodes.ok) return nodes;
    if (!people.ok) return people;
    if (!existing.ok) return existing;
    if (!dates.ok) return dates;
    if (!dates.value) return err(DomainError.notFound("Project", projectId));

    const byCode = new Map(nodes.value.filter((n) => n.code).map((n) => [n.code!.toLowerCase(), n]));
    const known = new Set(existing.value.map((e) => `${e.title.toLowerCase()}|${e.plannedStart}|${e.plannedEnd}`));
    // Places from the list, so a typed location can also be linked (only when the places are wired).
    let registry: PlaceRegistry | null = null;
    if (this.placeLinks && this.placeList) {
      const listed = await this.placeList.list(tenantId, { includeArchived: false });
      if (listed.ok && listed.value.length > 0) registry = new PlaceRegistry(listed.value.map(toRecord));
    }
    const placesOf = new Map<string, string[]>(); // new activity id to the places its location names
    const warnings: string[] = [];
    const planned: PlannedActivity[] = [];
    const items: ImportWorkPlanResult["items"] = [];
    let skipped = 0;

    for (const row of parsed.rows) {
      const node = row.logframeCode ? byCode.get(row.logframeCode.toLowerCase()) : undefined;
      if (row.logframeCode && !node) { problems.push(`Row ${row.row}: no logframe item has the code ${row.logframeCode}.`); continue; }
      if (node && node.level !== "ACTIVITY" && node.level !== "OUTPUT") { problems.push(`Row ${row.row}: ${row.logframeCode} is not an output or an activity.`); continue; }
      const owner = row.leadEmail ? people.value.get(row.leadEmail) : undefined;
      if (row.leadEmail && !owner) { problems.push(`Row ${row.row}: ${row.leadEmail} is not an active member of this project.`); continue; }
      if (known.has(`${row.title.toLowerCase()}|${row.start}|${row.end}`)) { skipped += 1; warnings.push(`Row ${row.row}: ${row.title} is already planned for these dates.`); continue; }

      const recurrence = row.repeats ? { every: row.repeats, interval: 1, until: dates.value.end } : undefined;
      const occurrences = recurrence ? expandRecurrence(recurrence, { start: row.start, end: row.end }).occurrences : [{ start: row.start, end: row.end }];
      const seriesId = recurrence ? this.ids.generate() : undefined;
      for (const o of occurrences) {
        const created = PlannedActivity.create({
          id: this.ids.generate(), tenantId: tenantId.toString(), projectId, title: row.title, plannedStart: o.start, plannedEnd: o.end,
          createdById: ctx.tenant.userId, people: { ...(owner ? { ownerUserId: owner } : {}), supportUserIds: [] },
          ...(row.location ? { location: row.location } : {}),
          ...(node?.level === "ACTIVITY" ? { logframeActivityId: node.id, ...(node.parentId ? { outputId: node.parentId } : {}) } : {}),
          ...(node?.level === "OUTPUT" ? { outputId: node.id } : {}),
          ...(row.sessions !== undefined ? { targetCount: row.sessions } : {}),
          ...(seriesId ? { seriesId } : {}), ...(recurrence ? { recurrence } : {}),
        });
        if (!created.ok) { problems.push(`Row ${row.row}: ${created.error.message}.`); break; }
        planned.push(created.value);
        if (registry && row.location) {
          const named = placesFromLocationText(row.location, (part) => resolvePlace(part, registry!));
          if (named.placeIds.length > 0) placesOf.set(created.value.id, named.placeIds);
          if (o === occurrences[0]) for (const note of named.notes) warnings.push(`Row ${row.row}: ${note}.`);
        }
        items.push({ id: created.value.id, title: row.title, plannedStart: o.start, plannedEnd: o.end });
      }
    }

    if (problems.length > 0 && input.apply) {
      const shown = problems.slice(0, 5).join(" ");
      return err(DomainError.validation(`Nothing was imported: ${problems.length} ${problems.length === 1 ? "row needs" : "rows need"} fixing. ${shown}${problems.length > 5 ? " …" : ""}`, { problems }));
    }
    if (!input.apply || problems.length > 0) return ok({ applied: false, created: 0, skipped, warnings, problems, items: items.map(({ id: _id, ...rest }) => rest) });

    let withPlaces = 0;
    if (planned.length > 0) {
      const saved = await this.repo.createMany(planned);
      if (!saved.ok) return saved;
      if (this.placeLinks) {
        for (const [id, placeIds] of placesOf) {
          const linked = await this.placeLinks.replace({ tenantId: tenantId.toString(), projectId, plannedActivityId: id, placeIds, userId: ctx.tenant.userId, now: new Date() });
          if (linked.ok) withPlaces += 1;
        }
      }
      await this.audit.record({
        tenantId, actorId: ctx.tenant.userId, eventType: "workplan.imported", entityType: "project", entityId: projectId, projectId,
        systemNote: `${planned.length} planned activities imported${input.sourceName ? ` from ${input.sourceName}` : ""}`,
      });
    }
    return ok({ applied: true, created: planned.length, withPlaces, skipped, warnings, problems: [], items });
  }
}
