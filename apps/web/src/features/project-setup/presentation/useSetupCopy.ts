"use client";

import { useMemo } from "react";
import type { Locale } from "@/features/i18n/domain/locales";
import { useI18n } from "@/features/i18n/presentation/I18nProvider";
import { copyFor, type SetupCopy } from "../copy";

export interface SetupLanguage {
  c: SetupCopy;
  locale: Locale;
  dir: "ltr" | "rtl";
  /** A whole number written the way the language writes it. */
  n: (value: number) => string;
}

/** The wizard's words in the person's language (English when a language has no entry), with its reading direction. */
export function useSetupCopy(): SetupLanguage {
  const { locale, dir } = useI18n();
  return useMemo(() => ({ c: copyFor(locale), locale, dir, n: (value: number) => new Intl.NumberFormat(locale === "ar" ? "ar-u-nu-latn" : locale).format(value) }), [locale, dir]);
}
