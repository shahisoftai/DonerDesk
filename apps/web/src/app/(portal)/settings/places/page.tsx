import { requireSession, hasCapability } from "@/lib/server/auth-context";
import { gatewayRequest } from "@/lib/server/api-gateway";
import { PlaceListSchema, UnconfirmedLocationsSchema } from "@/lib/server/schemas-places";
import { InlineError } from "@/components/feedback/PageState";
import { SeedPlacesCard } from "@/features/places/presentation/SeedPlacesCard";
import { PlacesPanel } from "@/features/places/presentation/PlacesPanel";
import { PLACES_COPY } from "@/features/places/domain/places-copy";
import { MapContextSchema } from "@/lib/server/schemas-map-context";
import { MapContextCard } from "@/features/maps/presentation/MapContextCard";

export const dynamic = "force-dynamic";

export default async function PlacesPage() {
  const ctx = await requireSession();
  const [list, unconfirmed, mapContext] = await Promise.all([
    gatewayRequest("/v1/places?includeArchived=true", PlaceListSchema, ctx.token),
    gatewayRequest("/v1/places/unconfirmed", UnconfirmedLocationsSchema, ctx.token),
    gatewayRequest("/v1/organization/map-context", MapContextSchema, ctx.token),
  ]);
  if (!list.ok) {
    return (
      <div className="animate-fade-in">
        <h1 className="page-title">{PLACES_COPY.title}</h1>
        <div className="mt-6"><InlineError title={list.error.message} referenceId={list.error.referenceId} /></div>
      </div>
    );
  }
  return (
    <div className="animate-fade-in">
      <h1 className="page-title">{PLACES_COPY.title}</h1>
      <p className="mt-2 max-w-3xl text-sm text-slate-600 dark:text-slate-300">{PLACES_COPY.intro}</p>
      <p className="mt-2 max-w-3xl text-sm text-slate-600 dark:text-slate-300">This is the whole organisation&apos;s list. To choose where one project works, open the project and go to <strong>Data → Where we work</strong>, where you tick areas on a map.</p>
      {list.value.canEdit && hasCapability(ctx, "project.edit") && <SeedPlacesCard />}
      <PlacesPanel
        places={list.value.places}
        canEdit={list.value.canEdit && hasCapability(ctx, "project.edit")}
        unconfirmed={unconfirmed.ok ? unconfirmed.value : null}
      />
      {mapContext.ok && mapContext.value.canEdit && <MapContextCard initial={mapContext.value} />}
    </div>
  );
}
