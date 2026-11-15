"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { DEFAULT_LOCALE, LOCALE_COOKIE, isLocale, localeDirection, type Locale } from "../domain/locales";
import { createTranslator, type Messages, type Translator } from "../domain/translate";
import { ENGLISH_ONLY as ENGLISH } from "../messages/english";
import { LOADERS } from "../messages/loaders";

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
 * opens in the language it was last used in. English is bundled; another language is fetched when it is first used (a page the server
 * already drew in that language hands it over as `initialMessages`, so its first paint matches and nothing flashes).
 */
export function I18nProvider({ initialLocale, initialMessages, children }: { initialLocale: Locale; /** The dictionary of `initialLocale` when it is not English: the server has it already. */ initialMessages?: Messages | undefined; children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale);
  const [loaded, setLoaded] = useState<Partial<Record<Locale, Messages>>>(() => ({ en: ENGLISH, ...(initialLocale !== "en" && initialMessages ? { [initialLocale]: initialMessages } : {}) }));

  /** Makes a language ready, then switches to it. A failed fetch leaves the page as it is (English fills any gap). */
  const switchTo = useCallback(async (next: Locale) => {
    if (next !== "en" && !loaded[next]) {
      try { const dict = await LOADERS[next](); setLoaded((l) => ({ ...l, [next]: dict })); } catch { return; }
    }
    setLocaleState(next);
  }, [loaded]);

  useEffect(() => {
    // The person's cookie wins; otherwise the language the page opened in. Either is fetched when its words are not here yet
    // (a page may open in Arabic without the server handing over the dictionary).
    const target = cookieLocale() ?? locale;
    if (target !== locale || (target !== "en" && !loaded[target])) void switchTo(target);
    // Only on opening: a later change is made through setLocale.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = localeDirection(locale);
  }, [locale]);

  const setLocale = useCallback((next: Locale) => {
    try { document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`; } catch { /* the choice still applies to this visit */ }
    void switchTo(next);
  }, [switchTo]);

  const value = useMemo<I18nValue>(() => ({ ...createTranslator(locale, loaded[locale] ?? ENGLISH, ENGLISH), dir: localeDirection(locale), setLocale }), [locale, loaded, setLocale]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useI18n(): I18nValue {
  const value = useContext(Context);
  // Outside a provider (a test, an isolated render) English is shown rather than failing.
  return value ?? { ...createTranslator(DEFAULT_LOCALE, ENGLISH, ENGLISH), dir: "ltr", setLocale: () => undefined };
}
