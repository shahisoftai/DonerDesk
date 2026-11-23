import type { Locale } from "../domain/locales.ts";
import type { Messages } from "../domain/translate.ts";
import { en } from "./en.ts";
import { fr } from "./fr.ts";
import { es } from "./es.ts";
import { ar } from "./ar.ts";
import { ur } from "./ur.ts";
import { ps } from "./ps.ts";

export type { MessageKey } from "./en.ts";

/** Every language's messages. English is the source and the fallback. */
export const MESSAGES: Readonly<Record<Locale, Messages>> = { en, fr, es, ar, ur, ps };
export const ENGLISH: Messages = en;
