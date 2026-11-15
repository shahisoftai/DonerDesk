import {
  DomainError, PLACE_LINK_RULES, checkRecordPlaces, err, extensionFor, inheritPlaces, insideFootprint, normalizeLocationKey, ok, resolvePlace,
  type PlaceLinkRecord, type PlaceTree, type RecordPlaceKind, type Result,
} from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { IAuditLogger, IClock, IIdGenerator } from "../../ports/core.js";
import type { IPlaceRepository } from "../../ports/places.js";
import type { IProjectRepository } from "../../ports/projects.js";
import type { IPlaceWordLinkRepository, IProjectAreaRepository, IProjectTypedLocations, IRecordPlaceOwnerReader, IRecordPlaceRepository, IRecordPlacesAfterCreate } from "../../ports/place-tree.js";
import type { VisibleProjects } from "../../services/visible-projects.js";
import { brief, can, loadTree, visibleProject, type PlaceBrief } from "./place-tree-support.js";

/**
 * The places a record points at (Phase 56): completed activities, files and people reached, through one handler whose rules come from
 * `PLACE_LINK_RULES`. A record with no places of its own shows its parent's (planned activity → activity → file/person), marked inherited.
 * Planned activities keep their own handler (the plan item's lead rules). Work outside the footprint is allowed and reported.
 */
export interface RecordPlacesDeps {
  projects: IProjectRepository;
  visible: VisibleProjects;
  places: IPlaceRepository;
  areas: IProjectAreaRepository;
  links: IRecordPlaceRepository;
  owners: IRecordPlaceOwnerReader;
  audit: IAuditLogger;
  clock: IClock;
}

export interface RecordPlaceView extends PlaceBrief {
  source: PlaceLinkRecord["source"];
  footprint: "INSIDE" | "OUTSIDE" | "NO_FOOTPRINT" | "UNKNOWN";
  extension?: { placeId: string; name: string; path: string };
}

export interface RecordPlacesView {
  places: RecordPlaceView[];
  /** True when the places shown come from the parent record (nothing chosen on this one yet). */
  inherited: boolean;
  typed: string | null;
  canEdit: boolean;
  /** From `PLACE_LINK_RULES`: several places allowed, and at most how many. */
  many: boolean;
  max: number;
}

async function ownedRecord(deps: RecordPlacesDeps, ctx: AuthenticatedContext, projectId: string, kind: RecordPlaceKind, recordId: string) {
  const project = await visibleProject(deps.projects, deps.visible, ctx, projectId);
  if (!project.ok) return project;
  const owner = await deps.owners.ownerOf(kind, recordId, ctx.tenant.tenantId);
  if (!owner.ok) return owner;
  if (!owner.value || owner.value.projectId !== projectId) return err(DomainError.notFound(PLACE_LINK_RULES[kind].noun, recordId));
  return ok(owner.value);
}

export class GetRecordPlacesHandler {
  constructor(private readonly deps: RecordPlacesDeps) {}

  async handle(ctx: AuthenticatedContext, projectId: string, kind: RecordPlaceKind, recordId: string): Promise<Result<RecordPlacesView, DomainError>> {
    const owner = await ownedRecord(this.deps, ctx, projectId, kind, recordId);
    if (!owner.ok) return owner;
    const [tree, areas, own] = await Promise.all([
      loadTree(this.deps.places, ctx), this.deps.areas.list(ctx.tenant.tenantId, projectId), this.deps.links.find(kind, recordId, ctx.tenant.tenantId),
    ]);
    if (!tree.ok) return tree;
    if (!areas.ok) return areas;
    if (!own.ok) return own;
    let parent: PlaceLinkRecord[] | null = null;
    const parentKind = PLACE_LINK_RULES[kind].inheritsFrom;
    if (own.value.length === 0 && parentKind && owner.value.parentId) {
      const p = await this.deps.links.find(parentKind, owner.value.parentId, ctx.tenant.tenantId);
      if (p.ok) parent = p.value;
    }
    const shown = inheritPlaces(kind, own.value, parent);
    const places = shown.flatMap((l) => {
      const b = brief(tree.value, l.placeId);
      if (!b) return [];
      const ext = extensionFor(b.id, areas.value, tree.value);
      return [{ ...b, source: l.source, footprint: insideFootprint(b.id, areas.value, tree.value).status, ...(ext ? { extension: ext } : {}) }];
    });
    const permission = PLACE_LINK_RULES[kind].permission;
    return ok({ places, inherited: own.value.length === 0 && places.length > 0, typed: owner.value.typed, canEdit: permission !== null && can(ctx, permission), many: PLACE_LINK_RULES[kind].many, max: PLACE_LINK_RULES[kind].max });
  }
}

export class SetRecordPlacesHandler {
  constructor(private readonly deps: RecordPlacesDeps) {}

