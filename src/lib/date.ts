import { formatDistanceToNow as dateFnsFormatDistanceToNow, format as dateFnsFormat, type Locale } from "date-fns";
import { enUS, tr, es, zhCN, ja, arSA, ptBR, fr, it, de, nl, ko, ru, he, el, faIR, az } from "date-fns/locale";

const locales: Record<string, Locale> = {
  en: enUS,
  tr: tr,
  es: es,
  zh: zhCN,
  ja: ja,
  ar: arSA,
  pt: ptBR,
  fr: fr,
  it: it,
  de: de,
  nl: nl,
  ko: ko,
  ru: ru,
  he: he,
  el: el,
  fa: faIR,
  az: az,
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
