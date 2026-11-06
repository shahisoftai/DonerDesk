/**
 * The folder tree created once in an organisation's DonorDesk Drive folder, beside the per-project trees.
 * A folder is found by its stable `role` (kept in the folder's appProperties), never by its name, so a person may rename
 * one in Drive and setting up again neither renames nor duplicates it. Roles are unique across the whole tree.
 */
export interface OrganisationFolder {
  /** Stable identity stored on the Drive folder. */
  role: string;
  name: string;
  /** Role of the parent folder; absent = directly under the DonorDesk root. */
  parent?: string;
}

export const PROJECTS_FOLDER_ROLE = "ORG/03-Projects";
/** The staging folder for documents uploaded before their project exists: same role the setup wizard already uses. */
export const STAGING_FOLDER_ROLE = "SETUP_STAGING";

export const ORGANISATION_FOLDERS: readonly OrganisationFolder[] = [
  { role: "ORG/00-Organisation", name: "00-Organisation" },
  { role: "ORG/00-Organisation/Legal-Registration", name: "Legal-Registration", parent: "ORG/00-Organisation" },
  { role: "ORG/00-Organisation/Policies", name: "Policies", parent: "ORG/00-Organisation" },
  { role: "ORG/00-Organisation/Audits-Assessments", name: "Audits-Assessments", parent: "ORG/00-Organisation" },
  { role: "ORG/00-Organisation/Branding", name: "Branding", parent: "ORG/00-Organisation" },
  { role: "ORG/01-Donors-Grants", name: "01-Donors-Grants" },
  { role: "ORG/01-Donors-Grants/Donor-Templates", name: "Donor-Templates", parent: "ORG/01-Donors-Grants" },
  { role: "ORG/02-Programmes", name: "02-Programmes" },
  { role: PROJECTS_FOLDER_ROLE, name: "03-Projects" },
  { role: "ORG/04-Finance", name: "04-Finance" },
  { role: "ORG/04-Finance/Budgets", name: "Budgets", parent: "ORG/04-Finance" },
  { role: "ORG/04-Finance/Currency-Rates-Bank", name: "Currency-Rates-Bank", parent: "ORG/04-Finance" },
  { role: "ORG/04-Finance/Audit-Support", name: "Audit-Support", parent: "ORG/04-Finance" },
  { role: "ORG/05-People-Partners", name: "05-People-Partners" },
  { role: STAGING_FOLDER_ROLE, name: "06-Setup-Staging" },
  { role: "ORG/99-Archive", name: "99-Archive" },
];
