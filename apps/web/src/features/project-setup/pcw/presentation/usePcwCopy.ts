"use client";

import { useMemo } from "react";
import { useI18n } from "@/features/i18n/presentation/I18nProvider";
import { pcwBundle } from "../locale-bundles";

/** The wizard's words in the person's language: the copy, the slide names and the sentence for each open requirement. */
export function usePcwCopy() {
  const { locale } = useI18n();
  return useMemo(() => {
    const b = pcwBundle(locale);
    return { c: b.copy, slides: b.slides, sentences: b.sentences, locale };
  }, [locale]);
}
