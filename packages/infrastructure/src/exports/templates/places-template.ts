import { ADMIN_LEVEL_LABEL, PLACE_EXPORT_COLUMNS } from "@donordesk/domain";
import type { TemplateColumn } from "./template-kit.js";
import { addDataSheet, addGuideSheet, cachedBuild, newWorkbook, toBuffer } from "./template-kit.js";

export const PLACES_TEMPLATE_FILENAME = "places-template.xlsx";

const LEVELS = Object.values(ADMIN_LEVEL_LABEL);

type PlaceHeader = (typeof PLACE_EXPORT_COLUMNS)[number];
const SPEC: Readonly<Record<PlaceHeader, Omit<TemplateColumn, "header">>> = {
  Name: { width: 28, required: true, takes: "The place's name as people write it", example: "Gulu" },
  Level: { width: 22, required: true, takes: "What kind of place it is", example: "District or locality", choices: LEVELS },
  Parent: { width: 24, required: false, takes: "The name of the place it sits inside (in this sheet or already in your list); it must be a bigger level", example: "Northern Region" },
  Code: { width: 14, required: false, takes: "Official code (P-code), if you have one; it is how a place is matched to the map's boundaries", example: "UG302" },
  Latitude: { width: 12, required: false, takes: "Decimal degrees, for a pin; give both or neither", example: "2.7724" },
  Longitude: { width: 12, required: false, takes: "Decimal degrees, for a pin; give both or neither", example: "32.2881" },
  "Other spellings": { width: 28, required: false, takes: "Other names people use, separated by a semicolon", example: "Gulu Town; Gulu Municipality" },
  "Facility type": { width: 16, required: false, takes: "Only for a facility: its type from your organisation's list (for example OTP, SC); leave empty otherwise", example: "" },
};

/** The places export's own columns (`PLACE_EXPORT_COLUMNS`), so a filled template, an export and the import all agree; Name and Level are required. */
export const PLACES_COLUMNS: ReadonlyArray<TemplateColumn> = PLACE_EXPORT_COLUMNS.map((header) => ({ header, ...SPEC[header] }));

export const buildPlacesTemplate = cachedBuild(async () => {
  const wb = newWorkbook();
  addDataSheet(wb, "Places", PLACES_COLUMNS);
  addGuideSheet(wb, [
    "Fill the first sheet, one place per row, then upload this file in Settings > Places > Import places.",
    "Check the sheet first: nothing is added until you apply it, and any row with a problem is named. A parent may be a row of this sheet or a place you already have.",
  ], PLACES_COLUMNS, [
    { Name: "Uganda", Level: "Country", Code: "UG" },
    { Name: "Northern Region", Level: "State or province", Parent: "Uganda", Code: "UG3" },
    { Name: "Gulu", Level: "District or locality", Parent: "Northern Region", Code: "UG302", Latitude: "2.7724", Longitude: "32.2881", "Other spellings": "Gulu Town" },
    { Name: "Laroo Health Centre", Level: "Community or site", Parent: "Gulu", Latitude: "2.7801", Longitude: "32.3002", "Facility type": "OTP" },
  ]);
  return toBuffer(wb);
});
