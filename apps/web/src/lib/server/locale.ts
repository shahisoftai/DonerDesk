import "server-only";
import { cookies, headers } from "next/headers";
import { LOCALE_COOKIE, resolveLocale, type Locale } from "@/features/i18n/domain/locales";
import { createTranslator, type Translator } from "@/features/i18n/domain/translate";
import { ENGLISH, MESSAGES } from "@/features/i18n/messages";

/** The language this request wants: the person's choice, else the browser's, else English. */
export async function getLocale(): Promise<Locale> {
  const [jar, head] = [await cookies(), await headers()];
  return resolveLocale({ cookie: jar.get(LOCALE_COOKIE)?.value, acceptLanguage: head.get("accept-language") });
}

/** A translator for server components. */
export async function getTranslator(): Promise<Translator> {
  const locale = await getLocale();
  return createTranslator(locale, MESSAGES[locale], ENGLISH);
}
