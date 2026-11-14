import type { Kit } from "../model.js";
import { bars, card, column, count, f, line, map, slicer, supplyColumns, table } from "./helpers.js";

/**
 * WASH kit (Phase 54 §1.4): the proof that a sector differs only by its kit. Three pages, content only, UNREVIEWED. The Sphere water
 * quantity standard is 15 litres per person per day; it is drawn beside the figure and never replaces a target.
 */
const GEO = "Who, where and when";
const WAT = "Water";
const SAN = "Sanitation and hygiene";

export const WASH_KIT: Kit = {
  key: "WASH",
  title: "WASH kit",
  description: "Water points, people served, litres per person, latrines, hygiene sessions and hygiene kits, with Sphere standards.",
  sector: "WASH",
  reviewState: "UNREVIEWED",
  source: "Sphere Handbook 2018",
  columns: [
    column("district", "District", "TEXT", "PLACE", GEO, ["district", "county", "sub county", "woreda", "lga", "admin2", "district name", "département", "distrito", "المديرية"]),
    column("site", "Site", "TEXT", "FACILITY", GEO, ["site", "camp", "settlement", "community", "village", "site name", "localité", "comunidad"]),
    column("month", "Month", "MONTH", "PERIOD", GEO, ["month", "reporting month", "period", "mois", "mes", "الشهر"]),
    column("partner", "Partner", "TEXT", "PARTNER", GEO, ["partner", "implementing partner", "organisation", "organization", "partenaire", "socio"]),
    count("people_served", "People served with water", WAT, ["people served", "people served water", "beneficiaries water", "population served", "personnes desservies", "personas atendidas"]),
    count("water_litres", "Water supplied (litres a day)", WAT, ["litres per day", "water supplied", "water litres", "total litres", "liters per day"]),
    { ...column("litres_per_person", "Litres per person per day", "RATE", "NONE", WAT, ["litres per person", "lpd", "l p d", "liters per person per day", "litres par personne"]), rateParts: { numerator: "water_litres", denominator: "people_served", percent: false } },
    count("water_points", "Water points", WAT, ["water points", "water points total", "taps", "points d eau", "puntos de agua"]),
    count("water_points_working", "Water points working", WAT, ["water points functional", "functional water points", "water points working", "points d eau fonctionnels"]),
    count("latrines", "Latrines in use", SAN, ["latrines", "latrines functional", "toilets", "latrines in use", "letrinas"]),
    count("hygiene_sessions", "Hygiene promotion sessions", SAN, ["hygiene sessions", "hygiene promotion sessions", "sessions d hygiene"]),
    ...supplyColumns("hygiene_kit", "Hygiene kits", ["hygiene kits", "hygiene kit"], "kits"),
  ],
  figures: [
    { id: "lpppd", label: "Litres per person per day", op: "RATIO", terms: ["water_litres", "people_served"] },
    { id: "working_share", label: "Water points working", op: "SHARE", terms: ["water_points_working", "water_points"], percent: true },
    { id: "people_per_latrine", label: "People per latrine", op: "RATIO", terms: ["people_served", "latrines"] },
  ],
  checks: [
    { id: "working-points", check: "NOT_MORE_THAN", label: "Working water points are not more than water points", params: { column: "water_points_working", limit: "water_points" } },
    { id: "not-negative", check: "NOT_NEGATIVE", label: "Counts are not below zero", params: { columns: ["people_served", "water_points", "latrines"] } },
  ],
  thresholds: [
    { id: "lpppd-15", figure: "lpppd", value: 15, role: "AT_LEAST", label: "15 litres per person per day", source: "Sphere" },
    { id: "latrine-20", figure: "people_per_latrine", value: 20, role: "AT_MOST", label: "At most 20 people per toilet", source: "Sphere" },
  ],
  pages: [
    { key: "water", title: "Water", blocks: [
      slicer("District", "district"), slicer("Month", "month"),
      card("People served", [f("people_served")]), card("Water points", [f("water_points")]), card("Sites", [f("site", "COUNT_DISTINCT")]),
      bars("Litres per person per day, by district", "district", [f("lpppd")], { thresholds: ["lpppd-15"], w: 12 }),
      line("People served by month", "month", [f("people_served")]),
      bars("Water points working, by district", "district", [f("working_share")]),
    ] },
    { key: "sanitation", title: "Sanitation and hygiene", blocks: [
      slicer("District", "district"),
      bars("People per latrine, by district", "district", [f("people_per_latrine")], { thresholds: ["latrine-20"] }),
      line("Hygiene sessions by month", "month", [f("hygiene_sessions")]),
      bars("Hygiene kits distributed, by district", "district", [f("hygiene_kit_used")]),
    ] },
    { key: "where", title: "Where we work", blocks: [
      map("People served by district", "district", f("people_served"), 12),
      table("By site", ["district", "site"], [f("people_served"), f("lpppd"), f("latrines")]),
    ] },
  ],
  templateRoles: ["district", "site", "month", "partner", "people_served", "water_litres", "water_points", "water_points_working", "latrines", "hygiene_sessions", "hygiene_kit_received", "hygiene_kit_used", "hygiene_kit_balance"],
};
