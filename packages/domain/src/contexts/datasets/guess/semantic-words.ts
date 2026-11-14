/**
 * Header words that suggest what a column means, in English, French, Spanish and Arabic. Data, not code: a new word is a new
 * entry. Administrative-level names cover many countries' words for an area (district, county, woreda, LGA, upazila…).
 */
export const SEMANTIC_HEADER_WORDS: Readonly<Record<string, readonly string[]>> = {
  PLACE: [
    "place", "location", "area", "province", "district", "county", "sub county", "region", "state", "governorate", "department", "municipality",
    "commune", "woreda", "zone", "lga", "upazila", "union", "tehsil", "taluka", "division", "camp", "admin1", "admin2", "admin3", "admin 1", "admin 2",
    "localite", "provincia", "distrito", "municipio", "departamento", "region", "lieu", "محافظة", "منطقة", "مديرية", "المكان",
  ],
  PERIOD: ["month", "period", "reporting month", "report month", "date", "week", "epi week", "year month", "mois", "periode", "mes", "periodo", "fecha", "semaine", "semana", "الشهر", "الفترة", "التاريخ"],
  PARTNER: ["partner", "implementing partner", "ip", "organisation", "organization", "ngo", "agency", "partenaire", "socio", "الشريك"],
  DONOR: ["donor", "funder", "funding", "funding source", "grant", "bailleur", "donante", "financement", "المانح"],
  FACILITY: ["facility", "health facility", "hf", "site", "centre", "center", "school", "clinic", "otp site", "structure", "establecimiento", "المرفق"],
  SEX: ["sex", "gender", "sexe", "genre", "sexo", "الجنس"],
  AGE_GROUP: ["age", "age group", "age band", "tranche d age", "edad", "grupo de edad", "الفئة العمرية"],
  PROGRAMME: ["programme", "program", "service", "intervention", "activity type", "programa", "البرنامج"],
  CURRENCY: ["currency", "devise", "moneda", "العملة"],
};

export const RATE_HEADER_WORDS: readonly string[] = ["rate", "percent", "percentage", "pct", "ratio", "share", "coverage", "taux", "pourcentage", "tasa", "porcentaje", "نسبة", "معدل"];
export const AMOUNT_HEADER_WORDS: readonly string[] = ["amount", "cost", "budget", "expenditure", "spent", "usd", "eur", "value usd", "montant", "cout", "monto", "costo", "المبلغ", "التكلفة"];
/** A figure that is a level on a day, not a flow: added across places but never across periods. Not guessed: confirmed by the person. */
export const LEVEL_HEADER_WORDS: readonly string[] = ["balance", "closing", "opening", "stock on hand", "solde", "saldo"];
