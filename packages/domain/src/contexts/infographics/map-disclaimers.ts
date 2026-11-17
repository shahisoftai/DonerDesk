/**
 * Map disclaimers (Phase 32.5). A map in a United Nations-style product carries the standard
 * disclaimer; a few borders also need a note that their status is not settled. The texts below are
 * the wording the coordination community uses in its map products; they are required text, not
 * artwork, and the Studio never draws an authoritative boundary of its own (it draws pins).
 *
 * The note rules match on the project's country name (free text, folded and trimmed) so "Sudan",
 * "Republic of the Sudan" and "sudan " all find the Sudan notes.
 */
import type { InfographicLanguage } from "./labels.js";

export const UN_MAP_DISCLAIMER: Readonly<Record<InfographicLanguage, string>> = {
  en: "The boundaries and names shown and the designations used on this map do not imply official endorsement or acceptance by the United Nations.",
  fr: "Les frontières et les noms indiqués et les désignations employées sur cette carte n'impliquent pas reconnaissance ou acceptation officielle par l'Organisation des Nations Unies.",
  es: "Los límites y los nombres y las designaciones que figuran en este mapa no implican su apoyo o aceptación oficial por las Naciones Unidas.",
  ar: "إن الحدود والأسماء المبينة والتسميات المستخدمة في هذه الخريطة لا تعني الموافقة أو القبول الرسميين من قبل الأمم المتحدة.",
};

interface BorderNote {
  id: string;
  /** Folded country-name fragments that trigger the note. */
  countries: readonly string[];
  text: Readonly<Record<InfographicLanguage, string>>;
}

export const BORDER_NOTES: readonly BorderNote[] = [
  {
    id: "JAMMU_KASHMIR",
    countries: ["india", "pakistan"],
    text: {
      en: "Dotted line represents approximately the Line of Control in Jammu and Kashmir agreed upon by India and Pakistan. The final status of Jammu and Kashmir has not yet been agreed upon by the parties.",
      fr: "La ligne en pointillé correspond approximativement à la Ligne de contrôle du Jammu et Cachemire dont ont convenu l'Inde et le Pakistan. Les parties n'ont pas encore convenu du statut définitif du Jammu et Cachemire.",
      es: "La línea de puntos representa aproximadamente la Línea de Control en Jammu y Cachemira convenida por la India y el Pakistán. Las partes no han llegado todavía a un acuerdo sobre el estatuto definitivo de Jammu y Cachemira.",
      ar: "يمثل الخط المنقط تقريباً خط المراقبة في جامو وكشمير الذي اتفقت عليه الهند وباكستان. ولم يتفق الطرفان بعد على الوضع النهائي لجامو وكشمير.",
    },
  },
  {
    id: "SUDAN_SOUTH_SUDAN",
    countries: ["sudan", "south sudan"],
    text: {
      en: "Final boundary between the Republic of Sudan and the Republic of South Sudan has not yet been determined.",
      fr: "La frontière entre la République du Soudan et la République du Soudan du Sud n'a pas été déterminée.",
      es: "Las fronteras definitivas entre la República del Sudán y la República de Sudán del Sur no se han determinado todavía.",
      ar: "لم يتم بعد تحديد الحدود النهائية بين جمهورية السودان وجمهورية جنوب السودان.",
    },
  },
  {
    id: "ABYEI",
    countries: ["sudan", "south sudan"],
    text: {
      en: "Final status of the Abyei area is not yet determined.",
      fr: "Le statut définitif de la zone d'Abyei n'a pas encore été fixé.",
      es: "La condición jurídica definitiva de la zona de Abyei aún no se ha determinado.",
      ar: "لم يتم بعد تحديد الوضع النهائي لمنطقة أبيي.",
    },
  },
  {
    id: "WESTERN_SAHARA",
    countries: ["western sahara", "morocco"],
    text: {
      en: "The final status of Western Sahara has not yet been determined.",
      fr: "Le statut définitif du Sahara occidental n'a pas encore été déterminé.",
      es: "La situación definitiva del Sáhara Occidental aún no se ha determinado.",
      ar: "لم يتحدد بعد الوضع النهائي للصحراء الغربية.",
    },
  },
  {
    id: "KOSOVO",
    countries: ["kosovo", "serbia"],
    text: {
      en: "References to Kosovo shall be understood to be in the context of Security Council resolution 1244 (1999).",
      fr: "Toute référence au Kosovo doit être comprise dans le contexte de la résolution 1244 (1999) du Conseil de sécurité.",
      es: "Toda referencia a Kosovo debe entenderse en el contexto de la resolución 1244 (1999) del Consejo de Seguridad.",
      ar: "يجب أن تُفهم أي إشارة إلى كوسوفو في سياق قرار مجلس الأمن 1244 (1999).",
    },
  },
  {
    id: "FALKLANDS_MALVINAS",
    countries: ["falkland islands", "malvinas", "argentina"],
    text: {
      en: "A dispute exists between the Governments of Argentina and the United Kingdom of Great Britain and Northern Ireland concerning sovereignty over the Falkland Islands (Malvinas).",
      fr: "Un différend oppose le Gouvernement argentin et le Gouvernement du Royaume-Uni de Grande-Bretagne et d'Irlande du Nord au sujet de la souveraineté sur les îles Falkland (Malvinas).",
      es: "Existe una controversia entre los Gobiernos de la Argentina y del Reino Unido de Gran Bretaña e Irlanda del Norte acerca de la soberanía sobre las Islas Malvinas (Falkland).",
      ar: "ثمة نزاع بين حكومتي الأرجنتين والمملكة المتحدة لبريطانيا العظمى وأيرلندا الشمالية حول السيادة على جزر فوكلاند (مالفيناس).",
    },
  },
];

const fold = (value: string): string =>
  value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\b(republic of( the)?|the|democratic)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/** The border notes that apply to a project country, in the requested language. */
export function borderNotesFor(country: string | undefined, language: InfographicLanguage): Array<{ id: string; text: string }> {
  if (!country) return [];
  const folded = fold(country);
  if (!folded) return [];
  const words = ` ${folded} `;
  return BORDER_NOTES.filter((note) => note.countries.some((fragment) => words.includes(` ${fragment} `))).map((note) => ({ id: note.id, text: note.text[language] }));
}

/** The lines a map must carry: the UN disclaimer first, then any border notes. */
export function mapDisclaimerLines(country: string | undefined, language: InfographicLanguage): string[] {
  return [UN_MAP_DISCLAIMER[language], ...borderNotesFor(country, language).map((note) => note.text)];
}
