import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import fs from "fs";
import path from "path";

// Render the demo with real book translations for the chosen locale.
let currentLocale = "en";

function bookMessages(locale: string): Record<string, unknown> {
  const file = path.join(process.cwd(), "messages", `${locale}.json`);
  return JSON.parse(fs.readFileSync(file, "utf8")).book.interactive;
}

vi.mock("next-intl", () => ({
  useLocale: () => currentLocale,
  useTranslations: () => (key: string) => {
    const value = bookMessages(currentLocale)[key];
    return typeof value === "string" ? value : key;
  },
}));

import { ContextWindowDemo } from "@/components/book/elements/demos";

// Testing Library collapses whitespace in the page text (including the
// no-break spaces some locales use as digit separators), so do the same here.
const text = (value: string) => value.replace(/\s+/g, " ");

describe("ContextWindowDemo", () => {
  beforeEach(() => {
    currentLocale = "en";
  });

  it("formats numbers and the token unit in the page locale", () => {
    currentLocale = "ru";
    render(<ContextWindowDemo />);

    const tokens = bookMessages("ru").tokens as string;
    const limit = (8000).toLocaleString("ru");

    expect(screen.getByText(text(`${bookMessages("ru").contextWindow}: ${limit} ${tokens}`))).toBeInTheDocument();
    expect(screen.getByText(text(`${(2000).toLocaleString("ru")} ${tokens}`))).toBeInTheDocument();
    expect(screen.getByText(text(`${(1000).toLocaleString("ru")} ${tokens}`))).toBeInTheDocument();
    expect(screen.queryByText(/\btokens\b/)).not.toBeInTheDocument();
  });

  it("does not depend on the runtime's default locale", () => {
    currentLocale = "de";
    render(<ContextWindowDemo />);

    // German groups thousands with a dot, the en-US default with a comma.
    expect(screen.getAllByText("8.000").length).toBeGreaterThan(0);
    expect(screen.queryByText("8,000")).not.toBeInTheDocument();
  });
});
