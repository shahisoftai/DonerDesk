import { test } from "node:test";
import assert from "node:assert/strict";
import type { OfflinePack } from "../../src/features/offline/domain/offline-pack.ts";
import { packFromServer } from "../../src/features/offline/domain/offline-pack.ts";
import { createPackLookup } from "../../src/features/record/adapters/pack-lookup.ts";
import { createPlaceCellSink } from "../../src/features/record/adapters/place-cell-sink.ts";
import { cellProblem, changedCells, filterPlaces, insidePlace, parsePlacePrefs, placeFirstAgenda } from "../../src/features/record/domain/place-first.ts";
import { RECORD_KINDS } from "../../src/features/record/domain/record-kinds.ts";
import { OUTBOX_KIND_NAMES } from "../../src/features/offline/domain/outbox-kinds.ts";
import { PLACE_CELLS_KIND, createPlaceCellsSender, placeCellsEntry } from "../../src/features/offline/domain/place-cells-outbox.ts";
import { badCells, liveTotal, pasteBlock, sheetChanges, sheetLevels, type PlaceSheetData } from "../../src/features/reporting/domain/place-sheet-view.ts";

const places = [
  { placeId: "d1", name: "Rabak", path: "Rabak › White Nile" },
  { placeId: "v1", name: "Kosti", path: "Kosti › Rabak › White Nile" },
  { placeId: "d2", name: "Kosti East", path: "Kosti East › White Nile" },
];
const indicators = [
  { id: "i1", code: "1.1", name: "Children screened", type: "NUMBER", disaggregationRequired: false },
  { id: "i2", code: "1.2", name: "Cure rate", type: "PERCENTAGE", disaggregationRequired: false },
];
const plan = [
  { id: "a", title: "Screening day", plannedStart: "2026-11-04", plannedEnd: "2026-11-04", status: "PLANNED", placeIds: ["v1"] },
  { id: "b", title: "Elsewhere", plannedStart: "2026-11-04", plannedEnd: "2026-11-04", status: "PLANNED", placeIds: ["d2"] },
  { id: "c", title: "Last month", plannedStart: "2026-10-04", plannedEnd: "2026-10-04", status: "PLANNED", placeIds: ["d1"] },
];

test("place-first: a place includes the places inside it (by path), never a namesake elsewhere", () => {
  assert.equal(insidePlace(places[0]!, { placeId: "v1" }, places), true);
  assert.equal(insidePlace(places[0]!, { placeId: "d2" }, places), false);
});

test("place-first agenda: planned work at the place in the period, the figures measured there, empty first", () => {
  const agenda = placeFirstAgenda({
    place: places[0]!, period: { id: "nov", startDate: "2026-11-01", endDate: "2026-11-30" }, places, indicators,
    indicatorPlaces: [{ indicatorId: "i1", scope: "LEVEL", level: 2 }, { indicatorId: "i2", scope: "LEVEL", level: 2 }],
    cells: [{ indicatorId: "i1", value: "40", locked: false }, { indicatorId: "i2", value: "", locked: false }],
    plan,
  });
  assert.deepEqual(agenda.activities.map((a) => a.id), ["a"]);
  assert.deepEqual(agenda.cells.map((c) => c.indicatorId), ["i2", "i1"]);
  assert.equal(agenda.cells.find((c) => c.indicatorId === "i2")!.adds, false);
});

test("place-first: only changed cells are sent, with the figure the person saw; a locked one never", () => {
  const cells = [
    { indicatorId: "i1", code: "1.1", name: "", type: "NUMBER", stored: "40", locked: false, adds: true },
    { indicatorId: "i3", code: "1.3", name: "", type: "NUMBER", stored: "5", locked: true, adds: true },
  ];
  assert.deepEqual(changedCells(cells, new Map([["i1", "40"]]), new Map()), []);
  assert.deepEqual(changedCells(cells, new Map([["i1", "1,200"], ["i3", "9"]]), new Map()), [{ indicatorId: "i1", value: "1200", expected: "40" }]);
});

test("place-first: an empty box is fine (not 0); a word is not a number; a split must add up", () => {
  assert.equal(cellProblem("", { type: "NUMBER" }), null);
  assert.equal(cellProblem("abc", { type: "NUMBER" })?.key, "placeEntry.notNumber");
  assert.equal(cellProblem("10", { type: "NUMBER" }, [{ dimension: "SEX", category: "F", value: "6" }, { dimension: "SEX", category: "M", value: "3" }])?.key, "placeEntry.splitMismatch");
  assert.equal(cellProblem("10", { type: "NUMBER" }, [{ dimension: "SEX", category: "F", value: "6" }, { dimension: "SEX", category: "M", value: "4" }]), null);
});

test("place-first: places are searched by any part of the path, the remembered one first; bad prefs read as none", () => {
  assert.deepEqual(filterPlaces(places, "kosti").map((p) => p.placeId), ["v1", "d2"]);
  assert.equal(filterPlaces(places, "", "d2")[0]!.placeId, "d2");
  assert.deepEqual(parsePlacePrefs("not json"), {});
  assert.deepEqual(parsePlacePrefs(JSON.stringify({ p1: "d1", p2: 5 })), { p1: "d1" });
});

