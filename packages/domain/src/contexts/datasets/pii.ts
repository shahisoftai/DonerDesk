import type { CellValue } from "./model.js";
import { headerHas } from "./guess/words.js";
import { isBlank } from "./parse-cells.js";

/**
 * Personal data in a dataset (§8.2). Datasets hold figures, not people: a column that looks like a direct identifier is flagged at
 * upload and removed by default (a recorded tidy step, so it is removed again on every refresh). Detectors are rows: by header in four
 * languages, or by the shape of the values. A detector never decides alone: the person sees the reason and may keep the column only
 * by making the dataset Restricted (administrators, with a lawful basis).
 */
export interface PiiDetector {
  key: string;
  label: string;
  detect(header: string, samples: readonly CellValue[]): string | undefined;
}

const shareMatching = (samples: readonly CellValue[], re: RegExp): number => {
  const present = samples.filter((c) => !isBlank(c));
  return present.length === 0 ? 0 : present.filter((c) => re.test(String(c).trim())).length / present.length;
};

const NAME_WORDS = ["name", "full name", "first name", "last name", "surname", "beneficiary name", "child name", "mother name", "caretaker name", "patient name", "nom", "prenom", "nombre", "apellido", "الاسم", "اسم"];
const PHONE_WORDS = ["phone", "mobile", "telephone", "tel", "cell", "contact number", "whatsapp", "telefono", "celular", "هاتف", "الجوال"];
const ID_WORDS = ["national id", "id number", "id card", "cnic", "nic", "passport", "registration number", "ration card", "unhcr number", "case number", "numero d identite", "cedula", "رقم الهوية"];
const EMAIL_WORDS = ["email", "e mail", "courriel", "correo", "البريد"];
const GPS_WORDS = ["latitude", "longitude", "lat", "lon", "lng", "gps", "coordinates", "household gps"];

/** Words that make a "name" header about a place or a thing, not a person ("District name", "Facility name"). */
const NOT_A_PERSON = ["district", "province", "county", "region", "facility", "site", "school", "village", "partner", "organisation", "organization", "item", "indicator", "programme", "program", "donor", "camp", "state", "health"];

export const PII_DETECTORS: readonly PiiDetector[] = [
  {
    key: "PERSON_NAME",
    label: "people's names",
    detect: (header) => (headerHas(header, NAME_WORDS) && !headerHas(header, NOT_A_PERSON) ? `The header "${header}" looks like people's names.` : undefined),
  },
  {
    key: "PHONE",
    label: "phone numbers",
    detect: (header, samples) => {
      if (headerHas(header, PHONE_WORDS)) return `The header "${header}" looks like phone numbers.`;
      return shareMatching(samples, /^\+?\d[\d\s().-]{8,16}\d$/) >= 0.8 && !samples.every((c) => typeof c === "number" && c < 1e8) ? "The values look like phone numbers." : undefined;
    },
  },
  {
    key: "EMAIL",
    label: "email addresses",
    detect: (header, samples) => (headerHas(header, EMAIL_WORDS) || shareMatching(samples, /^[^\s@]+@[^\s@]+\.[^\s@]+$/) >= 0.5 ? "The values look like email addresses." : undefined),
  },
  {
    key: "ID_NUMBER",
    label: "identity or registration numbers",
    detect: (header) => (headerHas(header, ID_WORDS) ? `The header "${header}" looks like identity or registration numbers.` : undefined),
  },
  {
    key: "EXACT_LOCATION",
    label: "exact locations of households",
    // Four or more decimals is finer than about 10 m; a facility's position is a place, not a person, so only household or plain GPS headers count.
    detect: (header, samples) => (headerHas(header, GPS_WORDS) && !headerHas(header, NOT_A_PERSON) && shareMatching(samples, /^-?\d{1,3}\.\d{4,}$/) >= 0.8 ? "The values are exact coordinates (finer than about 100 m)." : undefined),
  },
];

export interface PiiFinding { columnIndex: number; header: string; detector: string; label: string; reason: string }

export function detectPersonalData(headers: readonly string[], columnSamples: ReadonlyArray<readonly CellValue[]>): PiiFinding[] {
  const out: PiiFinding[] = [];
  headers.forEach((header, i) => {
    for (const d of PII_DETECTORS) {
      const reason = d.detect(header, columnSamples[i] ?? []);
      if (reason) { out.push({ columnIndex: i, header, detector: d.key, label: d.label, reason }); break; }
    }
  });
  return out;
}
