import type { KitBlock, KitColumn, KitWellField } from "../model.js";

/** Small writers so a kit data file reads as content. */
export const column = (role: string, label: string, kind: KitColumn["kind"], semantic: KitColumn["semantic"], group: string, aliases: readonly string[], extra: Partial<KitColumn> = {}): KitColumn => ({ role, label, kind, semantic, group, aliases, ...extra });
export const count = (role: string, label: string, group: string, aliases: readonly string[], extra: Partial<KitColumn> = {}): KitColumn => column(role, label, "COUNT", "NONE", group, aliases, extra);
export const f = (role: string, aggregate?: KitWellField["aggregate"]): KitWellField => ({ role, ...(aggregate ? { aggregate } : {}) });
export const bars = (title: string, axis: string, values: KitWellField[], extra: Partial<KitBlock> = {}): KitBlock => ({ type: "VISUAL", family: "BAR", title, w: 6, h: 4, wells: { AXIS: [f(axis)], VALUES: values }, ...extra });
export const line = (title: string, axis: string, values: KitWellField[], extra: Partial<KitBlock> = {}): KitBlock => ({ type: "VISUAL", family: "LINE", title, w: 6, h: 4, wells: { AXIS: [f(axis)], VALUES: values }, ...extra });
export const card = (title: string, values: KitWellField[], w = 3): KitBlock => ({ type: "VISUAL", family: "CARD", title, w, h: 2, wells: { VALUES: values } });
export const pie = (title: string, slices: string, value: string): KitBlock => ({ type: "VISUAL", family: "PIE", title, w: 4, h: 4, wells: { AXIS: [f(slices)], VALUES: [f(value)] } });
export const table = (title: string, rows: string[], values: KitWellField[], extra: Partial<KitBlock> = {}): KitBlock => ({ type: "VISUAL", family: "TABLE", title, w: 12, h: 5, wells: { ROWS: rows.map((r) => f(r)), VALUES: values }, ...extra });
export const map = (title: string, place: string, colour: KitWellField, w = 6): KitBlock => ({ type: "VISUAL", family: "MAP", title, w, h: 5, wells: { LOCATION: [f(place)], COLOUR: [colour] } });
export const slicer = (title: string, columnRole: string): KitBlock => ({ type: "SLICER", title, w: 4, h: 2, roles: { column: columnRole } });
export const note = (text: string): KitBlock => ({ type: "TEXT", text, w: 12, h: 1 });

/** Received, used and balance (and optionally opening) columns for one supply item, with the balance check. */
export function supplyColumns(item: string, label: string, aliasRoots: readonly string[], unit: string, opening = false): KitColumn[] {
  const a = (suffixes: readonly string[]) => aliasRoots.flatMap((r) => suffixes.map((s) => `${r}${s}`));
  const cols = [
    count(`${item}_received`, `${label} received`, "Supplies", a([" received", "r", " recu", " reçu", " recibido", "_received", " in"]), { unit }),
    count(`${item}_used`, `${label} used`, "Supplies", a([" used", "u", " distributed", " consumed", " utilise", " utilisé", " utilizado", "_used", " out"]), { unit }),
    column(`${item}_balance`, `${label} balance`, "NUMBER", "NONE", "Supplies", a([" balance", "b", " closing", " closing balance", " stock", " solde", " saldo", "_balance"]), { unit, note: "A level on the last day: never added across months." }),
  ];
  if (opening) cols.unshift(column(`${item}_opening`, `${label} opening balance`, "NUMBER", "NONE", "Supplies", a([" opening", " opening balance", "o", " solde initial", " saldo inicial"]), { unit }));
  return cols;
}
