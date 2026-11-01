/** A connector's entry on the official MCP Registry (registry.modelcontextprotocol.io) */
export interface ConnectorRegistryEntry {
  /** Display name, e.g. "Spacefast" */
  name: string;
  /** Server name on the registry, e.g. "io.github.spacefast/mcp" */
  registryName: string;
  /** The registry's "latest version" API URL for the server */
  registryUrl: string;
  /** Hosted (streamable HTTP) MCP endpoint, when the publisher runs one */
  remoteUrl?: string;
  homepage?: string;
}

const REGISTRY_BASE_URL = "https://registry.modelcontextprotocol.io";

export function getRegistryServerUrl(registryName: string): string {
  return `${REGISTRY_BASE_URL}/v0.1/servers/${encodeURIComponent(registryName)}/versions/latest`;
}

function entry(
  name: string,
  registryName: string,
  details: Pick<ConnectorRegistryEntry, "remoteUrl" | "homepage"> = {}
): ConnectorRegistryEntry {
  return { name, registryName, registryUrl: getRegistryServerUrl(registryName), ...details };
}

/** First-party servers only: each name is the publisher's own, verified on the registry */
export const CONNECTOR_REGISTRY: readonly ConnectorRegistryEntry[] = [
  entry("Spacefast", "io.github.spacefast/mcp", { remoteUrl: "https://mcp.spacefast.com", homepage: "https://spacefast.com" }),
  entry("GitHub", "io.github.github/github-mcp-server", { remoteUrl: "https://api.githubcopilot.com/mcp/", homepage: "https://github.com" }),
  entry("Notion", "com.notion/mcp", { remoteUrl: "https://mcp.notion.com/mcp", homepage: "https://www.notion.com" }),
  entry("Linear", "app.linear/linear", { remoteUrl: "https://mcp.linear.app/mcp", homepage: "https://linear.app" }),
  entry("Sentry", "io.github.getsentry/sentry-mcp", { remoteUrl: "https://mcp.sentry.dev/mcp", homepage: "https://sentry.io" }),
  entry("Stripe", "com.stripe/mcp", { remoteUrl: "https://mcp.stripe.com", homepage: "https://stripe.com" }),
  entry("Neon", "com.neon/mcp", { remoteUrl: "https://mcp.neon.tech/mcp", homepage: "https://neon.com" }),
  entry("Vercel", "com.vercel/vercel-mcp", { remoteUrl: "https://mcp.vercel.com", homepage: "https://vercel.com" }),
];

function normalize(name: string): string {
  return name.trim().toLowerCase();
}

const BY_NAME = new Map(CONNECTOR_REGISTRY.map((connector) => [normalize(connector.name), connector]));

/** The registry entry for a bot connector name (case-insensitive), or null when it is not mapped */
export function getConnectorRegistryEntry(connector: string): ConnectorRegistryEntry | null {
  return BY_NAME.get(normalize(connector)) ?? null;
}

/** A "Required connectors" list item: the name, plus its registry link and remote URL when mapped */
export function connectorToMarkdown(connector: string): string {
  const mapped = getConnectorRegistryEntry(connector);
  if (!mapped) return `- ${connector}`;
  const remote = mapped.remoteUrl ? `, remote: ${mapped.remoteUrl}` : "";
  return `- ${connector} ([MCP Registry](${mapped.registryUrl})${remote})`;
}
