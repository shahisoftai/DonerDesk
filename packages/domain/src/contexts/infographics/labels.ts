/**
 * Words on the page (Phase 32.10): every fixed string an infographic draws, in the languages the
 * Studio offers. English, French and Spanish are complete and are the UN's own map-disclaimer
 * languages; text a person types is never translated. A key missing in a language falls back to
 * English, and a test fails when a language lacks a key, so a new block cannot ship half-labelled.
 *
 * Arabic is right to left: the composer mirrors the page (block order, alignment) and draws with a bundled Arabic face; numbers
 * stay in Western digits, as United Nations products print them.
 */
export type InfographicLanguage = "en" | "fr" | "es" | "ar";
export const INFOGRAPHIC_LANGUAGES: readonly InfographicLanguage[] = ["en", "fr", "es", "ar"];
export const INFOGRAPHIC_LANGUAGE_LABEL: Readonly<Record<InfographicLanguage, string>> = { en: "English", fr: "Français", es: "Español", ar: "العربية" };

/** Languages written right to left: the page layout mirrors (block order, alignment); charts keep their own direction. */
export const RTL_LANGUAGES: readonly InfographicLanguage[] = ["ar"];
export const isRtl = (language: string | undefined): boolean => (RTL_LANGUAGES as readonly string[]).includes(language ?? "");

export const LABEL_KEYS = [
  "notYetReported", "notPlanned", "notReported", "allPeriods", "reportingPeriod", "pageOf", "data", "indicators",
  "valuesNotVerifiedOne", "valuesNotVerifiedMany", "notYetReportedCount", "generated", "source", "sources",
  "keyFigures", "chart", "resultsByLocation", "locationComparison", "peopleReached", "activitiesByLocation", "whereWeWork", "notes",
  "reachAgainstNeed", "progressAgainstTargets", "whoWeReached", "resultsBySector", "timeline", "keyMessages", "inTheirWords", "notesAndSources", "funding", "trends", "indicatorsTable", "resultsChain",
  "location", "target", "achieved", "percentOfTarget", "uniquePeople", "registeredInTotal", "attendancesNote", "done", "late", "activitiesWithoutLocation", "siteOne", "siteMany", "noPlacedSites",
  "peopleReachedRegisteredUnique", "withoutRecordedLocation", "locationsWithPlanned", "activitiesCompletedOfPlanned", "withoutALocation",
  "balance", "expenditure", "budget", "notVerifiedYet", "financeNotRecorded", "burnRate", "verified",
  "female", "male", "other", "unknown", "sex", "ageGroup", "baseline", "latest", "cumulative", "level", "goal", "outcome", "output", "impact", "activity",
  "legend", "pinOnTime", "pinLate", "pinDone", "pinCancelled", "inNeed", "targeted", "reached", "photoCredit", "approved", "draft", "notAvailable", "ofWhich", "ageUnder5", "age60Plus",
  "portfolioSummary", "portfolioTable", "portfolioHealth", "portfolioCountries", "threeW", "who", "what", "project", "country", "donor", "health", "nextReport", "projectsWord", "countriesWord", "onTrack", "atRisk", "offTrack", "noPlan", "openRisks", "reportsOverdue", "asAt", "partnersCount", "highRisks",
] as const;
export type InfographicLabelKey = (typeof LABEL_KEYS)[number];
export type InfographicLabels = Readonly<Record<InfographicLabelKey, string>>;

