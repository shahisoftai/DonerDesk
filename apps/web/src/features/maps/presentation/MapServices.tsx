"use client";

import { createContext, useContext } from "react";
import { createMapServices, type MapServices } from "../composition";

const MapServicesContext = createContext<MapServices | null>(null);
export const MapServicesProvider = MapServicesContext.Provider;

let shared: MapServices | undefined;

/** The services a map screen uses: the ones a test or a parent provided, else the real ones (built once). */
export function useMapServices(): MapServices {
  return useContext(MapServicesContext) ?? (shared ??= createMapServices());
}
