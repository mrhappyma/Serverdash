import { i18n } from "typesafe-i18n";
import { Locale } from "discord.js";
import en_US from "./base/en-US.json";
import en_GB from "./translations/es-GB.json";
import es_ES from "./translations/es-ES.json";

const base = en_US;

const translations = {
  [Locale.EnglishUS]: base,
  [Locale.EnglishGB]: en_GB,
  [Locale.SpanishES]: es_ES,
};

export type SupportedLocale = keyof typeof translations | Locale.EnglishUS;
export const SupportedLocales = [
  ...(Object.keys(translations) as Locale[]),
  Locale.EnglishUS,
];

// set all missing translations to the base locale. then new object with all the locales as the full type
const localeTranslations = Object.keys(translations).reduce((acc, locale) => {
  const translation = translations[locale as keyof typeof translations];
  acc[locale as SupportedLocale] = {
    ...base,
    ...translation,
  };
  return acc;
}, {} as Record<SupportedLocale, typeof base & (typeof translations)[SupportedLocale]>);

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
