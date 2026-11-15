import Link from "next/link";
import { redirect } from "next/navigation";
import { requireSession, hasCapability } from "@/lib/server/auth-context";
import { gatewayRequest } from "@/lib/server/api-gateway";
import { PlaceListSchema, UnconfirmedLocationsSchema } from "@/lib/server/schemas-places";
import { DuplicatePlacesSchema } from "@/lib/server/schemas-place-tree";
import { InlineError } from "@/components/feedback/PageState";
import { SeedPlacesCard } from "@/features/places/presentation/SeedPlacesCard";
import { PlacesPanel } from "@/features/places/presentation/PlacesPanel";
import { DuplicatePlacesCard } from "@/features/places/presentation/where/DuplicatePlacesCard";
import { MapContextSchema } from "@/lib/server/schemas-map-context";
import { MapContextCard } from "@/features/maps/presentation/MapContextCard";

export const dynamic = "force-dynamic";

/**
 * Manage places (Phase 56; formerly Settings › Places): the administrator's housekeeping for the organisation's one place tree. Merge
 * duplicates, retire, import, fill from the built-in boundaries, facility types, boundary updates and map layers. Day-to-day choosing of
 * areas happens on each project's Where we work; nobody keeps this list up to date by hand.
 */
export default async function ManagePlacesPage() {
  const ctx = await requireSession();
  if (!hasCapability(ctx, "org.manage") && !hasCapability(ctx, "project.edit")) redirect("/where-we-work");
  const [list, unconfirmed, mapContext, dupes] = await Promise.all([
    gatewayRequest("/v1/places?includeArchived=true", PlaceListSchema, ctx.token),
    gatewayRequest("/v1/places/unconfirmed", UnconfirmedLocationsSchema, ctx.token),
    gatewayRequest("/v1/organization/map-context", MapContextSchema, ctx.token),
    hasCapability(ctx, "org.manage") ? gatewayRequest("/v1/places/duplicates", DuplicatePlacesSchema, ctx.token) : Promise.resolve(null),
  ]);
  if (!list.ok) return <InlineError title={list.error.message} referenceId={list.error.referenceId} />;
  const canEdit = list.value.canEdit && hasCapability(ctx, "project.edit");
  return (
    <div className="page-stack animate-fade-in">
      <div>
        <nav aria-label="Breadcrumb" className="text-sm text-slate-500"><Link className="link-quiet" href="/where-we-work">Where we work</Link> › Manage places</nav>
        <h1 className="page-title">Manage places</h1>
        <p className="mt-1 max-w-3xl text-sm text-slate-600 dark:text-slate-300">The organisation&apos;s one list of places, shared by every project. To choose where one project works, open the project and go to <b>Plan › Where we work</b>.</p>
      </div>
      {dupes && dupes.ok && <DuplicatePlacesCard data={dupes.value} />}
      {canEdit && <SeedPlacesCard />}
      <PlacesPanel places={list.value.places} canEdit={canEdit} unconfirmed={unconfirmed.ok ? unconfirmed.value : null} />
      {mapContext.ok && mapContext.value.canEdit && <MapContextCard initial={mapContext.value} />}
    </div>
  );
}
