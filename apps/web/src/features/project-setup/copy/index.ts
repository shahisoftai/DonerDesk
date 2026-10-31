import type { Locale } from "../../i18n/domain/locales.ts";
import { ar } from "./ar.ts";
import { en } from "./en.ts";
import { es } from "./es.ts";
import { fr } from "./fr.ts";
import type { SetupCopy } from "./types.ts";

export type { AreaKey, Guidance, ProblemCode, FieldKey, SetupCopy } from "./types.ts";

/** Every language's wording for the wizard. English is the source and the fallback. */
export const SETUP_COPY_BY_LOCALE: Readonly<Record<Locale, SetupCopy>> = { en, fr, es, ar };
export const copyFor = (locale: Locale): SetupCopy => SETUP_COPY_BY_LOCALE[locale] ?? en;
