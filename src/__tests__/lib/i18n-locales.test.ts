import { describe, expect, it } from "vitest";
import { localeMetadata, kidsLocaleMetadata, supportedLocales, getLocaleMetadata, getBookPdfLocale } from "@/lib/i18n/locales";
import { detectLocaleFromHeader, normalizeRequestedLocale } from "@/lib/i18n/locale-resolution";

describe("locale metadata", () => {
  it("includes zh and zh-TW with the expected labels", () => {
    expect(getLocaleMetadata("zh")).toMatchObject({ code: "zh", label: "简体中文" });
    expect(getLocaleMetadata("zh-TW")).toMatchObject({ code: "zh-TW", label: "繁體中文" });
  });

  it("exposes zh-TW as a supported locale", () => {
    expect(supportedLocales).toContain("zh-TW");
    expect(localeMetadata.map((locale) => locale.code)).toContain("zh-TW");
  });

  it("limits kids locales to locales with translated content", () => {
    expect(kidsLocaleMetadata.map((locale) => locale.code)).toContain("zh-TW");
    expect(kidsLocaleMetadata.map((locale) => locale.code)).not.toContain("he");
  });

  it("uses dedicated zh-TW book PDF assets when available", () => {
    expect(getBookPdfLocale("zh-TW")).toBe("zh-TW");
    expect(getBookPdfLocale("en")).toBe("en");
  });
});

describe("locale resolution", () => {
  it("maps traditional Chinese variants to zh-TW", () => {
    expect(normalizeRequestedLocale("zh-TW")).toBe("zh-TW");
    expect(normalizeRequestedLocale("zh-HK")).toBe("zh-TW");
    expect(normalizeRequestedLocale("zh-Hant")).toBe("zh-TW");
    expect(normalizeRequestedLocale("zh-Hant-TW")).toBe("zh-TW");
  });

  it("maps simplified Chinese variants to zh", () => {
    expect(normalizeRequestedLocale("zh-CN")).toBe("zh");
    expect(normalizeRequestedLocale("zh-Hans")).toBe("zh");
    expect(normalizeRequestedLocale("zh-SG")).toBe("zh");
    expect(normalizeRequestedLocale("zh-Hans-CN")).toBe("zh");
  });

  it("detects zh-TW before falling back to base zh", () => {
    expect(detectLocaleFromHeader("zh-TW,zh;q=0.9,en;q=0.8")).toBe("zh-TW");
    expect(detectLocaleFromHeader("zh-HK,zh;q=0.9,en;q=0.8")).toBe("zh-TW");
    expect(detectLocaleFromHeader("zh-Hant-TW,zh;q=0.9,en;q=0.8")).toBe("zh-TW");
    expect(detectLocaleFromHeader("zh-Hans,zh;q=0.9,en;q=0.8")).toBe("zh");
  });
});
