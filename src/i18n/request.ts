import { getRequestConfig } from "next-intl/server";
import { cookies, headers } from "next/headers";
import { LOCALE_COOKIE, supportedLocales, defaultLocale } from "@/lib/i18n/config";
import { detectLocaleFromHeader } from "@/lib/i18n/locale-resolution";
import { IntlErrorCode } from "next-intl";

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
