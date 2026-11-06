/**
 * The sector glossary (Phase 45, plan 8.6): one agreed word per term and language, so "indicator" is not "indicateur" on one screen
 * and "mesure" on the next. Terms follow the published wording of UN and OCHA multilingual glossaries and the app's existing
 * screens. There is no native reviewer yet: this table is what a reviewer will be handed first, and `GLOSSARY_USE` is what the
 * test holds every new label to. A form lists every spelling a label may use (plural and definite forms in Arabic).
 */
import type { Locale } from "../domain/locales.ts";

export type GlossaryTerm = "indicator" | "project" | "portfolio" | "activity" | "map" | "table" | "chart" | "funding" | "resultsChain" | "sector";

export const GLOSSARY: Readonly<Record<GlossaryTerm, Readonly<Record<Locale, readonly string[]>>>> = {
  indicator: { en: ["indicator"], fr: ["indicateur"], es: ["indicador"], ar: ["مؤشر"] },
  project: { en: ["project"], fr: ["projet"], es: ["proyecto"], ar: ["مشروع", "مشاريع"] },
  portfolio: { en: ["portfolio"], fr: ["portefeuille"], es: ["cartera"], ar: ["محفظة"] },
  activity: { en: ["activit"], fr: ["activité"], es: ["actividad"], ar: ["نشاط", "أنشطة", "الأنشطة"] },
  map: { en: ["map"], fr: ["carte"], es: ["mapa"], ar: ["خريطة", "خرائط", "الخرائط"] },
  table: { en: ["table"], fr: ["tableau"], es: ["tabla"], ar: ["جدول", "جداول", "الجداول"] },
  chart: { en: ["chart"], fr: ["graphique"], es: ["gráfico"], ar: ["رسم بياني", "رسوم بيانية", "الرسوم البيانية"] },
  funding: { en: ["funding"], fr: ["financement"], es: ["financiación"], ar: ["تمويل"] },
  resultsChain: { en: ["results chain"], fr: ["chaîne de résultats"], es: ["cadena de resultados"], ar: ["سلسلة النتائج"] },
  sector: { en: ["sector"], fr: ["secteur"], es: ["sector"], ar: ["قطاع"] },
};

/** Which message keys must carry which term. A new label that names a sector term is added here so it cannot drift. */
export const GLOSSARY_USE: Readonly<Record<string, readonly GlossaryTerm[]>> = {
  "canvas.block.KPI": ["indicator"],
  "canvas.block.CHART": ["chart"],
  "canvas.block.SMALL_MULTIPLES": ["chart"],
  "canvas.block.MAP": ["map"],
  "canvas.block.TABLE": ["table"],
  "canvas.block.PROJECT_LIST": ["project"],
  "canvas.block.FUNDING": ["funding"],
  "canvas.block.RESULTS_CHAIN": ["resultsChain"],
  "canvas.block.SECTOR_GRID": ["sector"],
  "canvas.block.ACTIVITIES_BY_LOCATION": ["activity"],
  "canvas.block.PORTFOLIO_SUMMARY": ["portfolio"],
  "canvas.block.PORTFOLIO_TABLE": ["portfolio", "table"],
  "canvas.block.PORTFOLIO_HEALTH": ["portfolio"],
  "canvas.family.CHARTS": ["chart"],
  "canvas.family.MAPS": ["map"],
  "canvas.family.TABLES": ["table"],
};
