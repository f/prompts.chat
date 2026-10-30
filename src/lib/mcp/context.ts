export interface McpUser {
  id: string;
  username: string;
  role: string;
  mcpPromptsPublicByDefault: boolean;
}

/** Per-request state shared by every tool, prompt and resource handler */
export interface McpContext {
  /** The API key's owner; null for anonymous requests */
  user: McpUser | null;
  /** Narrows the MCP prompts listing, from the ?categories=, ?tags= and ?users= URL parameters */
  filters: {
    categories?: string[];
    tags?: string[];
    users?: string[];
  };
  /** Absolute site URL used for web links */
  baseUrl: string;
}
