import { test } from "node:test";
import assert from "node:assert/strict";
import { deadlineUrgency, formatDate, formatFileSize } from "../../src/lib/shared/dates.ts";

test("deadlineUrgency maps overdue and today to danger", () => {
  assert.equal(deadlineUrgency(-1).tone, "danger");
  assert.equal(deadlineUrgency(-1).label, "Overdue");
  assert.equal(deadlineUrgency(0).tone, "danger");
  assert.equal(deadlineUrgency(0).label, "Due today");
});

test("deadlineUrgency maps near deadlines to warning and later to neutral", () => {
  assert.equal(deadlineUrgency(3).tone, "warning");
  assert.equal(deadlineUrgency(7).tone, "warning");
  assert.equal(deadlineUrgency(8).tone, "neutral");
  assert.equal(deadlineUrgency(1).label, "1 day left");
  assert.equal(deadlineUrgency(5).label, "5 days left");
});

test("deadlineUrgency handles unknown values safely", () => {
  const u = deadlineUrgency(undefined);
  assert.equal(u.tone, "neutral");
  assert.equal(u.label, "Unknown deadline");
});

test("formatDate renders dashes for missing values", () => {
  assert.equal(formatDate(null), "—");
  assert.equal(formatDate(undefined), "—");
});

test("formatFileSize renders bytes and KB", () => {
  assert.equal(formatFileSize(500), "500 B");
  assert.equal(formatFileSize(2048), "2 KB");
});
