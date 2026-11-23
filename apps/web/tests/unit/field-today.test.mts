import test from "node:test";
import assert from "node:assert/strict";
import { buildToday, dueOf, firstName, partOfDay, weekGroups } from "../../src/features/offline/domain/field-today.ts";
import type { OfflinePack } from "../../src/features/offline/domain/offline-pack.ts";

const TODAY = "2026-11-24";
const pack = (over: Partial<OfflinePack> = {}): OfflinePack => ({
  version: 4, userId: "u", userName: "Pasha Piracha", projectId: "p1", projectName: "KP assessment", generatedAt: 0,
  forms: [{ id: "f1", name: "Health facility assessment", fields: [] }],
  places: [{ id: "a", name: "Chakdara", path: "Dir Lower › K.P." }, { id: "b", name: "Madyan", path: "Swat › K.P." }, { id: "c", name: "Puran", path: "Shangla › K.P." }],
  assignments: [], plan: [], ...over,
});

test("the greeting follows the hour and a name is its first word", () => {
  assert.equal(partOfDay(5), "MORNING"); assert.equal(partOfDay(11), "MORNING");
  assert.equal(partOfDay(12), "AFTERNOON"); assert.equal(partOfDay(16), "AFTERNOON");
  assert.equal(partOfDay(17), "EVENING"); assert.equal(partOfDay(21), "EVENING");
  assert.equal(partOfDay(22), "HELLO"); assert.equal(partOfDay(3), "HELLO");
  assert.equal(firstName("Pasha Piracha"), "Pasha"); assert.equal(firstName("  Ali  "), "Ali"); assert.equal(firstName(""), ""); assert.equal(firstName(undefined), "");
});

test("a due day is described by how far off it is", () => {
  assert.deepEqual(dueOf("2026-11-22", TODAY), { kind: "OVERDUE", days: 2 });
  assert.deepEqual(dueOf(TODAY, TODAY), { kind: "TODAY", days: 0 });
  assert.deepEqual(dueOf("2026-11-25", TODAY), { kind: "TOMORROW", days: 1 });
  assert.deepEqual(dueOf("2026-11-28", TODAY), { kind: "SOON", days: 4 });
  assert.deepEqual(dueOf("2026-12-01", TODAY), { kind: "SOON", days: 7 });
  assert.deepEqual(dueOf("2026-12-02", TODAY), { kind: "LATER", days: 8 });
  assert.deepEqual(dueOf(undefined, TODAY), { kind: "NONE", days: 0 });
  assert.deepEqual(dueOf("soon", TODAY), { kind: "NONE", days: 0 });
  assert.deepEqual(dueOf("2027-01-01", "2026-12-31"), { kind: "TOMORROW", days: 1 }, "across a year end");
});

test("visits: started first, then late, then today, then the earliest due; a visit with no date is last", () => {
  const v = buildToday([pack({ assignments: [
    { id: "1", formId: "f1", placeId: "a", status: "TO_DO", dueOn: "2026-11-30" },
    { id: "2", formId: "f1", placeId: "b", status: "TO_DO" },
    { id: "3", formId: "f1", placeId: "c", status: "IN_PROGRESS", dueOn: "2026-12-05" },
    { id: "4", formId: "f1", placeId: "a", status: "TO_DO", dueOn: "2026-11-20" },
    { id: "5", formId: "f1", placeId: "b", status: "TO_DO", dueOn: TODAY },
  ] })], TODAY);
  assert.deepEqual(v.visits.map((x) => x.id), ["3", "4", "5", "1", "2"]);
  assert.equal(v.visits[0]!.started, true);
  assert.deepEqual(v.summary, { visits: 5, started: 1, overdue: 1, today: 1 });
  assert.equal(v.visits[0]!.placeName, "Puran");
});

test("a visit for a form or place that is not on the phone is left out, never shown broken", () => {
  const v = buildToday([pack({ assignments: [{ id: "1", formId: "gone", placeId: "a", status: "TO_DO" }, { id: "2", formId: "f1", placeId: "gone", status: "TO_DO" }, { id: "3", formId: "f1", placeId: "a", status: "TO_DO" }] })], TODAY);
  assert.deepEqual(v.visits.map((x) => x.id), ["3"]);
});

