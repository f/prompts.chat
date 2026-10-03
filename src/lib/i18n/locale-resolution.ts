import { supportedLocales } from "./locales";

const traditionalChinesePrefixes = ["zh-tw", "zh-hk", "zh-mo", "zh-hant"];
const simplifiedChinesePrefixes = ["zh-cn", "zh-sg", "zh-hans"];

function hasLocalePrefix(locale: string, prefixes: string[]): boolean {
  return prefixes.some((prefix) => locale === prefix || locale.startsWith(`${prefix}-`));
}

export function normalizeRequestedLocale(locale: string): string | null {
  const normalized = locale.trim().toLowerCase();
  if (!normalized) return null;

  if (hasLocalePrefix(normalized, traditionalChinesePrefixes)) {
    return "zh-TW";
  }

  if (hasLocalePrefix(normalized, simplifiedChinesePrefixes)) {
    return "zh";
  }

  const exactMatch = supportedLocales.find(
    (supportedLocale) => supportedLocale.toLowerCase() === normalized
  );
  if (exactMatch) {
    return exactMatch;
  }

  const baseLocale = normalized.split("-")[0];
  if (baseLocale === "zh") {
    return "zh";
  }

  return supportedLocales.find((supportedLocale) => supportedLocale === baseLocale) ?? null;
}

/**
 * Parse Accept-Language header and find the best matching supported locale.
 */
export function detectLocaleFromHeader(acceptLanguage: string | null): string | null {
  if (!acceptLanguage) return null;

  const languages = acceptLanguage
    .split(",")
    .map((part) => {
      const [lang, qPart] = part.trim().split(";");
      const q = qPart ? parseFloat(qPart.split("=")[1]) : 1;
      return { lang: lang.trim(), q };
    })
    .sort((a, b) => b.q - a.q);

  for (const { lang } of languages) {
    const detectedLocale = normalizeRequestedLocale(lang);
    if (detectedLocale) {
      return detectedLocale;
    }
  }

  return null;
}
