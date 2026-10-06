import assert from "node:assert/strict";
import test from "node:test";
import { suggestEvidenceLinks, sharedWords } from "../dist/index.js";

// Demo 5 fixtures: "Suggest links" found nothing for these files.
const indicators = [
  { id: "i-a", code: "HL-1.1a", name: "Community health volunteers trained", logframeItemId: "n-train" },
  { id: "i-b", code: "HL-1.1b", name: "Facilities receiving mentorship visits", logframeItemId: "n-mentor" },
  { id: "i-c", code: "HL-2.1", name: "Children fully immunised", logframeItemId: "n-imm" },
];
const activities = [
  { id: "a-train", title: "Community health volunteer training, Turkana South", logframeActivityId: "n-train", alreadyAttached: false },
  { id: "a-mentor", title: "Facility mentorship visits, Lodwar", logframeActivityId: "n-mentor", indicatorId: "i-b", alreadyAttached: false },
];

test("a mentorship log suggests HL-1.1b with a reason; a training attendance sheet suggests HL-1.1a", () => {
  const mentor = suggestEvidenceLinks({ evidence: { title: "Mentorship visit log March", fileName: "mentorship_visits_log_march.xlsx" }, activities, indicators });
  assert.equal(mentor[0].targetId === "a-mentor" || mentor[0].targetId === "i-b", true);
  const indicator = mentor.find((s) => s.targetType === "indicator");
  assert.equal(indicator.targetId, "i-b");
  assert.match(indicator.reason, /mentions "[^"]*mentorship[^"]*"/);
  const training = suggestEvidenceLinks({ evidence: { title: "Training attendance register", fileName: "CHV-training-attendance.pdf" }, activities, indicators });
  assert.equal(training.find((s) => s.targetType === "indicator").targetId, "i-a");
  assert.ok(!training.some((s) => s.targetId === "i-c"), "an unrelated indicator is not suggested");
});

test("a file that belongs to an activity is linked to what that activity feeds or measures, with that reason", () => {
  const feeds = suggestEvidenceLinks({ evidence: { title: "Scan 0043", fileName: "scan0043.pdf", activityId: "a-mentor" }, activities, indicators });
  assert.deepEqual([feeds[0].targetId, feeds[0].reason], ["i-b", "the activity this file belongs to records this indicator"]);
  const node = suggestEvidenceLinks({ evidence: { title: "Scan 0044", fileName: "scan0044.pdf", activityId: "a-train" }, activities, indicators });
  assert.deepEqual([node[0].targetId, node[0].reason], ["i-a", "same activity node in the logframe"]);
});

test("extracted text counts, an already attached activity is skipped, nothing matches nothing", () => {
  const text = suggestEvidenceLinks({ evidence: { title: "Document 7", fileName: "doc7.pdf", extractedText: "Facilities receiving mentorship visits were supervised in March." }, activities, indicators });
  assert.equal(text.find((s) => s.targetType === "indicator").targetId, "i-b");
  assert.match(text.find((s) => s.targetType === "indicator").reason, /text of the file/);
  const attached = suggestEvidenceLinks({ evidence: { title: "Mentorship visit log", fileName: "m.xlsx" }, activities: activities.map((a) => ({ ...a, alreadyAttached: true })), indicators: [] });
  assert.deepEqual(attached, []);
  assert.deepEqual(suggestEvidenceLinks({ evidence: { title: "zzz", fileName: "zzz.pdf" }, activities, indicators }), []);
  assert.deepEqual(sharedWords("mentorship visits log", "Facilities receiving mentorship visits"), ["mentorship", "visits"]);
});
