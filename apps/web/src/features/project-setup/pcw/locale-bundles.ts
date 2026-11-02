import type { Locale } from "@/features/i18n/domain/locales";
import { PCW_ENGLISH, type PcwBundle } from "./copy";
import { PCW_AR } from "./copy-ar";
import { PCW_ES } from "./copy-es";
import { PCW_FR } from "./copy-fr";

const BUNDLES: Record<Locale, PcwBundle> = { en: PCW_ENGLISH, fr: PCW_FR, es: PCW_ES, ar: PCW_AR };

/** The wizard's words in a language (English when a language has none). */
export const pcwBundle = (locale: Locale): PcwBundle => BUNDLES[locale] ?? PCW_ENGLISH;
