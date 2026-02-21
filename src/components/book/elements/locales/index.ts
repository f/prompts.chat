/**
 * Centralized localized data for book element components.
 * 
 * Usage:
 *   import { getLocaleData } from "./locales";
 *   const data = getLocaleData(locale);
 * 
 * To add a new language:
 *   1. Create a new file (e.g., de.ts) following the structure in en.ts
 *   2. Import and add it to the locales object below
 */

import type { LocaleData } from "./types";
import en from "./en";
import tr from "./tr";
import az from "./az";
import fr from "./fr";
import de from "./de";
import es from "./es";
import it from "./it";
import pt from "./pt";
import ja from "./ja";
import zh from "./zh";
import zhTW from "./zh-tw";
import ko from "./ko";
import ar from "./ar";
import nl from "./nl";
import ru from "./ru";
import el from "./el";
import fa from "./fa";
import he from "./he";

// Re-export types for convenience
export * from "./types";

// All available locales
const locales: Record<string, LocaleData> = {
  en,
  tr,
  az,
  fr,
  de,
  es,
  it,
  pt,
  ja,
  zh,
  "zh-tw": zhTW,
  ko,
  ar,
  nl,
  ru,
  el,
  fa,
  he,
};

/**
 * Get locale data for a specific language.
 * Falls back to English if the locale is not available.
 */
export function getLocaleData(locale: string): LocaleData {
  return locales[locale] || locales.en;
}

/**
 * Get a specific field from locale data.
 * Useful when you only need one piece of data.
 */
export function getLocaleField<K extends keyof LocaleData>(
  locale: string,
  field: K
): LocaleData[K] {
  const data = getLocaleData(locale);
  return data[field];
}

// Export individual locale data for direct access if needed
export { en, tr, az, fr, de, es, it, pt, ja, zh, zhTW, ko, ar, nl, ru, el, fa, he };

// Export the full locales object
export { locales };

// Default export
export default locales;