const EN: InfographicLabels = {
  notYetReported: "Not yet reported", notPlanned: "Not planned", notReported: "Not reported", allPeriods: "All periods", reportingPeriod: "Reporting period", pageOf: "Page {n} of {m}",
  data: "Data", indicators: "Indicators", valuesNotVerifiedOne: "{n} value not yet verified", valuesNotVerifiedMany: "{n} values not yet verified", notYetReportedCount: "{n} not yet reported", generated: "Generated", source: "Source", sources: "Sources",
  keyFigures: "Key figures", chart: "Chart", resultsByLocation: "Results by location", locationComparison: "Location comparison", peopleReached: "People reached", activitiesByLocation: "Activities by location", whereWeWork: "Where we work", notes: "Notes",
  reachAgainstNeed: "Reach against need", progressAgainstTargets: "Progress against targets", whoWeReached: "Who we reached", resultsBySector: "Results by sector", timeline: "Timeline", keyMessages: "Key messages", inTheirWords: "In their words", notesAndSources: "Notes and sources", funding: "Funding", trends: "Trends", indicatorsTable: "Indicators", resultsChain: "Results chain",
  location: "Location", target: "Target", achieved: "Achieved", percentOfTarget: "% of target", uniquePeople: "unique people", registeredInTotal: "registered in total", attendancesNote: "attendances (a person may attend several)", done: "done", late: "late", activitiesWithoutLocation: "activities without a recorded location", siteOne: "site", siteMany: "sites", noPlacedSites: "no placed sites yet",
  peopleReachedRegisteredUnique: "People reached (registered, unique)", withoutRecordedLocation: "without a recorded location", locationsWithPlanned: "Locations with planned activities", activitiesCompletedOfPlanned: "Activities completed of planned", withoutALocation: "without a location",
  balance: "Balance", expenditure: "Expenditure", budget: "Budget", notVerifiedYet: "Not verified yet", financeNotRecorded: "Finance not recorded", burnRate: "Burn rate", verified: "verified",
  female: "Female", male: "Male", other: "Other", unknown: "Not stated", sex: "Sex", ageGroup: "Age group", baseline: "Baseline", latest: "Latest", cumulative: "To date", level: "Level", goal: "Goal", outcome: "Outcomes", output: "Outputs", impact: "Impact", activity: "Activities",
  legend: "Legend", pinOnTime: "On time", pinLate: "Late", pinDone: "Done", pinCancelled: "Cancelled", inNeed: "In need", targeted: "Targeted", reached: "Reached", photoCredit: "Photo", approved: "Approved", draft: "Draft", notAvailable: "n/a", ofWhich: "of which", ageUnder5: "Under 5", age60Plus: "60 and over",
  portfolioSummary: "Portfolio at a glance", portfolioTable: "Projects", portfolioHealth: "Delivery health", portfolioCountries: "Projects by country", threeW: "Who does what, where", who: "Who", what: "What", project: "Project", country: "Country", donor: "Donor", health: "Health", nextReport: "Next report", projectsWord: "Projects", countriesWord: "Countries", onTrack: "On track", atRisk: "Needs attention", offTrack: "Behind", noPlan: "No plan yet", openRisks: "Open risks", reportsOverdue: "Reports overdue", asAt: "As at", partnersCount: "organizations", highRisks: "High risks",
};

const FR: InfographicLabels = {
  notYetReported: "Pas encore communiqué", notPlanned: "Non prévu", notReported: "Non communiqué", allPeriods: "Toutes les périodes", reportingPeriod: "Période de rapport", pageOf: "Page {n} sur {m}",
  data: "Données", indicators: "Indicateurs", valuesNotVerifiedOne: "{n} valeur non encore vérifiée", valuesNotVerifiedMany: "{n} valeurs non encore vérifiées", notYetReportedCount: "{n} pas encore communiqué(s)", generated: "Généré le", source: "Source", sources: "Sources",
  keyFigures: "Chiffres clés", chart: "Graphique", resultsByLocation: "Résultats par lieu", locationComparison: "Comparaison des lieux", peopleReached: "Personnes atteintes", activitiesByLocation: "Activités par lieu", whereWeWork: "Où nous travaillons", notes: "Notes",
  reachAgainstNeed: "Couverture par rapport aux besoins", progressAgainstTargets: "Progrès par rapport aux cibles", whoWeReached: "Qui nous avons atteint", resultsBySector: "Résultats par secteur", timeline: "Chronologie", keyMessages: "Messages clés", inTheirWords: "Dans leurs mots", notesAndSources: "Notes et sources", funding: "Financement", trends: "Tendances", indicatorsTable: "Indicateurs", resultsChain: "Chaîne de résultats",
  location: "Lieu", target: "Cible", achieved: "Atteint", percentOfTarget: "% de la cible", uniquePeople: "personnes uniques", registeredInTotal: "enregistrées au total", attendancesNote: "participations (une personne peut participer plusieurs fois)", done: "réalisées", late: "en retard", activitiesWithoutLocation: "activités sans lieu enregistré", siteOne: "site", siteMany: "sites", noPlacedSites: "aucun site placé pour l'instant",
  peopleReachedRegisteredUnique: "Personnes atteintes (enregistrées, uniques)", withoutRecordedLocation: "sans lieu enregistré", locationsWithPlanned: "Lieux avec des activités prévues", activitiesCompletedOfPlanned: "Activités réalisées sur prévues", withoutALocation: "sans lieu",
  balance: "Solde", expenditure: "Dépenses", budget: "Budget", notVerifiedYet: "Pas encore vérifié", financeNotRecorded: "Finances non enregistrées", burnRate: "Taux de consommation", verified: "vérifié",
  female: "Femmes", male: "Hommes", other: "Autre", unknown: "Non précisé", sex: "Sexe", ageGroup: "Groupe d'âge", baseline: "Référence", latest: "Dernière valeur", cumulative: "À ce jour", level: "Niveau", goal: "But", outcome: "Effets", output: "Produits", impact: "Impact", activity: "Activités",
  legend: "Légende", pinOnTime: "Dans les temps", pinLate: "En retard", pinDone: "Terminé", pinCancelled: "Annulé", inNeed: "Dans le besoin", targeted: "Ciblées", reached: "Atteintes", photoCredit: "Photo", approved: "Approuvé", draft: "Brouillon", notAvailable: "n/d", ofWhich: "dont", ageUnder5: "Moins de 5 ans", age60Plus: "60 ans et plus",
  portfolioSummary: "Le portefeuille en un coup d'œil", portfolioTable: "Projets", portfolioHealth: "Avancement de la mise en œuvre", portfolioCountries: "Projets par pays", threeW: "Qui fait quoi, où", who: "Qui", what: "Quoi", project: "Projet", country: "Pays", donor: "Bailleur", health: "État", nextReport: "Prochain rapport", projectsWord: "Projets", countriesWord: "Pays", onTrack: "Dans les temps", atRisk: "À surveiller", offTrack: "En retard", noPlan: "Pas encore de plan", openRisks: "Risques ouverts", reportsOverdue: "Rapports en retard", asAt: "Au", partnersCount: "organisations", highRisks: "Risques élevés",
};

