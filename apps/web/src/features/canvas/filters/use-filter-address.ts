"use client";

import { useEffect, useRef } from "react";
import { decodeFilterSelection, encodeFilterSelection, type CrossFilter } from "@donordesk/domain/contexts/canvas/index.js";
import { fromSelection, toSelection } from "./selection-bridge";

/**
 * Keeps the filter choice in the page address (`?f=`, Phase 50.3), so a filtered view can be shared or bookmarked and Back works as
 * expected. Read once when the page opens; written (replacing, not pushing) whenever the choice changes. Never stored in the canvas.
 */
export function useFilterAddress(filters: CrossFilter, setFilters: (f: CrossFilter) => void): void {
  const read = useRef(false);
  useEffect(() => {
    if (read.current) return;
    read.current = true;
    const text = new URLSearchParams(window.location.search).get("f");
    if (text) setFilters(fromSelection(decodeFilterSelection(text), filters));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (!read.current) return;
    const url = new URL(window.location.href);
    const enc = encodeFilterSelection(toSelection(filters));
    if (enc) url.searchParams.set("f", enc); else url.searchParams.delete("f");
    if (url.href !== window.location.href) window.history.replaceState(window.history.state, "", url.href);
  }, [filters]);
}
