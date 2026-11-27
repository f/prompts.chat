import { randomBytes } from "crypto";

const API_KEY_PREFIX = "pchat_";
const API_KEY_LENGTH = 32;

/**
 * Generate a secure API key with the pchat_ prefix
 */
export function generateApiKey(): string {
  const randomPart = randomBytes(API_KEY_LENGTH).toString("hex");
  return `${API_KEY_PREFIX}${randomPart}`;
}

/**
 * Validate that an API key has the correct format
 */
export function isValidApiKeyFormat(apiKey: string): boolean {
  if (!apiKey.startsWith(API_KEY_PREFIX)) {
    return false;
  }
  const randomPart = apiKey.slice(API_KEY_PREFIX.length);
  // Should be 64 hex characters (32 bytes)
  return /^[a-f0-9]{64}$/.test(randomPart);
}

/** An API key sent as x-api-key, an Authorization bearer token, or prompts-api-key */
export function getRequestApiKey(request: Request): string | null {
  const authorization = request.headers.get("authorization");
  const bearer = authorization?.startsWith("Bearer ") ? authorization.slice("Bearer ".length).trim() : null;
  return request.headers.get("x-api-key") || bearer || request.headers.get("prompts-api-key");
}
