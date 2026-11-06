import test from "node:test";
import assert from "node:assert/strict";
import { buildRecordChunks } from "../dist/index.js";

/**
 * C-3 — the claim verifier grounds a statement against the record chunks. If
 * the writer saw redacted text, the chunks it is checked against must be the
 * same redacted text, or every claim from that record would fail.
 */

const project = { title: "P", projectCode: "C", donorName: "D", implementingOrganization: "I", country: "Nigeria", sector: "WASH", duration: { start: new Date("2026-02-01"), end: new Date("2026-09-01") } };

function sources(over = {}) {
  return {
    project,
    period: { reportType: "ANNUAL", duration: { start: new Date("2026-02-01"), end: new Date("2026-09-01") } },
    activities: [],
    indicatorUpdates: [],
    ...over,
  };
}

test("an activity record's free text is redacted for the model", () => {
  const chunks = buildRecordChunks(
    sources({
      activities: [
        {
          id: "a-1",
          activityTitle: "Clinic",
          activityDate: new Date("2026-05-04"),
          location: "Wau",
          summary: "Nurse Jane Doe ran the clinic; the register is at jane.doe@example.org.",
          participantsTotal: 12,
        },
      ],
    }),
  );
  const activity = chunks.filter((c) => c.chunkId.startsWith("record:activity:"));
  assert.ok(activity.length > 0);
  for (const chunk of activity) {
    assert.ok(!chunk.text.includes("jane.doe@example.org"), chunk.text);
  }
  assert.ok(activity.some((c) => c.text.includes("Nurse Jane Doe ran the clinic")));
});

test("the officer's story is redacted for the model", () => {
  const chunks = buildRecordChunks(
    sources({ story: { achievements: "Follow up with jane.doe@example.org about the register." } }),
  );
  const story = chunks.filter((c) => c.chunkId.startsWith("record:story:"));
  assert.ok(story.length > 0);
  for (const chunk of story) {
    assert.ok(!chunk.text.includes("jane.doe@example.org"), chunk.text);
  }
});

test("the project, donor and indicator codes are left exactly as given", () => {
  const chunks = buildRecordChunks(
    sources({
      activities: [
        {
          id: "a-1",
          activityTitle: "Clinic",
          activityDate: new Date("2026-05-04"),
          summary: "Reached 96 centres.",
        },
      ],
      indicatorUpdates: [{ indicatorCode: "OUT-1", comments: "Verified on site.", dataSource: "Clinic register", periodAchievement: "96" }],
    }),
  );
  const text = chunks.map((c) => c.text).join("\n");
  assert.ok(text.includes("Donor: D"), "the donor is named exactly");
  assert.ok(text.includes("OUT-1"), "the indicator code is untouched");
  assert.ok(text.includes("96 centres"), "the figure is untouched");
});
