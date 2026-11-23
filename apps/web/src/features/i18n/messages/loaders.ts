import type { Locale } from "../domain/locales.ts";
import type { Messages } from "../domain/translate.ts";

/**
 * Fetches one language's dictionary only when it is used. Each is a separate file of about 75 KB, so a visitor reading English (and every
 * public page, which is English until a person chooses another language) never downloads the other three.
 */
export const LOADERS: Readonly<Record<Exclude<Locale, "en">, () => Promise<Messages>>> = {
  fr: () => import("./fr.ts").then((m) => m.fr),
  es: () => import("./es.ts").then((m) => m.es),
  ar: () => import("./ar.ts").then((m) => m.ar),
  ur: () => import("./ur.ts").then((m) => m.ur),
  ps: () => import("./ps.ts").then((m) => m.ps),
};
