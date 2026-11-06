import type { Locale } from "./locales.ts";

/**
 * The translator (Phase 33.10): looks a message up by key, fills in `{name}` placeholders and picks the plural form the language
 * needs. A key missing from a language falls back to English, then to the key itself, so a gap shows English instead of breaking a
 * screen. Pure.
 */
export type Messages = Readonly<Record<string, string>>;
export type Params = Readonly<Record<string, string | number>>;

export interface Translator {
  locale: Locale;
  t(key: string, params?: Params): string;
  /** A message with plural forms: `key.one`, `key.other` (and for Arabic `key.zero`, `key.two`, `key.few`, `key.many`). `{count}` is filled in. */
  tp(key: string, count: number, params?: Params): string;
}

const fill = (template: string, params?: Params): string =>
  params ? template.replace(/\{(\w+)\}/g, (whole, name: string) => (name in params ? String(params[name]) : whole)) : template;

export function createTranslator(locale: Locale, messages: Messages, fallback: Messages): Translator {
  const lookup = (key: string): string | undefined => messages[key] ?? fallback[key];
  const rules = new Intl.PluralRules(locale);
  return {
    locale,
    t: (key, params) => fill(lookup(key) ?? key, params),
    tp: (key, count, params) => {
      const category = rules.select(count);
      const template = messages[`${key}.${category}`] ?? messages[`${key}.other`] ?? fallback[`${key}.${new Intl.PluralRules("en").select(count)}`] ?? fallback[`${key}.other`] ?? key;
      return fill(template, { count, ...params });
    },
  };
}

/** The `{placeholders}` a message uses, sorted: every language of a key must use the same ones. */
export const placeholdersOf = (template: string): string[] => [...new Set([...template.matchAll(/\{(\w+)\}/g)].map((m) => m[1]!))].sort();
