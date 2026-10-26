// Cookie name for storing locale preference
export const LOCALE_COOKIE = "NEXT_LOCALE";

// Supported locales - keep in sync with prompts.config.ts
export const supportedLocales = ["en", "tr", "es", "zh-tw", "zh", "ja", "ar", "pt", "fr", "it", "de", "nl", "ko", "ru", "he", "el", "az", "fa"];
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
