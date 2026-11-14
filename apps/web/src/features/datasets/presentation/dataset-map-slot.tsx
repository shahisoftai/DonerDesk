"use client";

import { createContext, useContext, type ComponentType } from "react";
import type { DatasetMap } from "@donordesk/domain/contexts/canvas/index.js";

/**
 * How a dataset visual draws a map (Phase 54): the canvas pages provide the Maps explorer through this slot, so the screen registry never
 * imports the map engine (or its server actions). Without a provider the places are shown as a ranked list.
 */
export type DatasetMapComponent = ComponentType<{ map: DatasetMap; projectId: string | undefined }>;
const Slot = createContext<DatasetMapComponent | null>(null);
export const DatasetMapProvider = Slot.Provider;
export const useDatasetMap = (): DatasetMapComponent | null => useContext(Slot);
