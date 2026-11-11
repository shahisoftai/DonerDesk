/**
 * The filter pane's choice in two shapes (Phase 50.3): the canvas's `CrossFilter` (what the server reads) and the bar's
 * `FilterSelection` (what goes in the page address). Pure, both ways, so the address and the screen cannot disagree.
 */
import { NO_FILTER, type CrossFilter, type FilterSelection } from "@donordesk/domain/contexts/canvas/index.js";

export function toSelection(f: CrossFilter): FilterSelection {
  const s: FilterSelection = {};
  if (f.periodId) s.PERIOD = [f.periodId];
  if (f.places.length) s.PLACE = [...f.places].sort();
  if (f.status) s.STATUS = [f.status];
  if (f.donors?.length) s.DONOR = [...f.donors].sort();
  if (f.partners?.length) s.PARTNER = [...f.partners].sort();
  return s;
}

export function fromSelection(s: FilterSelection, base: CrossFilter = NO_FILTER): CrossFilter {
  return { ...base, periodId: s.PERIOD?.[0] ?? "", places: s.PLACE ?? [], status: s.STATUS?.[0] ?? "", donors: s.DONOR ?? [], partners: s.PARTNER ?? [] };
}