test("pack v3: the lookup answers place entry and cells; a period the pack does not carry is null", async () => {
  const pack: OfflinePack = packFromServer({
    userId: "u", userName: "A", projectId: "p", projectName: "P", generatedAt: "2026-11-16T00:00:00Z", forms: [], places: [],
    indicators, periods: [{ id: "nov", reportType: "MONTHLY", startDate: "2026-11-01", endDate: "2026-11-30", status: "DRAFT" }], plan,
    entryPlaces: places, indicatorPlaces: [{ indicatorId: "i1", scope: "LEVEL", level: 2 }],
    placeCells: [{ periodId: "nov", indicatorId: "i1", placeId: "d1", value: "40", locked: false }],
  });
  assert.equal(pack.version, 3);
  const lookup = createPackLookup([pack]);
  assert.equal((await lookup.placeEntry("p"))?.places.length, 3);
  assert.deepEqual(await lookup.placeCells("p", "nov", "d1"), [{ indicatorId: "i1", value: "40", locked: false }]);
  assert.equal(await lookup.placeCells("p", "oct", "d1"), null);
  assert.equal(await createPackLookup([{ ...pack, version: 2, entryPlaces: undefined, indicatorPlaces: undefined } as OfflinePack]).placeEntry("p"), null);
});

test("the place kind is offered first, carried by its own outbox kind", () => {
  assert.equal(RECORD_KINDS[0]!.key, "PLACE");
  assert.ok((OUTBOX_KIND_NAMES as readonly string[]).includes(PLACE_CELLS_KIND));
  assert.equal(RECORD_KINDS[0]!.outboxKind, PLACE_CELLS_KIND);
});

test("the place sink: saved online, kept on the phone offline, a refusal shown and never queued", async () => {
  const queued: unknown[] = [];
  const make = (answer: { ok: true; value: { notices: string[] } } | { ok: false; error: { kind: string; message: string } }) => createPlaceCellSink({
    send: async () => answer as never, enqueue: async (e) => void queued.push(e), canQueue: true, newId: () => "id1", now: () => 1,
  });
  const input = { projectId: "p", periodId: "nov", title: "Rabak", cells: [{ indicatorId: "i1", placeId: "d1", value: "41", expected: "40" }] };
  assert.deepEqual(await make({ ok: true, value: { notices: [] } }).saveCells(input), { ok: true, value: { queued: false, notices: [] } });
  const off = await make({ ok: false, error: { kind: "unavailable", message: "offline" } }).saveCells(input);
  assert.equal(off.ok && off.value.queued, true);
  assert.equal(queued.length, 1);
  const refused = await make({ ok: false, error: { kind: "conflict", message: "Someone else has changed 1.1" } }).saveCells(input);
  assert.deepEqual(refused, { ok: false, message: "Someone else has changed 1.1" });
  assert.equal(queued.length, 1);
});

test("the place outbox sender: sent, kept waiting offline, parked on a refusal", async () => {
  const entry = placeCellsEntry({ id: "e", title: "Rabak", payload: { projectId: "p", periodId: "nov", cells: [{ indicatorId: "i1", placeId: "d1", value: "41" }] }, now: 1 });
  const send = (r: unknown) => createPlaceCellsSender({ save: async () => r as never })(entry, async () => undefined);
  assert.equal((await send({ ok: true, value: {} })).kind, "sent");
  assert.equal((await send({ ok: false, error: { kind: "unavailable", message: "x" } })).kind, "offline");
  assert.equal((await send({ ok: false, error: { kind: "conflict", message: "x" } })).kind, "rejected");
});

// ---- the By place sheet ----

const sheet: PlaceSheetData = {
  columns: [
    { indicatorId: "i1", code: "1.1", name: "Screened", type: "NUMBER", adds: true, lock: null, due: true },
    { indicatorId: "i2", code: "1.2", name: "Cure rate", type: "PERCENTAGE", adds: false, lock: null, due: true },
    { indicatorId: "i3", code: "1.3", name: "Verified", type: "NUMBER", adds: true, lock: "VERIFIED", due: true },
  ],
  rows: [{ placeId: "d1", name: "Rabak", path: "Rabak", level: 2 }, { placeId: "d2", name: "Kosti East", path: "Kosti East", level: 2 }, { placeId: "v1", name: "Kosti", path: "Kosti › Rabak", level: 4 }],
  cells: [
    [{ value: "40", state: "DRAFT", splits: [] }, { value: "", state: "EMPTY", splits: [] }, { value: "9", state: "VERIFIED", splits: [] }],
    [{ value: "", state: "EMPTY", splits: [] }, "NOT_MEASURED_HERE", { value: "1", state: "VERIFIED", splits: [] }],
    [{ value: "", state: "EMPTY", splits: [] }, { value: "", state: "EMPTY", splits: [] }, "NOT_MEASURED_HERE"],
  ],
  totals: ["40", null, "10"],
};

test("by place: a pasted Excel block fills right and down, skipping locked and not-measured cells", () => {
  const { edits, skipped } = pasteBlock(sheet, [0, 1, 2], { r: 0, c: 0 }, "41\t55\t3\n12\t60\n");
  assert.deepEqual([...edits], [["d1|i1", "41"], ["d1|i2", "55"], ["d2|i1", "12"]]);
  assert.equal(skipped, 2);
});

test("by place: only changes are sent; a word in a number column blocks; the total adds typed places, a rate has none", () => {
  const typed = new Map([["d1|i1", "40"], ["d2|i1", "12"], ["v1|i2", "x"]]);
  assert.deepEqual(sheetChanges(sheet, typed), [{ placeId: "d2", indicatorId: "i1", value: "12", expected: "" }, { placeId: "v1", indicatorId: "i2", value: "x", expected: "" }]);
  assert.deepEqual([...badCells(sheet, typed)], ["v1|i2"]);
  assert.equal(liveTotal(sheet, typed, 0), "52");
  assert.equal(liveTotal(sheet, typed, 1), null);
  assert.deepEqual(sheetLevels(sheet), [2, 4]);
});
