import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { getDateLocale, formatDistanceToNow, formatDate } from "@/lib/date";
import { enUS, tr, es, zhCN, zhTW, ja, arSA } from "date-fns/locale";

describe("getDateLocale", () => {
  it("should return enUS for 'en' locale", () => {
    expect(getDateLocale("en")).toBe(enUS);
  });

  it("should return tr for 'tr' locale", () => {
    expect(getDateLocale("tr")).toBe(tr);
  });

  it("should return es for 'es' locale", () => {
    expect(getDateLocale("es")).toBe(es);
  });

  it("should return zhCN for 'zh' locale", () => {
    expect(getDateLocale("zh")).toBe(zhCN);
  });

  it("should return zhTW for 'zh-TW' locale", () => {
    expect(getDateLocale("zh-TW")).toBe(zhTW);
  });

  it("should return ja for 'ja' locale", () => {
    expect(getDateLocale("ja")).toBe(ja);
  });

  it("should return arSA for 'ar' locale", () => {
    expect(getDateLocale("ar")).toBe(arSA);
  });

  it("should return enUS for unknown locale", () => {
    expect(getDateLocale("unknown")).toBe(enUS);
    expect(getDateLocale("fr")).toBe(enUS);
    expect(getDateLocale("de")).toBe(enUS);
  });
});

describe("formatDistanceToNow", () => {
  beforeEach(() => {
    // Mock the current date to ensure consistent test results
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-01-15T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should format a date object relative to now", () => {
    const pastDate = new Date("2024-01-14T12:00:00Z");
    const result = formatDistanceToNow(pastDate);
    expect(result).toContain("day");
    expect(result).toContain("ago");
  });

  it("should format a date string relative to now", () => {
    const pastDateString = "2024-01-14T12:00:00Z";
    const result = formatDistanceToNow(pastDateString);
    expect(result).toContain("day");
    expect(result).toContain("ago");
  });

  it("should format with different locales", () => {
    const pastDate = new Date("2024-01-14T12:00:00Z");

    // English
    const enResult = formatDistanceToNow(pastDate, "en");
    expect(enResult).toContain("ago");

    // Spanish
    const esResult = formatDistanceToNow(pastDate, "es");
    expect(esResult).toContain("hace");

    // Turkish
    const trResult = formatDistanceToNow(pastDate, "tr");
    expect(trResult).toContain("önce");
  });

  it("should handle dates from a week ago", () => {
    const weekAgo = new Date("2024-01-08T12:00:00Z");
    const result = formatDistanceToNow(weekAgo);
    // date-fns may return "7 days ago" instead of "1 week ago"
    expect(result).toMatch(/days?|week/);
    expect(result).toContain("ago");
  });

  it("should handle dates from hours ago", () => {
    const hoursAgo = new Date("2024-01-15T10:00:00Z");
    const result = formatDistanceToNow(hoursAgo);
    expect(result).toContain("hours");
    expect(result).toContain("ago");
  });

  it("should default to en locale when none provided", () => {
    const pastDate = new Date("2024-01-14T12:00:00Z");
    const result = formatDistanceToNow(pastDate);
    expect(result).toContain("ago"); // English suffix
  });
});

describe("formatDate", () => {
  it("should format a date object with the given format string", () => {
    const date = new Date("2024-01-15T12:30:45Z");
    expect(formatDate(date, "yyyy-MM-dd")).toBe("2024-01-15");
  });

  it("should format a date string with the given format string", () => {
    const dateString = "2024-01-15T12:30:45Z";
    expect(formatDate(dateString, "yyyy-MM-dd")).toBe("2024-01-15");
  });

  it("should format with various format strings", () => {
    const date = new Date("2024-06-15T14:30:00Z");

    expect(formatDate(date, "MM/dd/yyyy")).toBe("06/15/2024");
    expect(formatDate(date, "dd.MM.yyyy")).toBe("15.06.2024");
    expect(formatDate(date, "MMMM d, yyyy", "en")).toBe("June 15, 2024");
  });

  it("should format with different locales", () => {
    const date = new Date("2024-06-15T14:30:00Z");

    // English month name
    const enResult = formatDate(date, "MMMM", "en");
    expect(enResult).toBe("June");

    // Spanish month name
    const esResult = formatDate(date, "MMMM", "es");
    expect(esResult).toBe("junio");

    // Turkish month name
    const trResult = formatDate(date, "MMMM", "tr");
    expect(trResult).toBe("Haziran");
  });

  it("should handle time formatting", () => {
    const date = new Date("2024-01-15T14:30:45Z");
    // Test format pattern (timezone-independent)
    expect(formatDate(date, "HH:mm:ss")).toMatch(/^\d{2}:\d{2}:\d{2}$/);
    expect(formatDate(date, "h:mm a", "en")).toMatch(/^\d{1,2}:\d{2} [AP]M$/i);
  });

  it("should default to en locale when none provided", () => {
    const date = new Date("2024-01-15T12:00:00Z");
    const result = formatDate(date, "EEEE"); // Day of week
    expect(result).toBe("Monday");
  });
});