const ES: InfographicLabels = {
  notYetReported: "Aún no informado", notPlanned: "No previsto", notReported: "No informado", allPeriods: "Todos los períodos", reportingPeriod: "Período del informe", pageOf: "Página {n} de {m}",
  data: "Datos", indicators: "Indicadores", valuesNotVerifiedOne: "{n} valor aún sin verificar", valuesNotVerifiedMany: "{n} valores aún sin verificar", notYetReportedCount: "{n} aún no informado(s)", generated: "Generado el", source: "Fuente", sources: "Fuentes",
  keyFigures: "Cifras clave", chart: "Gráfico", resultsByLocation: "Resultados por lugar", locationComparison: "Comparación de lugares", peopleReached: "Personas alcanzadas", activitiesByLocation: "Actividades por lugar", whereWeWork: "Dónde trabajamos", notes: "Notas",
  reachAgainstNeed: "Alcance frente a la necesidad", progressAgainstTargets: "Avance frente a las metas", whoWeReached: "A quién alcanzamos", resultsBySector: "Resultados por sector", timeline: "Cronología", keyMessages: "Mensajes clave", inTheirWords: "En sus palabras", notesAndSources: "Notas y fuentes", funding: "Financiación", trends: "Tendencias", indicatorsTable: "Indicadores", resultsChain: "Cadena de resultados",
  location: "Lugar", target: "Meta", achieved: "Logrado", percentOfTarget: "% de la meta", uniquePeople: "personas únicas", registeredInTotal: "registradas en total", attendancesNote: "asistencias (una persona puede asistir varias veces)", done: "realizadas", late: "con retraso", activitiesWithoutLocation: "actividades sin lugar registrado", siteOne: "sitio", siteMany: "sitios", noPlacedSites: "aún no hay sitios ubicados",
  peopleReachedRegisteredUnique: "Personas alcanzadas (registradas, únicas)", withoutRecordedLocation: "sin lugar registrado", locationsWithPlanned: "Lugares con actividades previstas", activitiesCompletedOfPlanned: "Actividades realizadas de las previstas", withoutALocation: "sin lugar",
  balance: "Saldo", expenditure: "Gasto", budget: "Presupuesto", notVerifiedYet: "Aún sin verificar", financeNotRecorded: "Finanzas no registradas", burnRate: "Ritmo de gasto", verified: "verificado",
  female: "Mujeres", male: "Hombres", other: "Otro", unknown: "No indicado", sex: "Sexo", ageGroup: "Grupo de edad", baseline: "Línea de base", latest: "Último", cumulative: "Hasta la fecha", level: "Nivel", goal: "Fin", outcome: "Resultados", output: "Productos", impact: "Impacto", activity: "Actividades",
  legend: "Leyenda", pinOnTime: "A tiempo", pinLate: "Con retraso", pinDone: "Terminado", pinCancelled: "Cancelado", inNeed: "Con necesidad", targeted: "Meta de atención", reached: "Alcanzadas", photoCredit: "Foto", approved: "Aprobado", draft: "Borrador", notAvailable: "n/d", ofWhich: "de las cuales", ageUnder5: "Menos de 5 años", age60Plus: "60 años o más",
  portfolioSummary: "La cartera de un vistazo", portfolioTable: "Proyectos", portfolioHealth: "Estado de la ejecución", portfolioCountries: "Proyectos por país", threeW: "Quién hace qué, dónde", who: "Quién", what: "Qué", project: "Proyecto", country: "País", donor: "Donante", health: "Estado", nextReport: "Próximo informe", projectsWord: "Proyectos", countriesWord: "Países", onTrack: "Al día", atRisk: "Requiere atención", offTrack: "Con retraso", noPlan: "Aún sin plan", openRisks: "Riesgos abiertos", reportsOverdue: "Informes atrasados", asAt: "Al", partnersCount: "organizaciones", highRisks: "Riesgos altos",
};

