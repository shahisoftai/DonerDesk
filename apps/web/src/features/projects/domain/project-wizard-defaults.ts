import { emptyWizardData, type ProjectWizardData } from "../validation/project-wizard.ts";
import { COMMON_DONORS, COUNTRIES, CURRENCIES, currencyForCountry } from "./reference-data.ts";

export interface DefaultsOrganization {
  name: string;
  country: string;
  sectors?: readonly string[] | undefined;
}

/** What is known of an earlier project (the list item has these; richer detail is used when the caller has it). */
export interface DefaultsProject {
  donorName: string;
  country: string;
  sector?: string | undefined;
  reportingFrequency: string;
  startDate: string;
  implementingOrganization?: string | undefined;
  partnerOrganization?: string | undefined;
  region?: string | undefined;
  district?: string | undefined;
  budgetCurrency?: string | undefined;
  primaryContactName?: string | undefined;
}

export interface WizardSuggestions {
  donors: string[];
  countries: string[];
  currencies: string[];
}

const SECTORS = ["NUTRITION", "FOOD_SECURITY", "WASH", "HEALTH", "PROTECTION", "EDUCATION", "LIVELIHOODS", "SHELTER", "MULTI_SECTOR", "OTHER"] as const;
const FREQUENCIES = ["MONTHLY", "QUARTERLY", "SEMI_ANNUAL", "ANNUAL", "FINAL", "CUSTOM"] as const;

const known = <T extends string>(options: readonly T[], value: string | undefined): T | undefined =>
  options.find((o) => o === value);

const real = (country: string): string => (country.trim().toUpperCase() === "UNKNOWN" ? "" : country.trim());

function unique(values: ReadonlyArray<string | undefined>): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of values) {
    const text = v?.trim();
    if (!text || seen.has(text.toLowerCase())) continue;
    seen.add(text.toLowerCase());
    out.push(text);
  }
  return out;
}

/** Carries over what repeats from one project to the next: who we are, where, which donor and cadence. Never the title, code or dates. */
export function wizardDataFromProject(project: DefaultsProject, organization: DefaultsOrganization): ProjectWizardData {
  const data = emptyWizardData();
  data.step.donorName = project.donorName;
  data.step.implementingOrganization = project.implementingOrganization?.trim() || organization.name;
  data.step.partnerOrganization = project.partnerOrganization ?? "";
  data.geography.country = real(project.country) || real(organization.country);
  data.geography.region = project.region ?? "";
  data.geography.district = project.district ?? "";
  data.geography.sector = known(SECTORS, project.sector) ?? data.geography.sector;
  data.reporting.reportingFrequency = known(FREQUENCIES, project.reportingFrequency) ?? data.reporting.reportingFrequency;
  data.reporting.budgetCurrency = project.budgetCurrency ?? currencyForCountry(data.geography.country) ?? "";
  data.reporting.primaryContactName = project.primaryContactName ?? "";
  return data;
}

/**
 * The first form is not empty: the organisation is the implementer, the country and cadence follow the most recent
 * project, the currency follows the country. The donor is never guessed - it is suggested.
 */
export function projectWizardDefaults(input: {
  organization: DefaultsOrganization;
  projects: ReadonlyArray<DefaultsProject>;
}): { data: ProjectWizardData; suggestions: WizardSuggestions } {
  const latest = [...input.projects].sort((a, b) => b.startDate.localeCompare(a.startDate))[0];
  const data = emptyWizardData();
  data.step.implementingOrganization = input.organization.name;
  data.geography.country = real(latest?.country ?? "") || real(input.organization.country);
  const sector = known(SECTORS, latest?.sector) ?? known(SECTORS, input.organization.sectors?.[0]);
  if (sector) data.geography.sector = sector;
  const frequency = known(FREQUENCIES, latest?.reportingFrequency);
  if (frequency) data.reporting.reportingFrequency = frequency;
  data.reporting.budgetCurrency = currencyForCountry(data.geography.country) ?? "";
  return {
    data,
    suggestions: {
      donors: unique([...input.projects.map((p) => p.donorName), ...COMMON_DONORS]),
      countries: unique([...input.projects.map((p) => real(p.country)), real(input.organization.country), ...COUNTRIES]),
      currencies: unique([data.reporting.budgetCurrency, ...CURRENCIES]),
    },
  };
}

/**
 * A pre-filled value that is still the suggestion is called one, so a project of a different sector or country is
 * not created with a value nobody chose. Empty once the person has changed it (or when nothing was suggested).
 */
export function suggestionHint(suggested: string, current: string, label?: string): string | undefined {
  return suggested && suggested === current ? `Suggested from your last project${label ? ` (${label})` : ""}: change it if this project is different.` : undefined;
}
