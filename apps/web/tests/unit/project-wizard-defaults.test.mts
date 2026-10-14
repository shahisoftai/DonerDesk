import { test } from "node:test";
import assert from "node:assert/strict";
import { projectWizardDefaults, wizardDataFromProject } from "../../src/features/projects/domain/project-wizard-defaults.ts";
import { currencyForCountry } from "../../src/features/projects/domain/reference-data.ts";

const org = { name: "Hope Aid", country: "Kenya", sectors: ["WASH"] };
const project = (over: object = {}) => ({ donorName: "USAID", country: "Uganda", sector: "HEALTH", reportingFrequency: "MONTHLY", startDate: "2026-01-01", ...over });

test("a first project starts from the organisation, not from an empty form", () => {
  const { data, suggestions } = projectWizardDefaults({ organization: org, projects: [] });
  assert.equal(data.step.implementingOrganization, "Hope Aid");
  assert.equal(data.geography.country, "Kenya");
  assert.equal(data.geography.sector, "WASH");
  assert.equal(data.reporting.budgetCurrency, "KES");
  assert.equal(data.step.donorName, "");
  assert.ok(suggestions.donors.includes("USAID"));
});

test("later projects follow the most recent one; used donors come first in the suggestions", () => {
  const { data, suggestions } = projectWizardDefaults({
    organization: org,
    projects: [project({ donorName: "Old Donor", country: "Ghana", startDate: "2024-01-01" }), project({ donorName: "GIZ" })],
  });
  assert.equal(data.geography.country, "Uganda");
  assert.equal(data.geography.sector, "HEALTH");
  assert.equal(data.reporting.reportingFrequency, "MONTHLY");
  assert.equal(data.reporting.budgetCurrency, "UGX");
  assert.deepEqual(suggestions.donors.slice(0, 2), ["Old Donor", "GIZ"]);
  assert.equal(suggestions.donors.filter((d) => d === "GIZ").length, 1);
});

test("an unknown country or sector never leaks into the form", () => {
  const { data } = projectWizardDefaults({ organization: { name: "X", country: "UNKNOWN" }, projects: [project({ country: "UNKNOWN", sector: "MADE_UP", reportingFrequency: "SOMETIMES" })] });
  assert.equal(data.geography.country, "");
  assert.equal(data.geography.sector, "NUTRITION");
  assert.equal(data.reporting.reportingFrequency, "QUARTERLY");
});

test("starting from a project copies who/where/cadence, never the title, code or dates", () => {
  const data = wizardDataFromProject(project({ implementingOrganization: "Hope Aid East", region: "Rift" }), org);
  assert.equal(data.step.donorName, "USAID");
  assert.equal(data.step.implementingOrganization, "Hope Aid East");
  assert.equal(data.geography.region, "Rift");
  assert.equal(data.step.title, "");
  assert.equal(data.step.projectCode, "");
  assert.equal(data.geography.startDate, "");
});

test("currency by country is case-insensitive and unsure countries give nothing", () => {
  assert.equal(currencyForCountry(" KENYA "), "KES");
  assert.equal(currencyForCountry("Atlantis"), undefined);
});

import { suggestionHint } from "../../src/features/projects/domain/project-wizard-defaults.ts";

test("a value that is still the suggestion is labelled as one; a changed or absent one is not", () => {
  assert.match(suggestionHint("HEALTH", "HEALTH", "Health")!, /Suggested from your last project \(Health\): change it/);
  assert.equal(suggestionHint("HEALTH", "WASH", "WASH"), undefined);
  assert.equal(suggestionHint("", "", undefined), undefined);
});
