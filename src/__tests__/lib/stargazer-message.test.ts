import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

// `homepage.beStargazer` is rendered with an `ordinal` value from
// `getOrdinalSuffix()` in `src/app/page.tsx`, which only knows English
// suffixes (st/nd/rd/th). Any other locale that interpolates it shows
// mixed text such as "1.235th", so only English may use it.

const messagesDir = path.join(process.cwd(), "messages");
const locales = fs
  .readdirSync(messagesDir)
  .filter((file) => file.endsWith(".json"))
  .map((file) => file.replace(/\.json$/, ""));

function stargazerMessage(locale: string): string {
  const messages = JSON.parse(fs.readFileSync(path.join(messagesDir, `${locale}.json`), "utf8"));
  return messages.homepage.beStargazer;
}

describe("homepage.beStargazer translations", () => {
  it("covers every locale file", () => {
    expect(locales.length).toBeGreaterThan(1);
  });

  it.each(locales)("%s interpolates the star count", (locale) => {
    expect(stargazerMessage(locale)).toContain("{count}");
  });

  it.each(locales.filter((locale) => locale !== "en"))(
    "%s does not use the English-only {ordinal} suffix",
    (locale) => {
      expect(stargazerMessage(locale)).not.toContain("{ordinal}");
    }
  );
});