const AR: InfographicLabels = {
  notYetReported: "لم يُبلَّغ عنه بعد", notPlanned: "غير مخطط", notReported: "غير مُبلَّغ", allPeriods: "كل الفترات", reportingPeriod: "فترة الإبلاغ", pageOf: "صفحة {n} من {m}",
  data: "البيانات", indicators: "المؤشرات", valuesNotVerifiedOne: "{n} قيمة لم يُتحقق منها بعد", valuesNotVerifiedMany: "{n} قيم لم يُتحقق منها بعد", notYetReportedCount: "{n} لم يُبلَّغ عنها بعد", generated: "أُنشئ في", source: "المصدر", sources: "المصادر",
  keyFigures: "أرقام رئيسية", chart: "رسم بياني", resultsByLocation: "النتائج حسب الموقع", locationComparison: "مقارنة المواقع", peopleReached: "الأشخاص الذين تم الوصول إليهم", activitiesByLocation: "الأنشطة حسب الموقع", whereWeWork: "أين نعمل", notes: "ملاحظات",
  reachAgainstNeed: "التغطية مقابل الاحتياج", progressAgainstTargets: "التقدم نحو الأهداف", whoWeReached: "من وصلنا إليهم", resultsBySector: "النتائج حسب القطاع", timeline: "الجدول الزمني", keyMessages: "رسائل رئيسية", inTheirWords: "بكلماتهم", notesAndSources: "ملاحظات ومصادر", funding: "التمويل", trends: "الاتجاهات", indicatorsTable: "المؤشرات", resultsChain: "سلسلة النتائج",
  location: "الموقع", target: "الهدف", achieved: "المنجز", percentOfTarget: "% من الهدف", uniquePeople: "شخص فريد", registeredInTotal: "مسجّلون إجمالاً", attendancesNote: "مشاركات (قد يشارك الشخص أكثر من مرة)", done: "منفذة", late: "متأخرة", activitiesWithoutLocation: "أنشطة بلا موقع مسجّل", siteOne: "موقع", siteMany: "مواقع", noPlacedSites: "لا توجد مواقع محددة بعد",
  peopleReachedRegisteredUnique: "الأشخاص الذين تم الوصول إليهم (مسجّلون، فريدون)", withoutRecordedLocation: "بلا موقع مسجّل", locationsWithPlanned: "مواقع فيها أنشطة مخططة", activitiesCompletedOfPlanned: "الأنشطة المنجزة من المخطط", withoutALocation: "بلا موقع",
  balance: "الرصيد", expenditure: "الإنفاق", budget: "الميزانية", notVerifiedYet: "لم يُتحقق منه بعد", financeNotRecorded: "لا توجد بيانات مالية مسجّلة", burnRate: "معدل الإنفاق", verified: "تم التحقق",
  female: "إناث", male: "ذكور", other: "أخرى", unknown: "غير محدد", sex: "الجنس", ageGroup: "الفئة العمرية", baseline: "خط الأساس", latest: "الأحدث", cumulative: "حتى الآن", level: "المستوى", goal: "الغاية", outcome: "النتائج", output: "المخرجات", impact: "الأثر", activity: "الأنشطة",
  legend: "مفتاح الخريطة", pinOnTime: "في الموعد", pinLate: "متأخر", pinDone: "منجز", pinCancelled: "ملغى", inNeed: "بحاجة", targeted: "مستهدفون", reached: "تم الوصول إليهم", photoCredit: "الصورة", approved: "معتمد", draft: "مسودة", notAvailable: "غير متاح", ofWhich: "منهم", ageUnder5: "دون 5 سنوات", age60Plus: "60 سنة فأكثر",
  portfolioSummary: "نظرة عامة على المحفظة", portfolioTable: "المشاريع", portfolioHealth: "حالة التنفيذ", portfolioCountries: "المشاريع حسب البلد", threeW: "من يفعل ماذا وأين", who: "من", what: "ماذا", project: "المشروع", country: "البلد", donor: "الجهة المانحة", health: "الحالة", nextReport: "التقرير القادم", projectsWord: "المشاريع", countriesWord: "البلدان", onTrack: "على المسار", atRisk: "يحتاج إلى متابعة", offTrack: "متأخر", noPlan: "لا توجد خطة بعد", openRisks: "مخاطر مفتوحة", reportsOverdue: "تقارير متأخرة", asAt: "حتى", partnersCount: "منظمات", highRisks: "مخاطر عالية",
};

