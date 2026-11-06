import { requireSession, hasCapability } from "@/lib/server/auth-context";
import { gatewayRequest } from "@/lib/server/api-gateway";
import { PlaceListSchema, UnconfirmedLocationsSchema } from "@/lib/server/schemas-places";
import { InlineError } from "@/components/feedback/PageState";
import { SeedPlacesCard } from "@/features/places/presentation/SeedPlacesCard";
import { PlacesPanel } from "@/features/places/presentation/PlacesPanel";
import { PLACES_COPY } from "@/features/places/domain/places-copy";

export const dynamic = "force-dynamic";

export default async function PlacesPage() {
  const ctx = await requireSession();
  const [list, unconfirmed] = await Promise.all([
    gatewayRequest("/v1/places?includeArchived=true", PlaceListSchema, ctx.token),
    gatewayRequest("/v1/places/unconfirmed", UnconfirmedLocationsSchema, ctx.token),
  ]);
  if (!list.ok) {
    return (
      <div className="animate-fade-in">
        <h1 className="text-xl font-semibold tracking-tight">{PLACES_COPY.title}</h1>
        <div className="mt-6"><InlineError title={list.error.message} referenceId={list.error.referenceId} /></div>
      </div>
    );
  }
  return (
    <div className="animate-fade-in">
      <h1 className="text-xl font-semibold tracking-tight">{PLACES_COPY.title}</h1>
      <p className="mt-2 max-w-3xl text-sm text-slate-600 dark:text-slate-300">{PLACES_COPY.intro}</p>
      {list.value.canEdit && hasCapability(ctx, "project.edit") && <SeedPlacesCard />}
      <PlacesPanel
        places={list.value.places}
        canEdit={list.value.canEdit && hasCapability(ctx, "project.edit")}
        unconfirmed={unconfirmed.ok ? unconfirmed.value : null}
      />
    </div>
  );
}