test("the one thing to do next: a started visit, then late things, then today's, then what is soonest", () => {
  const mk = (assignments: OfflinePack["assignments"], plan: OfflinePack["plan"] = []) => buildToday([pack({ assignments, plan })], TODAY).next;
  assert.equal(mk([{ id: "1", formId: "f1", placeId: "a", status: "TO_DO", dueOn: "2026-11-20" }, { id: "2", formId: "f1", placeId: "b", status: "IN_PROGRESS", dueOn: "2026-12-30" }])?.id, "2", "started wins even when another is late");
  assert.equal(mk([{ id: "1", formId: "f1", placeId: "a", status: "TO_DO", dueOn: "2026-11-30" }, { id: "2", formId: "f1", placeId: "b", status: "TO_DO", dueOn: "2026-11-22" }])?.id, "2", "late beats soon");
  assert.equal(mk([{ id: "1", formId: "f1", placeId: "a", status: "TO_DO", dueOn: "2026-11-30" }], [{ id: "w", title: "Train", plannedStart: "2026-11-23", plannedEnd: "2026-11-25", status: "PLANNED" }])?.id, "w", "planned work happening today beats a visit due in days");
  assert.equal(mk([{ id: "1", formId: "f1", placeId: "a", status: "TO_DO", dueOn: TODAY }], [{ id: "w", title: "Train", plannedStart: TODAY, plannedEnd: TODAY, status: "PLANNED" }])?.id, "1", "on a tie a visit is first");
  assert.equal(mk([]), null);
  assert.equal(mk([], [{ id: "w", title: "Far", plannedStart: "2027-02-01", plannedEnd: "2027-02-02", status: "PLANNED" }]), null, "work months away is not the next thing");
});

test("planned work is late, today, this week or later by its dates", () => {
  const v = buildToday([pack({ plan: [
    { id: "a", title: "A", plannedStart: "2026-11-20", plannedEnd: "2026-11-23", status: "PLANNED" },
    { id: "b", title: "B", plannedStart: "2026-11-23", plannedEnd: "2026-11-25", status: "PLANNED" },
    { id: "c", title: "C", plannedStart: "2026-11-27", plannedEnd: "2026-11-27", status: "PLANNED" },
    { id: "d", title: "D", plannedStart: "2026-12-20", plannedEnd: "2026-12-21", status: "PLANNED" },
  ] })], TODAY);
  assert.deepEqual(v.work.map((w) => [w.id, w.when]), [["a", "OVERDUE"], ["b", "TODAY"], ["c", "THIS_WEEK"], ["d", "LATER"]]);
});

test("several projects are merged in one order, each task keeping its project's name", () => {
  const v = buildToday([pack({ projectId: "p1", projectName: "One", assignments: [{ id: "1", formId: "f1", placeId: "a", status: "TO_DO", dueOn: "2026-11-30" }] }), pack({ projectId: "p2", projectName: "Two", assignments: [{ id: "2", formId: "f1", placeId: "b", status: "TO_DO", dueOn: "2026-11-26" }] })], TODAY);
  assert.deepEqual(v.visits.map((x) => [x.id, x.projectName]), [["2", "Two"], ["1", "One"]]);
});

test("the week: what is late, then each day that has something, then what has no date", () => {
  const v = buildToday([pack({
    assignments: [{ id: "1", formId: "f1", placeId: "a", status: "TO_DO", dueOn: "2026-11-22" }, { id: "2", formId: "f1", placeId: "b", status: "TO_DO", dueOn: "2026-11-26" }, { id: "3", formId: "f1", placeId: "c", status: "TO_DO" }],
    plan: [{ id: "w", title: "Train", plannedStart: "2026-11-24", plannedEnd: "2026-11-25", status: "PLANNED" }],
  })], TODAY);
  const g = weekGroups(v, TODAY);
  assert.deepEqual(g.map((x) => x.key), ["late", "2026-11-24", "2026-11-25", "2026-11-26", "later"]);
  assert.deepEqual(g.find((x) => x.key === "2026-11-25")!.items.map((t) => t.id), ["w"]);
  assert.deepEqual(weekGroups(buildToday([pack()], TODAY), TODAY), []);
});

import { isPhone, landsInFieldApp } from "../../src/features/navigation/domain/phone-landing.ts";

test("a field officer on a phone lands in the field app; everyone else, and a request to stay, get the Home", () => {
  const iphone = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1";
  const android = "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36";
  const laptop = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/120 Safari/537.36";
  assert.ok(isPhone(iphone) && isPhone(android) && !isPhone(laptop) && !isPhone(null) && !isPhone(""));
  assert.ok(landsInFieldApp({ homeVariant: "FIELD", userAgent: android }));
  assert.ok(landsInFieldApp({ homeVariant: "FIELD", userAgent: iphone, stay: undefined }));
  assert.ok(!landsInFieldApp({ homeVariant: "FIELD", userAgent: laptop }), "a laptop keeps the Home");
  assert.ok(!landsInFieldApp({ homeVariant: "FIELD", userAgent: android, stay: "1" }), "the online Home was asked for");
  assert.ok(!landsInFieldApp({ homeVariant: "MANAGER", userAgent: android }), "only the field home is sent");
  assert.ok(!landsInFieldApp({ homeVariant: "FIELD", userAgent: android, external: true }), "an outside partner keeps theirs");
});