export const INFOGRAPHIC_LABELS: Readonly<Record<InfographicLanguage, InfographicLabels>> = { en: EN, fr: FR, es: ES, ar: AR };

export function resolveLanguage(value: string | undefined): InfographicLanguage {
  return value === "fr" || value === "es" || value === "ar" ? value : "en";
}

export function labelsFor(language: string | undefined): InfographicLabels {
  return INFOGRAPHIC_LABELS[resolveLanguage(language)];
}

/** `{n}`-style substitution used by plural-aware labels. */
export function fill(template: string, values: Readonly<Record<string, string | number>>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => (key in values ? String(values[key]) : `{${key}}`));
}

const NUMBER_LOCALE: Readonly<Record<InfographicLanguage, string>> = { en: "en-US", fr: "fr-FR", es: "es-ES", ar: "ar-u-nu-latn" };
const DATE_LOCALE: Readonly<Record<InfographicLanguage, string>> = { en: "en-GB", fr: "fr-FR", es: "es-ES", ar: "ar-u-nu-latn" };

/** Rounding conventions for headline figures: coordination snapshots round numbers that keep changing. */
export type InfographicRounding = "NONE" | "HUNDREDS" | "THOUSANDS";
export const INFOGRAPHIC_ROUNDINGS: readonly InfographicRounding[] = ["NONE", "HUNDREDS", "THOUSANDS"];

export function formatNumber(value: number, language: string | undefined, rounding: InfographicRounding = "NONE"): string {
  const step = rounding === "THOUSANDS" ? 1000 : rounding === "HUNDREDS" ? 100 : 1;
  const rounded = step > 1 && Math.abs(value) >= step ? Math.round(value / step) * step : value;
  return rounded.toLocaleString(NUMBER_LOCALE[resolveLanguage(language)]);
}

