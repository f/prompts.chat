import { getRequestConfig } from "next-intl/server";
import { cookies, headers } from "next/headers";
import { LOCALE_COOKIE, supportedLocales, defaultLocale } from "@/lib/i18n/config";
import { IntlErrorCode } from "next-intl";

/**
 * Parse Accept-Language header and find the best matching supported locale
 * e.g., "ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7" -> "ru" if supported
 */
function detectLocaleFromHeader(acceptLanguage: string | null): string | null {
  if (!acceptLanguage) return null;
  
  // Parse Accept-Language header into array of {lang, q} sorted by quality
  const languages = acceptLanguage
    .split(",")
    .map((part) => {
      const [lang, qPart] = part.trim().split(";");
      const q = qPart ? parseFloat(qPart.split("=")[1]) : 1;
      return { lang: lang.trim().toLowerCase(), q };
    })
    .sort((a, b) => b.q - a.q);
  
  // Find first matching supported locale
  for (const { lang } of languages) {
    // Try full locale match first (e.g., "zh-tw" -> "zh-tw")
    if (supportedLocales.includes(lang)) {
      return lang;
    }
    // Then fall back to base locale (e.g., "en-us" -> "en")
    const baseLocale = lang.split("-")[0];
    if (supportedLocales.includes(baseLocale)) {
      return baseLocale;
    }
  }
  
  return null;
}

export default getRequestConfig(async () => {
  const cookieStore = await cookies();
  const headerStore = await headers();
  
  // 1. Check for saved locale preference in cookie
  let locale = cookieStore.get(LOCALE_COOKIE)?.value;
  
  // 2. If no cookie, detect from browser's Accept-Language header
  if (!locale || !supportedLocales.includes(locale)) {
    const acceptLanguage = headerStore.get("accept-language");
    const detected = detectLocaleFromHeader(acceptLanguage);
    if (detected) {
      locale = detected;
    } else {
      locale = defaultLocale;
    }
  }
  
  // Load messages for the locale
  let messages;
  try {
    messages = (await import(`@/../messages/${locale}.json`)).default;
  } catch {
    // Fall back to default locale messages
    messages = (await import(`@/../messages/${defaultLocale}.json`)).default;
  }
  
  return {
    locale,
    messages,
    timeZone: "UTC",
    // Handle missing messages gracefully in production
    onError(error) {
      if (error.code === IntlErrorCode.MISSING_MESSAGE) {
        // Log missing messages but don't throw
        console.warn(`Missing translation: ${error.originalMessage}`);
      } else if (error.code === "ENVIRONMENT_FALLBACK" as IntlErrorCode) {
        // Silently ignore environment fallback warnings
      } else {
        console.error(error);
      }
    },
    getMessageFallback({ namespace, key }) {
      return `${namespace}.${key}`;
    },
  };
});
