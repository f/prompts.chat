import { supportedLocales } from "./locales";

// Cookie name for storing locale preference
export const LOCALE_COOKIE = "NEXT_LOCALE";
export { supportedLocales };

export const defaultLocale = "en";

// RTL locales
export const rtlLocales = ["ar", "he", "fa"];

// Check if a locale is RTL
export function isRtlLocale(locale: string): boolean {
  return rtlLocales.includes(locale);
}

// Get supported locales
export function getSupportedLocales() {
  return supportedLocales;
}

// Get default locale
export function getDefaultLocale() {
  return defaultLocale;
}
