/** Blocks whose content is written by a person (Phase 45.1): the model is the cleaned text, and a block with none says so instead of drawing a placeholder. */
import { designPeriods, latestById, type CanvasFacts } from "../facts.js";
import { normalizeLocationKey } from "../../workplan/location-key.js";
import { empty, ready, unavailable, NO_FACTS, type SectionProps } from "./props.js";

const trimmed = (s: string | undefined): string => (s ?? "").trim();

export const keyMessagesModel = (p: SectionProps) => {
  const messages = (p.messages ?? []).filter((m) => trimmed(m.text)).map((m) => ({ text: trimmed(m.text), ...(m.iconId ? { iconId: m.iconId } : {}) }));
  return messages.length === 0 ? empty("Add three to five key messages.") : ready({ messages }, messages.length > 5 ? ["More than five messages is a lot to read."] : []);
};

export const quoteModel = (p: SectionProps) => (trimmed(p.text) ? ready({ text: trimmed(p.text), ...(p.assetId ? { assetId: p.assetId } : {}), ...(trimmed(p.attribution) ? { attribution: trimmed(p.attribution) } : {}), consentConfirmed: p.consentConfirmed === true }, p.consentConfirmed === true ? [] : ["The person quoted has not confirmed they agreed to appear."]) : empty("Add the quote."));

/** The notes a person wrote, and where the figures come from (periods and indicator codes the design covers); the source line is worked out here once so print and screen word it from the same facts. */
export const legendNotesModel = (p: SectionProps, facts: CanvasFacts | undefined) => {
  const notes = (p.notes ?? []).map(trimmed).filter(Boolean);
  if (!facts) return notes.length === 0 ? empty("No notes.") : ready({ notes, source: null });
  const periods = designPeriods(facts).map((id) => facts.sheet.periods.find((x) => x.id === id)?.label).filter((x): x is string => Boolean(x));
  const codes = facts.sheet.indicators.map((i) => i.code);
  return ready({ notes, source: { periods: periods.length ? { first: periods[0] as string, last: periods[periods.length - 1] as string, count: periods.length } : null, indicators: codes.length ? { first: codes[0] as string, last: codes[codes.length - 1] as string, count: codes.length } : null } });
};

export const bannerModel = (p: SectionProps, facts?: CanvasFacts) => {
  const message = trimmed(p.text ?? p.title ?? facts?.acknowledgement);
  return message ? ready({ message }) : empty("Add a line of text.");
};

export const imageModel = (p: SectionProps) => {
  if (!p.assetId) return empty("Choose an image.");
  return ready({ assetId: p.assetId, fit: p.fit ?? "COVER", ...(trimmed(p.caption) ? { caption: trimmed(p.caption) } : {}), ...(trimmed(p.credit) ? { credit: trimmed(p.credit) } : {}), ...(trimmed(p.altText) ? { altText: trimmed(p.altText) } : {}), consentConfirmed: p.consentConfirmed === true },
    [...(trimmed(p.altText) ? [] : ["The image has no description for people who cannot see it."]), ...(p.consentConfirmed === true ? [] : ["Consent of the people shown is not confirmed."])]);
};

export const timelineModel = (p: SectionProps) => {
  const events = (p.events ?? []).filter((e) => trimmed(e.label) && trimmed(e.date)).map((e) => ({ date: e.date, label: trimmed(e.label), ...(trimmed(e.detail) ? { detail: trimmed(e.detail) } : {}) }));
  return events.length === 0 ? empty("Add dated events.") : ready({ events });
};

const MAX_PLACES = 10;
const placeKey = (place: string): string => normalizeLocationKey(place) || place.toLowerCase();

/** The matrix: who does what, and a column per place (grouped by the one location normalizer, in the order first named, shown as most often typed). */
export const threeWModel = (p: SectionProps) => {
  const rows = (p.presence ?? []).filter((r) => trimmed(r.who) && trimmed(r.what)).map((r) => ({ who: trimmed(r.who), what: trimmed(r.what), where: r.where.map(trimmed).filter(Boolean) }));
  if (rows.length === 0) return empty("Add who does what, where.");
  const columns = new Map<string, { names: Map<string, number>; count: number }>();
  for (const row of rows) for (const place of row.where) {
    const entry = columns.get(placeKey(place)) ?? { names: new Map<string, number>(), count: 0 };
    entry.names.set(place, (entry.names.get(place) ?? 0) + 1);
    entry.count += 1;
    columns.set(placeKey(place), entry);
  }
  const places = [...columns.entries()].slice(0, MAX_PLACES).map(([key, v]) => ({ key, name: [...v.names.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? key, count: v.count }));
  const source = trimmed(p.caption);
  return ready({
    rows: rows.map((r) => ({ who: r.who, what: r.what, placeKeys: [...new Set(r.where.map(placeKey))] })),
    places, partners: new Set(rows.map((r) => r.who.toLowerCase())).size, source,
  }, [...(source ? [] : ["Name the source of this table."]), ...(columns.size > places.length ? [`Showing the first ${MAX_PLACES} of ${columns.size} places.`] : [])]);
};

export const sectorGridModel = (p: SectionProps, facts: CanvasFacts | undefined) => {
  const sectors = p.sectors ?? [];
  if (sectors.length === 0) return empty("Add sectors and choose their indicators.");
  if (!facts) return unavailable(NO_FACTS);
  return ready({
    sectors: sectors.map((s) => ({ label: s.label, ...(s.iconId ? { iconId: s.iconId } : {}), indicators: s.indicatorIds.map((id) => { const f = latestById(facts, id); return f ? { code: f.code, name: f.name, text: f.value, amount: f.number, unit: f.unit ?? "", percent: f.percent, target: f.targetNumber, verified: f.verified } : null; }) })),
  });
};
