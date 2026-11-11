"use client";

import { createContext, useContext, type ReactNode } from "react";

/**
 * Where the page's filter bar draws its slicers (Phase 50.3): the workspace provides the live slicers, and the filter bar block shows them
 * in its own place on the page. Outside a live workspace (a print, a share link with no choices) there is nothing to provide.
 */
const FilterSlot = createContext<ReactNode>(null);
export const FilterSlotProvider = FilterSlot.Provider;
export const useFilterSlot = (): ReactNode => useContext(FilterSlot);