export function formatDate(iso: string, language: string | undefined): string {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return iso;
  return parsed.toLocaleDateString(DATE_LOCALE[resolveLanguage(language)], { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}

/** The translated default heading for a section kind, or `fallback` when the kind has none. Kept here so `alt-text` need not import templates. */
export function SECTION_LABELS_FOR_ALT(kind: string, language: string | undefined, fallback: string): string {
  const l = labelsFor(language);
  const map: Record<string, keyof InfographicLabels | undefined> = {
    KPIS: "keyFigures", BIG_NUMBERS: "keyFigures", CHART: "chart", LOCATION_RESULTS: "resultsByLocation", LOCATION_COMPARISON: "locationComparison", REACH: "peopleReached",
    ACTIVITIES_BY_LOCATION: "activitiesByLocation", MAP: "whereWeWork", TEXT: "notes", FUNNEL: "reachAgainstNeed", PROGRESS_RINGS: "progressAgainstTargets", DEMOGRAPHICS: "whoWeReached",
    SECTOR_GRID: "resultsBySector", TIMELINE: "timeline", KEY_MESSAGES: "keyMessages", QUOTE: "inTheirWords", LEGEND_NOTES: "notesAndSources", FUNDING: "funding",
    SMALL_MULTIPLES: "trends", TABLE: "indicatorsTable", RESULTS_CHAIN: "resultsChain",
    PORTFOLIO_SUMMARY: "portfolioSummary", PORTFOLIO_TABLE: "portfolioTable", PORTFOLIO_HEALTH: "portfolioHealth", PORTFOLIO_COUNTRIES: "portfolioCountries", THREE_W: "threeW",
  };
  const key = map[kind];
  return key ? l[key] : kind === "HERO" || kind === "IMAGE" || kind === "BANNER" || kind === "DIVIDER" ? "" : fallback;
}

// ------------------------------------------------------------- template-seeded captions

/**
 * The fixed captions a template seeds into a new design's number and funnel-stage blocks (Phase
 * 32 templates.ts: `num(...)`, `{ label: "People in need" }` and similar). These are stored as
 * ordinary text in the design's config — a person can retype them, like a headline — so changing
 * "Language of the fixed words" does not touch officer-typed text. But a caption nobody has edited
 * yet is still the template's own English default, not something the person wrote, so it is
 * re-seeded in the newly chosen language when it still matches one of these known defaults
 * exactly; anything already edited (so no longer an exact match) is left alone.
 */
const SEED_CAPTIONS: ReadonlyArray<Readonly<Record<InfographicLanguage, string>>> = [
  { en: "People reached", fr: "Personnes atteintes", es: "Personas alcanzadas", ar: "الأشخاص الذين تم الوصول إليهم" },
  { en: "People registered", fr: "Personnes enregistrées", es: "Personas registradas", ar: "الأشخاص المسجّلون" },
  { en: "People targeted", fr: "Personnes ciblées", es: "Personas objetivo", ar: "الأشخاص المستهدفون" },
  { en: "People in need", fr: "Personnes dans le besoin", es: "Personas necesitadas", ar: "الأشخاص المحتاجون" },
  { en: "Activities completed", fr: "Activités réalisées", es: "Actividades realizadas", ar: "الأنشطة المنجزة" },
  { en: "Activities planned", fr: "Activités prévues", es: "Actividades previstas", ar: "الأنشطة المخططة" },
  { en: "Approved budget", fr: "Budget approuvé", es: "Presupuesto aprobado", ar: "الميزانية المعتمدة" },
  { en: "Verified expenditure", fr: "Dépenses vérifiées", es: "Gasto verificado", ar: "الإنفاق الموثّق" },
  { en: "Balance", fr: "Solde", es: "Saldo", ar: "الرصيد" },
];

const seedCaptionRow = (label: string): Readonly<Record<InfographicLanguage, string>> | undefined =>
  SEED_CAPTIONS.find((row) => INFOGRAPHIC_LANGUAGES.some((lang) => row[lang] === label));

/** `label` translated to `language` if it is still exactly one of the template's own seed captions in any offered language; otherwise `label` unchanged (an officer's own edit is never touched). */
export function reseedCaption(label: string, language: InfographicLanguage): string {
  return seedCaptionRow(label)?.[language] ?? label;
}

/**
 * Re-seeds every number and funnel-stage caption in `sections` that still matches a template
 * default, into `language`. Called when a person switches the design's language; sections the
 * person has already retyped (so no longer an exact match) pass through unchanged. Sections of any
 * other kind, and every other field, are untouched — this only ever rewrites `label` strings.
 */
export function reseedSectionCaptions<
  S extends { kind: string; numbers?: ReadonlyArray<{ label: string }>; stages?: ReadonlyArray<{ label: string }> },
>(sections: readonly S[], language: InfographicLanguage): S[] {
  return sections.map((section) => {
    if (section.kind === "BIG_NUMBERS" && section.numbers?.length) {
      return { ...section, numbers: section.numbers.map((item) => ({ ...item, label: reseedCaption(item.label, language) })) };
    }
    if (section.kind === "FUNNEL" && section.stages?.length) {
      return { ...section, stages: section.stages.map((stage) => ({ ...stage, label: reseedCaption(stage.label, language) })) };
    }
    return section;
  });
}
