"use client";

import { createContext, useContext, type ReactNode } from "react";
import { assetUrl as signedInUrl } from "../domain/media";

/** Where a picture is shown from. A signed-in page reads the organisation's library; a page a link opens reads it through the link, so a visitor with no session sees the pictures that canvas names and no others. */
const AssetUrlContext = createContext<(assetId: string) => string>(signedInUrl);

export const useAssetUrl = (): ((assetId: string) => string) => useContext(AssetUrlContext);
export const linkAssetUrl = (token: string) => (assetId: string): string => `/api/shared/canvas/${encodeURIComponent(token)}/assets/${encodeURIComponent(assetId)}`;
export function AssetUrlProvider({ value, children }: { value: (assetId: string) => string; children: ReactNode }) {
  return <AssetUrlContext.Provider value={value}>{children}</AssetUrlContext.Provider>;
}
