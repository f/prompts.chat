import { describe, it, expect, vi } from "vitest";
import { botToMarkdown, botToSkill, toBotView, type BotView } from "@/lib/bots";
import {
  CONNECTOR_REGISTRY,
  connectorToMarkdown,
  getConnectorRegistryEntry,
  getRegistryServerUrl,
} from "@/lib/connectors/registry";

vi.mock("@/lib/db", () => ({ db: {} }));

const BASE = "https://prompts.chat";
const SPACEFAST_REGISTRY_URL =
  "https://registry.modelcontextprotocol.io/v0.1/servers/io.github.spacefast%2Fmcp/versions/latest";

function bot(connectors: string[]): BotView {
  return toBotView({
    id: "b1",
    slug: "publisher",
    title: "Publisher",
    description: null,
    content: "Publish things",
    botPlatform: null,
    botPlatforms: ["HERMES"],
    botIcon: null,
    botColor: null,
    installUrl: null,
    computerRequirements: [],
    botConfig: { routines: [], skills: [], connectors },
    isPrivate: false,
    isUnlisted: false,
    isFeatured: false,
    trendingUntil: null,
    delistReason: null,
    deletedAt: null,
    authorId: "u1",
    createdAt: new Date("2026-10-01"),
    updatedAt: new Date("2026-10-01"),
    author: { username: "alice", name: null, avatar: null, verified: false },
    _count: { votes: 0 },
    category: null,
    tags: [],
  } as never);
}

describe("connector registry", () => {
  it("maps Spacefast to its official MCP Registry entry", () => {
    expect(getConnectorRegistryEntry("Spacefast")).toEqual({
      name: "Spacefast",
      registryName: "io.github.spacefast/mcp",
      registryUrl: SPACEFAST_REGISTRY_URL,
      remoteUrl: "https://mcp.spacefast.com",
      homepage: "https://spacefast.com",
    });
  });

  it("looks connectors up case-insensitively, ignoring surrounding whitespace", () => {
    expect(getConnectorRegistryEntry("spacefast")?.registryName).toBe("io.github.spacefast/mcp");
    expect(getConnectorRegistryEntry("  SPACEFAST ")?.registryName).toBe("io.github.spacefast/mcp");
    expect(getConnectorRegistryEntry("github")?.registryName).toBe("io.github.github/github-mcp-server");
  });

  it("returns null for unmapped connectors", () => {
    expect(getConnectorRegistryEntry("Gmail")).toBeNull();
    expect(getConnectorRegistryEntry("")).toBeNull();
  });

  it("encodes the slash in registry server names", () => {
    expect(getRegistryServerUrl("io.github.spacefast/mcp")).toBe(SPACEFAST_REGISTRY_URL);
  });

  it("has unique names and registry URLs derived from each registry name", () => {
    const names = CONNECTOR_REGISTRY.map((entry) => entry.name.toLowerCase());
    expect(new Set(names).size).toBe(names.length);
    for (const entry of CONNECTOR_REGISTRY) {
      expect(entry.registryUrl).toBe(getRegistryServerUrl(entry.registryName));
      if (entry.remoteUrl) expect(entry.remoteUrl).toMatch(/^https:\/\//);
      if (entry.homepage) expect(entry.homepage).toMatch(/^https:\/\//);
    }
  });

  it("formats mapped connectors as Markdown with the registry link and remote URL", () => {
    expect(connectorToMarkdown("Spacefast")).toBe(
      `- Spacefast ([MCP Registry](${SPACEFAST_REGISTRY_URL}), remote: https://mcp.spacefast.com)`
    );
  });

  it("keeps the connector's own spelling and leaves unmapped connectors plain", () => {
    expect(connectorToMarkdown("spacefast")).toMatch(/^- spacefast \(\[MCP Registry\]/);
    expect(connectorToMarkdown("Gmail")).toBe("- Gmail");
  });
});

describe("bot markdown connectors", () => {
  it("links mapped connectors in the Required connectors section of .md and SKILL.md", () => {
    const publisher = bot(["Spacefast", "Gmail"]);
    const section = [
      "## Required connectors",
      "",
      `- Spacefast ([MCP Registry](${SPACEFAST_REGISTRY_URL}), remote: https://mcp.spacefast.com)`,
      "- Gmail",
    ].join("\n");
    expect(botToMarkdown(publisher, BASE)).toContain(section);
    expect(botToSkill(publisher, BASE)).toContain(section);
  });

  it("omits the section when the bot has no connectors", () => {
    expect(botToMarkdown(bot([]), BASE)).not.toContain("## Required connectors");
  });
});