  async handle(ctx: AuthenticatedContext, projectId: string, kind: RecordPlaceKind, recordId: string, input: { placeIds: string[] }): Promise<Result<{ outside: string[] }, DomainError>> {
    const permission = PLACE_LINK_RULES[kind].permission;
    if (!permission || !can(ctx, permission)) return err(DomainError.forbidden(`You cannot change where this ${PLACE_LINK_RULES[kind].noun} took place`));
    const owner = await ownedRecord(this.deps, ctx, projectId, kind, recordId);
    if (!owner.ok) return owner;
    const tree = await loadTree(this.deps.places, ctx);
    if (!tree.ok) return tree;
    const checked = checkRecordPlaces(kind, input.placeIds, tree.value);
    if (!checked.ok) return checked;
    const areas = await this.deps.areas.list(ctx.tenant.tenantId, projectId);
    if (!areas.ok) return areas;
    // An outside partner adds work only inside the project's areas (decided 2026-11-15); anyone else is told, never refused.
    const outside = checked.value.filter((id) => insideFootprint(id, areas.value, tree.value).status === "OUTSIDE");
    if (ctx.tenant.external && outside.length) return err(DomainError.validation("Choose places inside this project's areas"));
    const saved = await this.deps.links.replace(kind, { tenantId: ctx.tenant.tenantId.toString(), projectId, recordId, links: checked.value.map((placeId) => ({ placeId, source: "CHOSEN" as const })), userId: ctx.tenant.userId, now: this.deps.clock.now() });
    if (!saved.ok) return saved;
    await this.deps.audit.record({ tenantId: ctx.tenant.tenantId, actorId: ctx.tenant.userId, eventType: "place.record_places_set", entityType: kind.toLowerCase(), entityId: recordId, projectId, newValue: JSON.stringify(checked.value) });
    return ok({ outside });
  }
}

/**
 * After a record is created: the places chosen in its form (checked like any change of places), else its parent's, stored as INHERITED
 * (planned activity → completed activity → file). Never overwrites a choice; failing to store places never fails the create.
 */
export class RecordPlacesAfterCreate implements IRecordPlacesAfterCreate {
  constructor(private readonly setter: SetRecordPlacesHandler, private readonly links: IRecordPlaceRepository, private readonly clock: IClock) {}

  async afterCreate(ctx: AuthenticatedContext, input: { kind: RecordPlaceKind; projectId: string; recordId: string; parentId: string | null; placeIds?: readonly string[] }): Promise<void> {
    try {
      if (input.placeIds && input.placeIds.length) {
        await this.setter.handle(ctx, input.projectId, input.kind, input.recordId, { placeIds: [...input.placeIds] });
        return;
      }
      const parentKind = PLACE_LINK_RULES[input.kind].inheritsFrom;
      if (!parentKind || !input.parentId) return;
      const own = await this.links.find(input.kind, input.recordId, ctx.tenant.tenantId);
      if (!own.ok || own.value.length) return;
      const parent = await this.links.find(parentKind, input.parentId, ctx.tenant.tenantId);
      if (!parent.ok) return;
      const links = inheritPlaces(input.kind, [], parent.value);
      if (links.length) await this.links.replace(input.kind, { tenantId: ctx.tenant.tenantId.toString(), projectId: input.projectId, recordId: input.recordId, links, userId: ctx.tenant.userId, now: this.clock.now() });
    } catch { /* additive: the record stands without places */ }
  }
}

export interface ConfirmWordDeps extends RecordPlacesDeps {
  typed: IProjectTypedLocations;
  words: IPlaceWordLinkRepository;
  ids: IIdGenerator;
}

/** "This word means that place" for one project: every record carrying the word gets the link, and the word leaves "To confirm". */
export class ConfirmPlaceWordHandler {
  constructor(private readonly deps: ConfirmWordDeps) {}

  async handle(ctx: AuthenticatedContext, projectId: string, input: { word: string; placeId: string }): Promise<Result<{ linked: number }, DomainError>> {
    if (!can(ctx, "project.edit")) return err(DomainError.forbidden("You cannot confirm places"));
    const project = await visibleProject(this.deps.projects, this.deps.visible, ctx, projectId);
    if (!project.ok) return project;
    const word = normalizeLocationKey(input.word);
    if (!word) return err(DomainError.validation("Say which word to confirm", { field: "word" }));
    const tree = await loadTree(this.deps.places, ctx);
    if (!tree.ok) return tree;
    const placeId = tree.value.current(input.placeId);
    if (!placeId || !tree.value.isLive(placeId)) return err(DomainError.validation("Choose a place that is in your list", { field: "placeId" }));
    const typed = await this.deps.typed.typedIn(ctx.tenant.tenantId, projectId);
    if (!typed.ok) return typed;
    const now = this.deps.clock.now();
    let linked = 0;
    for (const t of typed.value) {
      if (t.kind === "INDICATOR_VALUE" || normalizeLocationKey(t.text) !== word) continue;
      const added = await this.deps.links.addIfMissing(t.kind, { tenantId: ctx.tenant.tenantId.toString(), projectId, recordId: t.recordId, placeId, source: "CONFIRMED", userId: ctx.tenant.userId, now });
      if (added.ok && added.value) linked += 1;
    }
    const entries = await this.deps.typed.linkIndicatorEntries(ctx.tenant.tenantId, projectId, word, placeId, normalizeLocationKey);
    if (entries.ok) linked += entries.value;
    const saved = await this.deps.words.upsert({ id: this.deps.ids.generate(), tenantId: ctx.tenant.tenantId.toString(), projectId, word, placeId, confirmedById: ctx.tenant.userId, confirmedAt: now });
    if (!saved.ok) return saved;
    await this.deps.audit.record({ tenantId: ctx.tenant.tenantId, actorId: ctx.tenant.userId, eventType: "place.word_confirmed", entityType: "project", entityId: projectId, projectId, newValue: JSON.stringify({ word, placeId, linked }) });
    return ok({ linked });
  }
}

/** Suggests what a typed word means inside the project (its areas first); never changes anything. Used by the inline picker. */
export function suggestForWord(text: string, tree: PlaceTree, areaIds: readonly string[]): string[] {
  const all = resolvePlace(text, tree.registry);
  if (all.status === "RESOLVED") return [all.place.id];
  if (all.status === "UNRESOLVED") return [];
  for (const a of areaIds) {
    const r = resolvePlace(text, tree.registry, { withinId: a });
    if (r.status === "RESOLVED") return [r.place.id];
  }
  return all.candidates.map((c) => c.id);
}
