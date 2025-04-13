import { i18n } from "typesafe-i18n";
import { Locale, LocalizationMap } from "discord.js";
import en_US from "./languages/en-US.json";
import en_GB from "./languages/en-GB.json";
import es_ES from "./languages/es-ES.json";
import nl from "./languages/nl.json";

const base = en_US;
export const eng = Locale.EnglishUS;

export const translations = {
  [Locale.EnglishUS]: base,
  [Locale.EnglishGB]: en_GB,
  [Locale.SpanishES]: es_ES,
  [Locale.Dutch]: nl,
};

export type SupportedLocale = keyof typeof translations | Locale.EnglishUS;
export const SupportedLocales = Object.keys(translations) as Locale[];

function deepMerge<T extends Record<string, any>>(
  base: T,
  override: Partial<T>
): T {
  const result: Record<string, any> = { ...base };

  for (const key in override) {
    if (
      key in base &&
      typeof base[key] === "object" &&
      typeof override[key] === "object" &&
      !Array.isArray(base[key]) &&
      !Array.isArray(override[key])
    ) {
      result[key] = deepMerge(base[key], override[key]);
    } else if (override[key] !== undefined) {
      result[key] = override[key];
    }
  }

  return result as T;
}

const localeTranslations = Object.keys(translations).reduce((acc, locale) => {
  const translation = translations[locale as keyof typeof translations];
  //@ts-ignore
  acc[locale as SupportedLocale] = deepMerge(base, translation);
  return acc;
}, {} as Record<SupportedLocale, typeof base>);

const initFormatters = (locale: SupportedLocale) => {
  return {
    //custom formatters could go here
  };
};

// Create formatters for each locale
const formatters = Object.keys(localeTranslations).reduce((acc, locale) => {
  acc[locale as SupportedLocale] = initFormatters(locale as SupportedLocale);
  return acc;
}, {} as Record<SupportedLocale, ReturnType<typeof initFormatters>>);

const L = i18n(localeTranslations, formatters);
export default L;

//magic copilot typescript bullshit- WOW

// Type to represent dot notation paths in nested objects
type PathsToStringProps<T> = T extends object
  ? {
      [K in keyof T & string]: T[K] extends object
        ? `${K}.${PathsToStringProps<T[K]>}` | K
        : K;
    }[keyof T & string]
  : never;

// Nested key type that allows accessing properties with dot notation
type TranslationKey = PathsToStringProps<typeof en_US> | keyof typeof en_US;

/**
 * Gets a value from an object using a dot-notation path
 */
function getNestedValue<T>(obj: T, path: string): any {
  // For top-level keys, access directly without splitting
  if (!path.includes(".")) {
    return (obj as any)[path];
  }

  // For nested paths, use the existing logic
  return path
    .split(".")
    .reduce(
      (prev, curr) =>
        prev && typeof prev === "object" ? prev[curr] : undefined,
      obj as any
    );
}

export const localizationMap = (key: TranslationKey): LocalizationMap =>
  Object.fromEntries(
    Object.entries(translations).map(([locale, translation]) => [
      locale,
      String(
        getNestedValue(translation, key) || getNestedValue(en_US, key) || key
      ),
    ])
  );
