import { describe, it, expect, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { BuiltWith } from "@/components/layout/built-with";

vi.mock("@/lib/analytics", () => ({
  analyticsSponsor: { builtWithClick: vi.fn() },
}));

function links(name: string) {
  return screen.getAllByRole("img", { name }).map((img) => img.closest("a"));
}

describe("BuiltWith", () => {
  it("keeps the existing attribution links", () => {
    render(<BuiltWith hosting />);

    for (const [name, href] of [
      ["Devin", "https://devin.ai/?utm_source=prompts.chat"],
      ["Grok Bot", "https://grok.com/?utm_source=prompts.chat"],
      ["Vercel OSS Program", "https://vercel.com/oss"],
    ]) {
      const anchors = links(name);
      expect(anchors).toHaveLength(2);
      for (const a of anchors) {
        expect(a).toHaveAttribute("href", href);
        expect(a).toHaveAttribute("target", "_blank");
        expect(a).toHaveAttribute("rel", "noopener noreferrer");
      }
    }
  });

  it("renders light and dark variants of every logo", () => {
    render(<BuiltWith hosting />);

    for (const name of ["Devin", "Grok Bot", "Vercel OSS Program"]) {
      const [light, dark] = screen.getAllByRole("img", { name });
      expect(light.className).toContain("dark:hidden");
      expect(dark.className).toMatch(/\bhidden\b.*\bdark:block\b/);
    }
  });

  it("keeps each attribution label in the same group as its logo", () => {
    render(<BuiltWith hosting />);

    const devin = screen.getByTestId("built-with-devin");
    expect(within(devin).getAllByRole("img", { name: "Devin" })).toHaveLength(2);
    expect(within(devin).getByText("by Cognition")).toBeInTheDocument();

    const grok = screen.getByTestId("built-with-grok");
    expect(within(grok).getByText("and")).toBeInTheDocument();
    expect(within(grok).getAllByRole("img", { name: "Grok Bot" })).toHaveLength(2);

    const hosting = screen.getByTestId("built-with-hosting");
    expect(within(hosting).getByText("hosted on")).toBeInTheDocument();
    expect(within(hosting).getAllByRole("img", { name: "Vercel OSS Program" })).toHaveLength(2);
  });

  it("does not split multi-word labels into separate flex items", () => {
    render(<BuiltWith hosting />);

    for (const text of ["by", "Cognition", "hosted", "on"]) {
      expect(screen.queryByText(text, { exact: true })).not.toBeInTheDocument();
    }
  });

  it("stacks groups on mobile and only shows the separator from md up", () => {
    render(<BuiltWith hosting />);

    const root = screen.getByTestId("built-with");
    expect(root.className).toMatch(/(^|\s)flex-col(\s|$)/);
    expect(root.className).toContain("md:flex-row");

    const separator = screen.getByTestId("built-with-separator");
    expect(separator).toHaveAttribute("aria-hidden", "true");
    expect(separator.className).toMatch(/(^|\s)hidden(\s|$)/);
    expect(separator.className).toContain("md:inline");
  });

  it("prevents logos from being squeezed by their flex row", () => {
    render(<BuiltWith hosting />);

    for (const img of screen.getAllByRole("img")) {
      expect(img.className).toContain("shrink-0");
      expect(img.className).toContain("w-auto");
    }
  });

  it("omits the hosting credit unless it is enabled", () => {
    render(<BuiltWith hosting={false} />);

    expect(screen.queryByTestId("built-with-hosting")).not.toBeInTheDocument();
    expect(screen.queryByTestId("built-with-separator")).not.toBeInTheDocument();
    expect(screen.getAllByRole("img", { name: "Devin" })).toHaveLength(2);
  });

  it("defaults the hosting credit to NEXT_PUBLIC_HOSTING_BADGE", () => {
    vi.stubEnv("NEXT_PUBLIC_HOSTING_BADGE", "vercel");
    try {
      render(<BuiltWith />);
      expect(screen.getByTestId("built-with-hosting")).toBeInTheDocument();
    } finally {
      vi.unstubAllEnvs();
    }
  });
});
