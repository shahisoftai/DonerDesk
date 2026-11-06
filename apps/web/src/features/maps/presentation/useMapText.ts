"use client";

import { useMemo } from "react";
import { useI18n } from "../../i18n/presentation/I18nProvider";

/**
 * The words every map screen uses: the translator, the level names ("districts", "district") and a refusal said in the person's language.
 * A sentence is never built by joining translated pieces: each is one catalogue message with its values filled in.
 */
export function useMapText() {
  const { t, locale } = useI18n();
  return useMemo(() => ({
    t,
    /** The language of the map's own place names ("en", "fr", "es", "ar"). */
    lang: locale as string,
    levelPlural: (level: number): string => t(`maps.level.${level}`),
    levelSingular: (level: number): string => t(`maps.levelOne.${level}`),
    /** A shape's refusal by its code, with its values; a code nobody has translated yet falls back to the domain's own English sentence. */
    shapeProblem: (code: string, params: Record<string, string | number>, fallback: string): string => {
      const key = `maps.draw.problem.${code}`;
      const said = t(key, params);
      return said === key ? fallback : said;
    },
  }), [t, locale]);
}
