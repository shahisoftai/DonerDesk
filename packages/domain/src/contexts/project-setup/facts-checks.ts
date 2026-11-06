/** Advice on the project facts (Phase 37.4): readings that disagree, and countries the list does not know. Pure. */
import { recogniseCountry } from "./country-names.js";
import type { ProjectSetupProposal } from "./proposal.js";
import type { SetupProblem } from "./proposal-checks.js";

export function checkFactReadings(proposal: ProjectSetupProposal): SetupProblem[] {
  const problems: SetupProblem[] = [];
  for (const [key, item] of Object.entries(proposal.facts)) {
    if (item.status === "REJECTED" || item.status === "EDITED" || !item.alternatives?.length) continue;
    problems.push({ code: "FACTS_READINGS_DIFFER", path: `facts.${key}`, severity: "SOFT", message: `The documents give ${item.alternatives.length + (item.value === null ? 0 : 1)} readings for this fact: choose one.`, params: { count: item.alternatives.length + (item.value === null ? 0 : 1) } });
  }
  const countries = proposal.facts.countries;
  if (countries.status !== "REJECTED" && Array.isArray(countries.value)) {
    for (const name of countries.value.filter((c) => !recogniseCountry(c))) {
      problems.push({ code: "COUNTRY_NOT_RECOGNISED", path: "facts.countries", severity: "SOFT", message: `"${name}" is not a country name: it may be a province or a city. Write the country.`, params: { name } });
    }
  }
  return problems;
}
