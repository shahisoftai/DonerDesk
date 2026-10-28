"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { DEFAULT_LOCALE, LOCALE_COOKIE, isLocale, localeDirection, type Locale } from "../domain/locales";
import { createTranslator, type Translator } from "../domain/translate";
import { ENGLISH, MESSAGES } from "../messages";

interface I18nValue extends Translator {
  dir: "ltr" | "rtl";
  setLocale(locale: Locale): void;
}

const Context = createContext<I18nValue | null>(null);

function cookieLocale(): Locale | null {
  try {
    const hit = document.cookie.split("; ").find((c) => c.startsWith(`${LOCALE_COOKIE}=`))?.split("=")[1];
    return isLocale(hit) ? hit : null;
  } catch {
    return null;
  }
}

/**
 * Gives every client component the interface language. The server picks the first language from the request; once the page is open
 * the person's own choice (the cookie, which is also there with no connection) wins, so a page the phone kept for offline use still
 * opens in the language it was last used in. All four dictionaries are small and travel together.
 */
export function I18nProvider({ initialLocale, children }: { initialLocale: Locale; children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale);

  useEffect(() => {
    const chosen = cookieLocale();
    if (chosen && chosen !== locale) setLocaleState(chosen);
    // Only on opening: a later change is made through setLocale.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = localeDirection(locale);
  }, [locale]);

  const setLocale = useCallback((next: Locale) => {
    try { document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`; } catch { /* the choice still applies to this visit */ }
    setLocaleState(next);
  }, []);

  const value = useMemo<I18nValue>(() => ({ ...createTranslator(locale, MESSAGES[locale], ENGLISH), dir: localeDirection(locale), setLocale }), [locale, setLocale]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useI18n(): I18nValue {
  const value = useContext(Context);
  // Outside a provider (a test, an isolated render) English is shown rather than failing.
  return value ?? { ...createTranslator(DEFAULT_LOCALE, ENGLISH, ENGLISH), dir: "ltr", setLocale: () => undefined };
}
