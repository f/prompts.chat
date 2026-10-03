import { formatDistanceToNow as dateFnsFormatDistanceToNow, format as dateFnsFormat, type Locale } from "date-fns";
import { enUS, tr, es, zhCN, zhTW, ja, arSA } from "date-fns/locale";

const locales: Record<string, Locale> = {
  en: enUS,
  tr: tr,
  es: es,
  zh: zhCN,
  "zh-TW": zhTW,
  ja: ja,
  ar: arSA,
};

export function getDateLocale(locale: string): Locale {
  return locales[locale] || enUS;
}

export function formatDistanceToNow(date: Date | string, locale: string = "en"): string {
  const dateObj = typeof date === "string" ? new Date(date) : date;
  return dateFnsFormatDistanceToNow(dateObj, {
    addSuffix: true,
    locale: getDateLocale(locale),
  });
}

export function formatDate(date: Date | string, formatStr: string, locale: string = "en"): string {
  const dateObj = typeof date === "string" ? new Date(date) : date;
  return dateFnsFormat(dateObj, formatStr, {
    locale: getDateLocale(locale),
  });
}
