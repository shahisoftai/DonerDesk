/**
 * Interface languages (Phase 33.10). The interface can be shown in English, French, Spanish and Arabic; Arabic reads right to left.
 * Pure: which language a request wants is decided here from what it carries, never from a clock or a network call.
 */
export const LOCALES = ["en", "fr", "es", "ar"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "en";

/** The name of each language in that language, for the switcher (a person looks for their own language by its own name). */
export const LOCALE_NAME: Readonly<Record<Locale, string>> = { en: "English", fr: "Français", es: "Español", ar: "العربية" };

export const RTL_LOCALES: ReadonlySet<Locale> = new Set<Locale>(["ar"]);

export const LOCALE_COOKIE = "dd-locale";

export const isLocale = (value: unknown): value is Locale => typeof value === "string" && (LOCALES as readonly string[]).includes(value);

export const localeDirection = (locale: Locale): "ltr" | "rtl" => (RTL_LOCALES.has(locale) ? "rtl" : "ltr");

/** The best match for an Accept-Language header ("fr-CH,fr;q=0.9,en;q=0.8"), or null when none of its languages is offered. */
export function localeFromAcceptLanguage(header: string | null | undefined): Locale | null {
  if (!header) return null;
  const ranked = header
    .split(",")
    .map((part, index) => {
      const [tag = "", ...params] = part.trim().split(";");
      const q = Number(params.find((p) => p.trim().startsWith("q="))?.split("=")[1] ?? "1");
      return { tag: tag.trim().toLowerCase(), q: Number.isFinite(q) ? q : 0, index };
    })
    .filter((x) => x.tag && x.q > 0)
    .sort((a, b) => b.q - a.q || a.index - b.index);
  for (const { tag } of ranked) {
    const base = tag.split("-")[0];
    if (isLocale(base)) return base;
  }
  return null;
}

/**
 * Which language to show: the person's own choice (the cookie) first, then the organisation's default language when it is one we
 * offer, then the browser's preference, then English. A choice that is not one of ours is ignored, never trusted.
 */
export function resolveLocale(input: { cookie?: string | null | undefined; organisationDefault?: string | null | undefined; acceptLanguage?: string | null | undefined }): Locale {
  if (isLocale(input.cookie)) return input.cookie;
  if (isLocale(input.organisationDefault)) return input.organisationDefault;
  return localeFromAcceptLanguage(input.acceptLanguage) ?? DEFAULT_LOCALE;
}
