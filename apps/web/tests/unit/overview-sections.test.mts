import { test } from "node:test";
import assert from "node:assert/strict";
import { ROLES, capabilitiesForRole } from "../../src/lib/shared/capabilities.ts";
import {
  OVERVIEW_ROLE_SECTIONS,
  OVERVIEW_SECTION_ORDER,
  SECTION_CAPABILITY,
  sectionsFor,
  type OverviewFacts,
  type OverviewSection,
} from "../../src/features/projects/domain/overview-sections.ts";

const facts = (over: Partial<OverviewFacts> = {}): OverviewFacts => ({
  hasPeriods: true,
  hasPlan: true,
  planningVisible: true,
  hasRisks: true,
  finalYear: false,
  ...over,
});

test("every role has a row, so a new role cannot be forgotten", () => {
  for (const role of ROLES) {
    assert.ok(Array.isArray(OVERVIEW_ROLE_SECTIONS[role]), `${role} has no row`);
  }
  assert.deepEqual(Object.keys(OVERVIEW_ROLE_SECTIONS).sort(), [...ROLES].sort());
});

test("every part is in the order list and has its capability entry", () => {
  for (const section of OVERVIEW_SECTION_ORDER) {
    assert.ok(section in SECTION_CAPABILITY, `${section} has no capability entry`);
  }
  for (const role of ROLES) {
    for (const section of OVERVIEW_ROLE_SECTIONS[role]) {
      assert.ok(OVERVIEW_SECTION_ORDER.includes(section), `${role} lists an unknown part: ${section}`);
    }
  }
});

test("a part that needs a capability is hidden when the person lacks it", () => {
  const sections = sectionsFor("PROJECT_MANAGER", new Set(), facts());
  assert.equal(sections.includes("TEAM"), false);
  assert.equal(sections.includes("CLOSEOUT"), false);
  const withCapabilities = sectionsFor("PROJECT_MANAGER", capabilitiesForRole("PROJECT_MANAGER"), facts());
  assert.equal(withCapabilities.includes("TEAM"), true);
});

test("a field officer sees their own work, not the programme's administration", () => {
  const sections = sectionsFor("FIELD_OFFICER", capabilitiesForRole("FIELD_OFFICER"), facts());
  assert.deepEqual(sections, ["NEEDS_YOU", "PULSE", "CALENDAR", "DELIVERY", "RISKS"]);
  assert.equal(sections.includes("TEAM"), false);
  assert.equal(sections.includes("REPORTING"), false);
  assert.equal(sections.includes("CLOSEOUT"), false);
});

test("a viewer sees the programme read-only and never a queue", () => {
  const sections = sectionsFor("VIEWER", capabilitiesForRole("VIEWER"), facts());
  assert.deepEqual(sections, ["PULSE", "REPORTING", "RESULTS", "SETUP"]);
  assert.equal(sections.includes("NEEDS_YOU"), false);
  assert.equal(sections.includes("CALENDAR"), false);
});

test("a project without a plan looks as it did before", () => {
  const sections = sectionsFor("PROJECT_MANAGER", capabilitiesForRole("PROJECT_MANAGER"), facts({ hasPlan: false }));
  assert.equal(sections.includes("DELIVERY"), false);
  const hidden = sectionsFor("PROJECT_MANAGER", capabilitiesForRole("PROJECT_MANAGER"), facts({ planningVisible: false }));
  assert.equal(hidden.includes("DELIVERY"), false);
});

test("reporting needs a period and close-out needs the final year", () => {
  const manager = capabilitiesForRole("PROJECT_MANAGER");
  assert.equal(sectionsFor("PROJECT_MANAGER", manager, facts({ hasPeriods: false })).includes("REPORTING"), false);
  assert.equal(sectionsFor("PROJECT_MANAGER", manager, facts({ finalYear: true })).includes("CLOSEOUT"), true);
  assert.equal(sectionsFor("PROJECT_MANAGER", manager, facts({ finalYear: false })).includes("CLOSEOUT"), false);
});

test("the parts come back in one fixed order", () => {
  const sections = sectionsFor("ADMIN", capabilitiesForRole("ADMIN"), facts({ finalYear: true }));
  const positions = sections.map((section) => OVERVIEW_SECTION_ORDER.indexOf(section));
  assert.deepEqual(positions, [...positions].sort((a, b) => a - b));
  assert.equal(sections.length, OVERVIEW_SECTION_ORDER.length);
});

test("an unknown role is treated as a viewer", () => {
  const sections = sectionsFor("NOT_A_ROLE", capabilitiesForRole("NOT_A_ROLE"), facts());
  assert.deepEqual(sections, ["PULSE", "REPORTING", "RESULTS", "SETUP"]);
  assert.deepEqual(sectionsFor(null, new Set(), facts()), ["PULSE", "REPORTING", "RESULTS", "SETUP"]);
});
