import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ConnectorBadge } from "@/components/bots/connector-badge";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string, values?: { name: string }) =>
    key === "connectorRegistryLink" ? `${values?.name} on the MCP Registry (opens in a new tab)` : key,
}));

describe("ConnectorBadge", () => {
  it("links mapped connectors to their MCP Registry entry in a new tab", () => {
    render(<ConnectorBadge connector="spacefast" />);
    const link = screen.getByRole("link", { name: "spacefast on the MCP Registry (opens in a new tab)" });
    expect(link).toHaveAttribute(
      "href",
      "https://registry.modelcontextprotocol.io/v0.1/servers/io.github.spacefast%2Fmcp/versions/latest"
    );
    expect(link).toHaveAttribute("target", "_blank");
    expect(link.getAttribute("rel")).toContain("noopener");
    expect(link).toHaveTextContent("spacefast");
    expect(link.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
  });

  it("renders unmapped connectors as plain badges", () => {
    const { container } = render(<ConnectorBadge connector="Gmail" />);
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.getByText("Gmail")).toBeInTheDocument();
    expect(container.querySelector("svg")).toBeNull();
  });
});
