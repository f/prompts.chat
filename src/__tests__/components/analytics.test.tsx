import type { ReactNode } from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { Analytics } from "@/components/layout/analytics";

vi.mock("next/script", () => ({
  default: ({ id, src, children }: { id?: string; src?: string; children?: ReactNode }) => (
    <div data-testid={id ?? "external-script"} data-src={src}>
      {children}
    </div>
  ),
}));

describe("Analytics", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("does not inject Google Analytics before cookie consent is accepted", async () => {
    render(<Analytics gaId="G-TEST" />);

    await waitFor(() => {
      expect(screen.queryByTestId("external-script")).not.toBeInTheDocument();
      expect(screen.queryByTestId("google-analytics")).not.toBeInTheDocument();
    });
  });

  it("does not inject Google Analytics when cookie consent was rejected", async () => {
    localStorage.setItem("cookie-consent", "rejected");

    render(<Analytics gaId="G-TEST" />);

    await waitFor(() => {
      expect(screen.queryByTestId("external-script")).not.toBeInTheDocument();
      expect(screen.queryByTestId("google-analytics")).not.toBeInTheDocument();
    });
  });

  it("injects Google Analytics after cookie consent is accepted", async () => {
    localStorage.setItem("cookie-consent", "accepted");

    render(<Analytics gaId="G-TEST" />);

    await waitFor(() => {
      expect(screen.getByTestId("external-script")).toHaveAttribute(
        "data-src",
        "https://www.googletagmanager.com/gtag/js?id=G-TEST",
      );
    });
    expect(screen.getByTestId("google-analytics").textContent).toContain("G-TEST");
  });
});
