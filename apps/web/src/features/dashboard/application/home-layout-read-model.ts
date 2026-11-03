import { gatewayRequest } from "@/lib/server/api-gateway";
import { HomeLayoutResponseSchema } from "@/lib/server/schemas-home-layout";
import type { HomeVariant } from "@/features/navigation/domain/role-navigation";

export interface SavedHomeLayout { readonly layout: unknown; readonly version: string | null }

/** The person's saved layout, or nothing. A failed read is "no saved layout": Home must always open, with the default arrangement. */
export async function loadHomeLayout(token: string, variant: HomeVariant): Promise<SavedHomeLayout> {
  const r = await gatewayRequest(`/v1/home-layout?variant=${encodeURIComponent(variant)}`, HomeLayoutResponseSchema, token);
  return r.ok ? { layout: r.value.layout, version: r.value.updatedAt } : { layout: null, version: null };
}
