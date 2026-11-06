/**
 * The country names a setup document may write (Phase 37.4): one list of English short names with the other spellings people
 * use (official names, French and Spanish, common abbreviations). `recogniseCountry` gives the list's name for a written one
 * or null — a province, a city or a currency is never a country here. `countriesInText` finds the names written in a text,
 * by whole words. Pure; no geography beyond the name.
 */

/** [name, ...other spellings]. Lower-case, accent-free matching; the first entry is the name shown and stored. */
export const COUNTRY_NAMES: ReadonlyArray<readonly string[]> = [
  ["Afghanistan"], ["Albania"], ["Algeria", "Algérie", "Argelia"], ["Angola"], ["Argentina"], ["Armenia"], ["Australia"], ["Austria"],
  ["Azerbaijan"], ["Bangladesh"], ["Belarus"], ["Belgium", "Belgique"], ["Belize"], ["Benin", "Bénin"], ["Bhutan"], ["Bolivia"],
  ["Bosnia and Herzegovina", "Bosnia"], ["Botswana"], ["Brazil", "Brasil", "Brésil"], ["Bulgaria"], ["Burkina Faso"], ["Burundi"],
  ["Cabo Verde", "Cape Verde"], ["Cambodia", "Cambodge"], ["Cameroon", "Cameroun", "Camerún"], ["Canada"],
  ["Central African Republic", "CAR", "République centrafricaine"], ["Chad", "Tchad"], ["Chile"], ["China"], ["Colombia", "Colombie"],
  ["Comoros"], ["Congo", "Republic of the Congo", "Congo-Brazzaville"],
  ["Democratic Republic of the Congo", "DRC", "DR Congo", "RDC", "République démocratique du Congo", "Congo-Kinshasa"],
  ["Costa Rica"], ["Côte d'Ivoire", "Ivory Coast", "Cote d'Ivoire"], ["Croatia"], ["Cuba"], ["Cyprus"], ["Czechia", "Czech Republic"],
  ["Denmark"], ["Djibouti"], ["Dominican Republic", "República Dominicana"], ["Ecuador"], ["Egypt", "Égypte", "Egipto"],
  ["El Salvador"], ["Equatorial Guinea"], ["Eritrea", "Érythrée"], ["Estonia"], ["Eswatini", "Swaziland"], ["Ethiopia", "Éthiopie", "Etiopía"],
  ["Fiji"], ["Finland"], ["France"], ["Gabon"], ["Gambia", "The Gambia"], ["Georgia"], ["Germany", "Allemagne", "Alemania"], ["Ghana"],
  ["Greece"], ["Guatemala"], ["Guinea", "Guinée"], ["Guinea-Bissau", "Guinée-Bissau"], ["Guyana"], ["Haiti", "Haïti", "Haití"],
  ["Honduras"], ["Hungary"], ["India", "Inde"], ["Indonesia", "Indonésie"], ["Iran"], ["Iraq", "Irak"], ["Ireland"], ["Israel"],
  ["Italy", "Italie"], ["Jamaica"], ["Japan"], ["Jordan", "Jordanie"], ["Kazakhstan"], ["Kenya"], ["Kiribati"], ["Kosovo"],
  ["Kuwait"], ["Kyrgyzstan", "Kyrgyz Republic"], ["Laos", "Lao PDR", "Lao People's Democratic Republic"], ["Latvia"],
  ["Lebanon", "Liban", "Líbano"], ["Lesotho"], ["Liberia"], ["Libya", "Libye"], ["Lithuania"], ["Madagascar"], ["Malawi"],
  ["Malaysia"], ["Maldives"], ["Mali"], ["Mauritania", "Mauritanie"], ["Mauritius"], ["Mexico", "México", "Mexique"], ["Moldova"],
  ["Mongolia"], ["Montenegro"], ["Morocco", "Maroc", "Marruecos"], ["Mozambique"], ["Myanmar", "Burma"], ["Namibia"], ["Nepal"],
  ["Netherlands", "Holland"], ["New Zealand"], ["Nicaragua"], ["Niger"], ["Nigeria"], ["North Korea", "DPRK"], ["North Macedonia"],
  ["Norway"], ["Oman"], ["Pakistan"], ["Palestine", "State of Palestine", "occupied Palestinian territory", "oPt", "West Bank and Gaza"],
  ["Panama", "Panamá"], ["Papua New Guinea", "PNG"], ["Paraguay"], ["Peru", "Perú", "Pérou"], ["Philippines", "Filipinas"],
  ["Poland"], ["Portugal"], ["Qatar"], ["Romania"], ["Russia", "Russian Federation"], ["Rwanda"], ["Samoa"],
  ["Sao Tome and Principe", "São Tomé and Príncipe"], ["Saudi Arabia"], ["Senegal", "Sénégal"], ["Serbia"], ["Sierra Leone"],
  ["Solomon Islands"], ["Somalia", "Somalie"], ["South Africa"], ["South Korea", "Republic of Korea"], ["South Sudan", "Soudan du Sud"],
  ["Spain", "España", "Espagne"], ["Sri Lanka"], ["Sudan", "Soudan", "Sudán"], ["Suriname"], ["Sweden"], ["Switzerland", "Suisse"],
  ["Syria", "Syrian Arab Republic", "Syrie"], ["Tajikistan"], ["Tanzania", "United Republic of Tanzania"], ["Thailand"],
  ["Timor-Leste", "East Timor"], ["Togo"], ["Tonga"], ["Trinidad and Tobago"], ["Tunisia", "Tunisie", "Túnez"], ["Türkiye", "Turkey", "Turquie"],
  ["Turkmenistan"], ["Tuvalu"], ["Uganda", "Ouganda"], ["Ukraine", "Ucrania"], ["United Arab Emirates", "UAE"],
  ["United Kingdom", "UK", "Great Britain", "Royaume-Uni"], ["United States", "United States of America", "USA", "États-Unis", "Estados Unidos"],
  ["Uruguay"], ["Uzbekistan"], ["Vanuatu"], ["Venezuela"], ["Viet Nam", "Vietnam"], ["Yemen", "Yémen"], ["Zambia", "Zambie"], ["Zimbabwe"],
];

