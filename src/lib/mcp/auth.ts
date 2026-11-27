import { db } from "@/lib/db";
import { getRequestApiKey, isValidApiKeyFormat } from "@/lib/api-key";
import type { McpUser } from "./context";

// In-memory cache for warm function instances
const authCache = new Map<string, { user: McpUser | null; expiry: number }>();
const AUTH_CACHE_TTL = 5 * 60 * 1000;

/**
 * The API key of an MCP request. Accepts the PROMPTS_API_KEY (or prompts-api-key) header,
 * x-api-key, an Authorization bearer token, or the ?api_key= query parameter.
 */
export function getMcpApiKey(request: Request, url: URL): string | null {
  return request.headers.get("prompts_api_key") || getRequestApiKey(request) || url.searchParams.get("api_key");
}

export async function authenticateApiKey(apiKey: string | null): Promise<McpUser | null> {
  if (!apiKey || !isValidApiKeyFormat(apiKey)) {
    return null;
  }

  const cached = authCache.get(apiKey);
  if (cached && Date.now() < cached.expiry) {
    return cached.user;
  }

  const user = await db.user.findUnique({
    where: { apiKey },
    select: { id: true, username: true, role: true, mcpPromptsPublicByDefault: true },
  });

  authCache.set(apiKey, { user, expiry: Date.now() + AUTH_CACHE_TTL });
  return user;
}

/** Test hook: forgets cached API key lookups */
export function clearAuthCache() {
  authCache.clear();
}
