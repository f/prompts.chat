export interface LocaleMetadata {
  code: string;
  label: string;
  sortOrder: number;
  flag?: string;
}

export const localeMetadata: LocaleMetadata[] = [
  { code: "en", label: "English", sortOrder: 1, flag: "🇺🇸" },
  { code: "zh", label: "简体中文", sortOrder: 2 },
  { code: "zh-TW", label: "繁體中文", sortOrder: 3 },
  { code: "es", label: "Español", sortOrder: 4, flag: "🇪🇸" },
  { code: "pt", label: "Português", sortOrder: 5, flag: "🇧🇷" },
  { code: "fr", label: "Français", sortOrder: 6, flag: "🇫🇷" },
  { code: "de", label: "Deutsch", sortOrder: 7, flag: "🇩🇪" },
  { code: "nl", label: "Dutch", sortOrder: 8, flag: "🇳🇱" },
  { code: "it", label: "Italiano", sortOrder: 9, flag: "🇮🇹" },
  { code: "ja", label: "日本語", sortOrder: 10, flag: "🇯🇵" },
  { code: "tr", label: "Türkçe", sortOrder: 11, flag: "🇹🇷" },
  { code: "az", label: "Azərbaycan dili", sortOrder: 12, flag: "🇦🇿" },
  { code: "ko", label: "한국어", sortOrder: 13, flag: "🇰🇷" },
  { code: "ar", label: "العربية", sortOrder: 14, flag: "🇸🇦" },
  { code: "fa", label: "فارسی", sortOrder: 15, flag: "🇮🇷" },
  { code: "ru", label: "Русский", sortOrder: 16, flag: "🇷🇺" },
  { code: "he", label: "עברית", sortOrder: 17 },
  { code: "el", label: "Ελληνικά", sortOrder: 18, flag: "🇬🇷" },
];

export const supportedLocales = localeMetadata
  .slice()
  .sort((a, b) => a.sortOrder - b.sortOrder)
  .map((locale) => locale.code);

const kidsSupportedLocaleCodes = new Set([
  "en",
  "zh",
  "zh-TW",
  "es",
  "pt",
  "fr",
  "de",
  "nl",
  "it",
  "ja",
  "tr",
  "az",
  "ko",
  "ar",
  "fa",
  "ru",
  "el",
]);

const bookPdfLocaleAliases: Record<string, string> = {};

export const kidsLocaleMetadata = localeMetadata.filter((locale) =>
  kidsSupportedLocaleCodes.has(locale.code)
);

export function getLocaleMetadata(code: string): LocaleMetadata | undefined {
  return localeMetadata.find((locale) => locale.code === code);
}

export function getBookPdfLocale(locale: string): string {
  return bookPdfLocaleAliases[locale] ?? locale;
}
