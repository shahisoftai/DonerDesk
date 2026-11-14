import type { Kit } from "../model.js";
import { bars, card, column, count, f, line, map, note, pie, slicer, supplyColumns, table } from "./helpers.js";

/**
 * Nutrition kit (Phase 54, first kit). Content only, UNREVIEWED until an administrator or project manager reviews it (D6). The
 * thresholds are the Sphere Handbook (2018) performance standards for treatment of acute malnutrition; clinical items (case
 * definitions, thresholds) should be checked with a nutrition specialist before anyone relies on them. Headers cover English, French,
 * Spanish and Arabic and common ministry export spellings (CamelCase headers are folded to words before matching).
 */
const GEO = "Who, where and when";
const SCR = "Screening";
const IDT = "Identified";
const ADM = "Admissions";
const EXT = "Exits and outcomes";
const SRV = "Other services";

export const NUTRITION_KIT: Kit = {
  key: "NUTRITION",
  title: "Nutrition kit",
  description: "Screening, SAM and MAM identification, CMAM admissions and outcomes, pregnant and lactating women, IYCF, micronutrients and supplies, with Sphere standards.",
  sector: "NUTRITION",
  reviewState: "UNREVIEWED",
  source: "Sphere Handbook 2018",
  columns: [
    column("province", "Province", "TEXT", "PLACE", GEO, ["province", "region", "state", "county", "governorate", "admin1", "admin 1", "province name", "région", "provincia", "estado", "المحافظة"]),
    column("district", "District", "TEXT", "PLACE", GEO, ["district", "sub county", "subcounty", "woreda", "lga", "upazila", "tehsil", "admin2", "admin 2", "district name", "département", "distrito", "municipio", "المديرية"]),
    column("month", "Month", "MONTH", "PERIOD", GEO, ["month", "reporting month", "report month", "period", "mois", "mes", "periodo", "الشهر"]),
    column("partner", "Partner", "TEXT", "PARTNER", GEO, ["partner", "implementing partner", "ip", "organisation", "organization", "partner name", "partenaire", "socio", "الشريك"]),
    column("donor", "Donor", "TEXT", "DONOR", GEO, ["donor", "funding", "funding source", "funded by", "bailleur", "donante", "المانح"]),
    column("site", "Site", "TEXT", "FACILITY", GEO, ["site", "facility", "health facility", "otp site", "site name", "facility name", "structure", "establecimiento", "المرفق"]),

    count("children_screened", "Children screened", SCR, ["total child screen", "children screened", "child screened", "total children screened", "u5 screened", "enfants depistes", "niños tamizados"]),
    count("women_screened", "Women screened", SCR, ["total wome screen", "total women screen", "women screened", "plw screened", "femmes depistees", "mujeres tamizadas"]),

    count("sam_identified", "Children with SAM identified", IDT, ["sam identified", "total sam", "sam", "sam b115", "child sam", "mas identifies", "desnutricion aguda severa"], { note: "Case definition as in the source: MUAC below 115 mm, WHZ below −3 or bilateral oedema." }),
    count("mam_identified", "Children with MAM identified", IDT, ["mam identified", "total mam", "mam", "mam 115 125", "child mam", "mam identifies"], { note: "Case definition as in the source: MUAC 115 to 124 mm or WHZ −3 to −2." }),
    count("plw_mam_identified", "PLW with acute malnutrition identified", IDT, ["plw mam", "plw identified", "women mam", "plw malnourished", "femmes enceintes allaitantes malnutries"]),

    count("otp_admissions", "OTP admissions", ADM, ["new admin otp", "new admission otp", "otp admissions", "otp new admissions", "admissions otp", "admissions sam", "itp admissions", "admissions ptas", "ingresos"]),
    count("otp_admissions_boys", "OTP admissions, boys", ADM, ["new admin otp b", "new admin otp boys", "otp admissions boys", "boys admitted otp"]),
    count("otp_admissions_girls", "OTP admissions, girls", ADM, ["new admin otp g", "new admin otp girls", "otp admissions girls", "girls admitted otp"]),
    count("sc_admissions", "Stabilisation centre admissions", ADM, ["new admin sc", "sc admissions", "stabilisation centre admissions", "stabilization center admissions", "itfc admissions", "admissions sc"]),
    count("tsfp_admissions", "TSFP admissions", ADM, ["new admin tsfp", "new admin sfp", "tsfp admissions", "sfp admissions", "admissions mam", "bsfp admissions", "admissions tsfp"]),
    count("plw_admissions", "PLW admitted to supplementary feeding", ADM, ["new admin plw", "plw admissions", "plw sfp admissions", "plw admitted", "women admitted sfp"]),

    count("otp_exits", "OTP exits", EXT, ["total exit otp", "total dis otp", "otp exits", "otp total exits", "otp discharges", "sorties ptas"]),
    count("otp_cured", "OTP cured", EXT, ["dis cured otp", "otp cured", "cured otp", "recovered otp", "otp recovered", "gueris", "curados"]),
    count("otp_died", "OTP deaths", EXT, ["dis death otp", "dis died otp", "otp death", "otp deaths", "died otp", "deces", "fallecidos"]),
    count("otp_defaulted", "OTP defaulted", EXT, ["dis default otp", "otp default", "otp defaulted", "defaulter otp", "abandons", "abandonos"]),
    count("otp_nonresponse", "OTP non-response", EXT, ["dis non response otp", "otp non response", "otp non responder", "non repondants"]),
    count("otp_moved", "OTP moved out or referred", EXT, ["dis transfer otp", "otp moved", "otp transfer out", "otp referred", "transferts"]),
    count("tsfp_exits", "TSFP exits", EXT, ["total exit tsfp", "total dis sfp", "tsfp exits", "sfp exits", "tsfp discharges"]),
    count("tsfp_cured", "TSFP cured", EXT, ["dis cured sfp", "dis cured tsfp", "tsfp cured", "sfp cured", "tsfp recovered"]),
    count("tsfp_died", "TSFP deaths", EXT, ["dis death sfp", "dis death tsfp", "tsfp death", "tsfp deaths", "sfp deaths"]),
    count("tsfp_defaulted", "TSFP defaulted", EXT, ["dis default sfp", "dis default tsfp", "tsfp default", "tsfp defaulted", "sfp defaulted"]),

    count("iycf_sessions", "IYCF counselling sessions", SRV, ["iycf sessions", "iycf counselling sessions", "counselling sessions", "anje sessions", "sesiones"]),
    count("iycf_caretakers", "Caretakers counselled on IYCF", SRV, ["iycf caretakers", "caretakers counselled", "iycf participants", "mothers counselled", "caregivers counselled"]),
    count("mmn_boys", "Children given MNP, boys", SRV, ["child u2 mmn b", "childu2mmnb", "mnp boys", "mmn boys", "micronutrient powder boys"]),
    count("mmn_girls", "Children given MNP, girls", SRV, ["child u2 mmn g", "childu2mmng", "mnp girls", "mmn girls", "micronutrient powder girls"]),
    count("mmn_women", "Women given MMN tablets", SRV, ["plw mmn", "women mmn", "mmn women", "mmn tablets women"]),
    count("ifa_women", "Women given IFA", SRV, ["plw ifa", "women ifa", "ifa women", "iron folic acid women", "fer acide folique"]),

    ...supplyColumns("rutf", "RUTF", ["rutf", "plumpy nut", "plumpynut"], "cartons", true),
    ...supplyColumns("rusf", "RUSF", ["rusf", "plumpy sup", "plumpysup"], "cartons", true),
    ...supplyColumns("f75", "F-75", ["f75", "f 75"], "tins"),
    ...supplyColumns("f100", "F-100", ["f100", "f 100"], "tins"),
    ...supplyColumns("resomal", "ReSoMal", ["resomal"], "sachets"),
    ...supplyColumns("mnp", "Micronutrient powder", ["mnp", "micronutrient powder"], "sachets"),
    ...supplyColumns("mmn", "MMN tablets", ["mmn tablets", "mmn tab"], "tablets"),
    ...supplyColumns("muac", "MUAC tapes", ["muac tapes", "muac tape"], "tapes"),
  ],
  figures: [
    { id: "sam_rate", label: "SAM among children screened", op: "SHARE", terms: ["sam_identified", "children_screened"], percent: true },
    { id: "mam_rate", label: "MAM among children screened", op: "SHARE", terms: ["mam_identified", "children_screened"], percent: true },
    { id: "otp_cure_rate", label: "OTP cure rate", op: "SHARE", terms: ["otp_cured", "otp_exits"], percent: true },
    { id: "otp_death_rate", label: "OTP death rate", op: "SHARE", terms: ["otp_died", "otp_exits"], percent: true },
    { id: "otp_default_rate", label: "OTP default rate", op: "SHARE", terms: ["otp_defaulted", "otp_exits"], percent: true },
    { id: "tsfp_cure_rate", label: "TSFP cure rate", op: "SHARE", terms: ["tsfp_cured", "tsfp_exits"], percent: true },
    { id: "tsfp_death_rate", label: "TSFP death rate", op: "SHARE", terms: ["tsfp_died", "tsfp_exits"], percent: true },
    { id: "tsfp_default_rate", label: "TSFP default rate", op: "SHARE", terms: ["tsfp_defaulted", "tsfp_exits"], percent: true },
    { id: "otp_admission_share", label: "SAM cases admitted", op: "SHARE", terms: ["otp_admissions", "sam_identified"], percent: true },
  ],
  checks: [
    { id: "otp-exits", check: "SUM_EQUALS", label: "OTP outcomes add up to exits", params: { total: "otp_exits", parts: ["otp_cured", "otp_died", "otp_defaulted", "otp_nonresponse", "otp_moved"] } },
    { id: "tsfp-exits", check: "SUM_EQUALS", label: "TSFP outcomes add up to exits", params: { total: "tsfp_exits", parts: ["tsfp_cured", "tsfp_died", "tsfp_defaulted"] } },
    { id: "otp-split", check: "SUM_EQUALS", label: "Boys and girls add up to OTP admissions", params: { total: "otp_admissions", parts: ["otp_admissions_boys", "otp_admissions_girls"] } },
    { id: "sam-identified", check: "NOT_MORE_THAN", label: "SAM identified is not more than children screened", params: { column: "sam_identified", limit: "children_screened" } },
    { id: "cured-exits", check: "NOT_MORE_THAN", label: "Cured is not more than exits", params: { column: "otp_cured", limit: "otp_exits" } },
    { id: "rutf-balance", check: "BALANCE", label: "RUTF stock balances", params: { opening: "rutf_opening", in: ["rutf_received"], out: ["rutf_used"], closing: "rutf_balance" } },
    { id: "rusf-balance", check: "BALANCE", label: "RUSF stock balances", params: { opening: "rusf_opening", in: ["rusf_received"], out: ["rusf_used"], closing: "rusf_balance" } },
    { id: "not-negative", check: "NOT_NEGATIVE", label: "Counts are not below zero", params: { columns: ["children_screened", "otp_admissions", "otp_exits", "rutf_received", "rutf_used"] } },
  ],
  thresholds: [
    { id: "cure-75", figure: "otp_cure_rate", value: 75, role: "AT_LEAST", label: "Cure rate above 75 %", source: "Sphere" },
    { id: "death-10", figure: "otp_death_rate", value: 10, role: "AT_MOST", label: "Death rate below 10 %", source: "Sphere" },
    { id: "default-15", figure: "otp_default_rate", value: 15, role: "AT_MOST", label: "Default rate below 15 %", source: "Sphere" },
    { id: "tsfp-cure-75", figure: "tsfp_cure_rate", value: 75, role: "AT_LEAST", label: "Cure rate above 75 %", source: "Sphere" },
    { id: "tsfp-default-15", figure: "tsfp_default_rate", value: 15, role: "AT_MOST", label: "Default rate below 15 %", source: "Sphere" },
  ],
  pages: [
    { key: "overview", title: "Overview", blocks: [
      slicer("Province", "province"), slicer("Partner", "partner"), slicer("Month", "month"),
      card("Children screened", [f("children_screened")]), card("OTP admissions", [f("otp_admissions")]), card("Districts reporting", [f("district", "COUNT_DISTINCT")]), card("Partners", [f("partner", "COUNT_DISTINCT")]),
      map("OTP admissions by district", "district", f("otp_admissions")),
      bars("OTP admissions by province", "province", [f("otp_admissions")], { sort: "VALUE_DESC" }),
    ] },
    { key: "partners", title: "Partners and where they work", blocks: [
      slicer("Province", "province"),
      map("Partners by district", "district", f("partner")),
      bars("Children screened by partner", "partner", [f("children_screened")], { sort: "VALUE_DESC" }),
      table("Partner coverage", ["province", "district"], [f("partner", "COUNT_DISTINCT"), f("children_screened")]),
    ] },
    { key: "screening", title: "Screening", blocks: [
      slicer("Province", "province"), slicer("Month", "month"),
      bars("Children and women screened by district", "district", [f("children_screened"), f("women_screened")], { family: "STACKED_BAR", sort: "VALUE_DESC", topN: 20, w: 12 }),
      line("Children screened by month", "month", [f("children_screened")]),
      line("Women screened by month", "month", [f("women_screened")]),
    ] },
    { key: "identification", title: "SAM and MAM identification", blocks: [
      slicer("Province", "province"), slicer("Partner", "partner"),
      line("SAM among children screened, by month", "month", [f("sam_rate")]),
      line("MAM among children screened, by month", "month", [f("mam_rate")]),
      bars("SAM and MAM identified by province", "province", [f("sam_identified"), f("mam_identified")]),
      bars("SAM cases admitted, by province", "province", [f("otp_admission_share")]),
    ] },
    { key: "admissions", title: "Admissions", blocks: [
      slicer("Province", "province"), slicer("Partner", "partner"), slicer("Month", "month"),
      bars("Admissions by province", "province", [f("otp_admissions"), f("sc_admissions"), f("tsfp_admissions")], { w: 12 }),
      line("Admissions by month", "month", [f("otp_admissions"), f("tsfp_admissions")]),
      { type: "VISUAL", family: "PIE", title: "OTP admissions by sex", w: 6, h: 4, wells: { VALUES: [f("otp_admissions_boys"), f("otp_admissions_girls")] } },
    ] },
    { key: "performance", title: "Outcomes and performance by place", blocks: [
      slicer("Province", "province"), slicer("Partner", "partner"), slicer("Month", "month"),
      bars("OTP cure rate by province", "province", [f("otp_cure_rate")], { thresholds: ["cure-75"] }),
      bars("OTP default rate by province", "province", [f("otp_default_rate")], { thresholds: ["default-15"] }),
      bars("OTP cure rate by district", "district", [f("otp_cure_rate")], { thresholds: ["cure-75"], sort: "VALUE_ASC", w: 12 }),
      bars("TSFP cure rate by province", "province", [f("tsfp_cure_rate")], { thresholds: ["tsfp-cure-75"] }),
      line("OTP cured and defaulted by month", "month", [f("otp_cured"), f("otp_defaulted")]),
      table("OTP performance by district", ["province", "district"], [f("otp_exits"), f("otp_cure_rate"), f("otp_death_rate"), f("otp_default_rate")]),
    ] },
    { key: "plw", title: "Pregnant and lactating women", blocks: [
      slicer("Province", "province"), slicer("Month", "month"),
      card("PLW admitted", [f("plw_admissions")]), card("PLW identified", [f("plw_mam_identified")]),
      bars("PLW admitted by province", "province", [f("plw_admissions")]),
      line("PLW admitted by month", "month", [f("plw_admissions")]),
    ] },
    { key: "iycf", title: "Infant and young child feeding", blocks: [
      slicer("Province", "province"), slicer("Month", "month"),
      card("Sessions", [f("iycf_sessions")]), card("Caretakers counselled", [f("iycf_caretakers")]),
      bars("Caretakers counselled by province", "province", [f("iycf_caretakers")]),
      line("Sessions by month", "month", [f("iycf_sessions")]),
    ] },
    { key: "micronutrients", title: "Micronutrients", blocks: [
      slicer("Province", "province"), slicer("Month", "month"),
      { type: "VISUAL", family: "PIE", title: "Children given MNP, by sex", w: 4, h: 4, wells: { VALUES: [f("mmn_boys"), f("mmn_girls")] } },
      bars("Women given MMN and IFA, by province", "province", [f("mmn_women"), f("ifa_women")], { w: 8 }),
    ] },
    { key: "supplies", title: "Supplies and pipeline", blocks: [
      slicer("Province", "province"), slicer("Month", "month"),
      bars("RUTF received and used, by province", "province", [f("rutf_received"), f("rutf_used")]),
      line("RUTF used by month", "month", [f("rutf_used")]),
      table("Supplies by district", ["district"], [f("rutf_received"), f("rutf_used"), f("rusf_received"), f("rusf_used"), f("f75_used"), f("f100_used")]),
      note("Balances are levels on the last day of a month and are never added across months: compare them month by month."),
    ] },
    { key: "completeness", title: "Data completeness", blocks: [
      { type: "COMPLETENESS", title: "Districts reporting, by province and month", w: 12, h: 5, roles: { unit: "district", group: "province" } },
      table("Partner presence by district", ["district"], [f("partner", "COUNT_DISTINCT"), f("month", "COUNT_DISTINCT")]),
    ] },
    { key: "drivers", title: "What differs", blocks: [
      { type: "DRIVERS", title: "Where the OTP cure rate differs", w: 12, h: 5, roles: { outcome: "otp_cure_rate", unit: "district", candidates: ["partner", "province", "donor"] } },
    ] },
  ],
  templateRoles: ["province", "district", "month", "partner", "donor", "children_screened", "women_screened", "sam_identified", "mam_identified", "otp_admissions", "otp_admissions_boys", "otp_admissions_girls", "sc_admissions", "tsfp_admissions", "plw_admissions", "otp_exits", "otp_cured", "otp_died", "otp_defaulted", "otp_nonresponse", "otp_moved", "tsfp_exits", "tsfp_cured", "tsfp_died", "tsfp_defaulted", "iycf_sessions", "iycf_caretakers", "mmn_boys", "mmn_girls", "mmn_women", "ifa_women", "rutf_opening", "rutf_received", "rutf_used", "rutf_balance"],
};