const fold = (t: string): string => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[’']/g, "'").replace(/\s+/g, " ").trim();

const BY_SPELLING: ReadonlyMap<string, string> = new Map(COUNTRY_NAMES.flatMap((names) => names.map((n) => [fold(n), names[0]!] as const)));

/** Spellings that are words of other things too ("Chad" a name, "Georgia" a US state, "CAR" a car): never found in running text. */
const NOT_IN_TEXT = new Set(["car", "uk", "usa", "png", "opt", "drc", "rdc", "dprk", "uae", "chad", "georgia", "jordan", "niger", "guinea", "congo", "turkey", "holland"]);

/** The list's name for a written country, or null when the words are not a country. */
export function recogniseCountry(written: string | null | undefined): string | null {
  if (!written) return null;
  return BY_SPELLING.get(fold(written.replace(/^the\s+/i, ""))) ?? null;
}

const escape = (t: string): string => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const SEARCH: ReadonlyArray<{ name: string; pattern: RegExp }> = COUNTRY_NAMES.flatMap((names) =>
  names.filter((n) => !NOT_IN_TEXT.has(fold(n))).map((n) => ({ name: names[0]!, pattern: new RegExp(`(?<![\\p{L}])${escape(fold(n))}(?![\\p{L}])`, "u") })),
);

/** The countries a text names in words, in the list's names, each once (longer spellings first, so "South Sudan" is not "Sudan"). */
export function countriesInText(text: string): string[] {
  let folded = fold(text);
  const found: string[] = [];
  for (const { name, pattern } of [...SEARCH].sort((a, b) => b.pattern.source.length - a.pattern.source.length)) {
    if (pattern.test(folded)) {
      if (!found.includes(name)) found.push(name);
      folded = folded.replace(new RegExp(pattern.source, "gu"), " ");
    }
  }
  return found;
}
