import { DomainError, err, ok, placeListToCsv, placeListToGeoJson, placeResultsToCsv, placeResultsToGeoJson, type AdminLevel, type PlaceResultRow, type Result } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { IAuditLogger } from "../../ports/core.js";
import type { ListPlacesHandler } from "./place-handlers.js";
import type { GetProjectPlaceResultsHandler } from "./place-results.js";

export type GeoFileFormat = "geojson" | "csv";
export interface GeoFile { fileName: string; contentType: string; body: string; /** Rows with a value that a GeoJSON file could not place (no pin): the screen says so. */ unpinned: number }

const TYPES: Record<GeoFileFormat, string> = { geojson: "application/geo+json", csv: "text/csv; charset=utf-8" };
const safeName = (s: string): string => s.replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "export";

/**
 * Files out of the places list and the results by place (Phase 49.5). They hold what the person can already read through the same handlers
 * (visibility, finance and partner rules are theirs, not repeated here). Every download is audited with counts only.
 */
export class ExportPlacesHandler {
  constructor(private readonly list: ListPlacesHandler, private readonly audit: IAuditLogger) {}

  async handle(ctx: AuthenticatedContext, format: GeoFileFormat): Promise<Result<GeoFile, DomainError>> {
    const r = await this.list.handle(ctx);
    if (!r.ok) return r;
    const out = format === "csv" ? { text: placeListToCsv(r.value.places), unpinned: 0 } : placeListToGeoJson(r.value.places);
    await this.audit.record({ tenantId: ctx.tenant.tenantId, actorId: ctx.tenant.userId, eventType: "place.exported", entityType: "place", entityId: "all", newValue: JSON.stringify({ format, places: r.value.places.length }) });
    return ok({ fileName: `places.${format}`, contentType: TYPES[format], body: out.text, unpinned: out.unpinned });
  }
}

export class ExportPlaceResultsHandler {
  constructor(private readonly results: GetProjectPlaceResultsHandler, private readonly list: ListPlacesHandler, private readonly audit: IAuditLogger) {}

  async handle(ctx: AuthenticatedContext, projectId: string, input: { level: AdminLevel; indicatorId: string; periodId?: string; format: GeoFileFormat }): Promise<Result<GeoFile, DomainError>> {
    const [r, places] = await Promise.all([this.results.handle(ctx, projectId, input.level, input.periodId ? { periodId: input.periodId } : {}), this.list.handle(ctx)]);
    if (!r.ok) return r;
    if (!places.ok) return places;
    const indicator = r.value.indicators.find((i) => i.id === input.indicatorId);
    if (!indicator) return err(DomainError.notFound("That indicator has no results by place in this project"));
    const byId = new Map(places.value.places.map((p) => [p.id, p]));
    const period = input.periodId ? r.value.periods.find((p) => p.id === input.periodId)?.label ?? "" : "Life of the project";
    const rows: PlaceResultRow[] = indicator.rollup.rows.map((row) => {
      const place = byId.get(row.placeId);
      const value = row.value === null || row.value === "" ? null : Number(row.value);
      return {
        placeId: row.placeId, name: row.name, path: row.path, code: place?.code, latitude: place?.latitude, longitude: place?.longitude,
        value: value !== null && Number.isFinite(value) ? value : null, verified: row.verified, period,
      };
    });
    const label = `${indicator.code} ${indicator.name}${indicator.unit ? ` (${indicator.unit})` : ""}`.trim();
    const out = input.format === "csv" ? { text: placeResultsToCsv(rows, label), unpinned: 0 } : placeResultsToGeoJson(rows, label);
    await this.audit.record({ tenantId: ctx.tenant.tenantId, actorId: ctx.tenant.userId, eventType: "place_results.exported", entityType: "project", entityId: projectId, newValue: JSON.stringify({ format: input.format, level: input.level, rows: rows.length }) });
    return ok({ fileName: `${safeName(indicator.code || indicator.name)}-by-place.${input.format}`, contentType: TYPES[input.format], body: out.text, unpinned: out.unpinned });
  }
}
