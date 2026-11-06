"use client";

import { Globe } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { setLocale } from "@/lib/i18n/client";

const languages = [
  { code: "en", name: "English" },
  { code: "zh", name: "中文" },
  { code: "zh-tw", name: "繁體中文" },
  { code: "es", name: "Español" },
  { code: "pt", name: "Português" },
  { code: "fr", name: "Français" },
  { code: "de", name: "Deutsch" },
  { code: "nl", name: "Dutch" },
  { code: "it", name: "Italiano" },
  { code: "ja", name: "日本語" },
  { code: "tr", name: "Türkçe" },
  { code: "az", name: "Azərbaycan dili" },
  { code: "ko", name: "한국어" },
  { code: "ar", name: "العربية" },
  { code: "fa", name: "فارسی" },
  { code: "ru", name: "Русский" },
  { code: "he", name: "עברית" },
  { code: "el", name: "Ελληνικά" }
];

export function LanguageSwitcher() {
  const t = useTranslations("settings");

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Globe className="h-4 w-4" />
          <span className="text-sm">{t("language")}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="max-h-[300px] overflow-y-auto">
        {languages.map((lang) => (
          <DropdownMenuItem
            key={lang.code}
            onClick={() => setLocale(lang.code)}
          >
            {lang.name}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
