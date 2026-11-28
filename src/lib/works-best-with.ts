// Types and constants for "Works Best With" feature

// MCP Server configuration for a prompt
export interface PromptMCPConfig {
  command: string;
  tools?: string[];
}

// Well-known AI models (slug -> display info)
export const AI_MODELS = {
  // OpenAI
  "gpt-5-*": { name: "GPT-5.*", provider: "OpenAI" },
  "o3": { name: "o3", provider: "OpenAI" },
  "gpt-4o": { name: "GPT-4o", provider: "OpenAI" },
  "o4-mini": { name: "o4-mini", provider: "OpenAI" },

  // Anthropic
  "claude-4-5-opus": { name: "Claude 4.5 Opus", provider: "Anthropic" },
  "claude-4-5-sonnet": { name: "Claude 4.5 Sonnet", provider: "Anthropic" },
  "claude-4-5-haiku": { name: "Claude 4.5 Haiku", provider: "Anthropic" },
  "claude-4-sonnet": { name: "Claude 4 Sonnet", provider: "Anthropic" },
  "claude-4-opus": { name: "Claude 4 Opus", provider: "Anthropic" },
  "claude-3-5-sonnet": { name: "Claude 3.5 Sonnet", provider: "Anthropic" },

  // Google
  "gemini-3": { name: "Gemini 3", provider: "Google" },
  "gemini-3-pro": { name: "Gemini 3 Pro", provider: "Google" },
  "gemini-2-5-pro": { name: "Gemini 2.5 Pro", provider: "Google" },
  "gemini-2-5-flash": { name: "Gemini 2.5 Flash", provider: "Google" },

  // xAI
  "grok-4": { name: "Grok 4", provider: "xAI" },
  "grok-3": { name: "Grok 3", provider: "xAI" },

  // MiniMax
  "minimax-m3-1-flash": { name: "MiniMax-M3.1-Flash", provider: "MiniMax" },
  "minimax-m3": { name: "MiniMax-M3", provider: "MiniMax" },
  "minimax-m2-7": { name: "MiniMax-M2.7", provider: "MiniMax" },

  // Image Generation
  "nano-banana": { name: "Nano Banana", provider: "Google" },
  "nano-banana-pro": { name: "Nano Banana Pro", provider: "Google" },
  "dall-e-3": { name: "DALL·E 3", provider: "OpenAI" },
  "midjourney": { name: "Midjourney", provider: "Midjourney" },
  "stable-diffusion": { name: "Stable Diffusion", provider: "Stability AI" },
  "flux": { name: "Flux", provider: "Black Forest Labs" },

  // Video Generation
  "sora 2": { name: "Sora 2", provider: "OpenAI" },
  "runway-gen4": { name: "Runway Gen-4", provider: "Runway" },
  "veo": { name: "Veo", provider: "Google" },
  "kling": { name: "Kling", provider: "Kuaishou" },
} as const;

export type AIModelSlug = keyof typeof AI_MODELS;

export function getModelInfo(slug: string): { name: string; provider: string } | null {
  return AI_MODELS[slug as AIModelSlug] ?? null;
}

export function isValidModelSlug(slug: string): slug is AIModelSlug {
  return slug in AI_MODELS;
}

// Get models grouped by provider
export function getModelsByProvider(): Record<string, { slug: string; name: string }[]> {
  const grouped: Record<string, { slug: string; name: string }[]> = {};

  for (const [slug, info] of Object.entries(AI_MODELS)) {
    // Keep legacy metadata readable without offering it for new selections.
    if (slug === "minimax-m2-7") continue;

    if (!grouped[info.provider]) {
      grouped[info.provider] = [];
    }
    grouped[info.provider].push({ slug, name: info.name });
  }

  return grouped;
}

// Validate bestWithModels (max 3, valid slugs)
export function validateBestWithModels(models: string[]): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (models.length > 3) {
    errors.push("Maximum 3 models allowed");
  }

  for (const slug of models) {
    if (!isValidModelSlug(slug)) {
      errors.push(`Unknown model: ${slug}`);
    }
  }

  return { valid: errors.length === 0, errors };
}

// Validate bestWithMCP
export function validateBestWithMCP(mcp: unknown): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (mcp === null || mcp === undefined) {
    return { valid: true, errors: [] };
  }

  if (typeof mcp !== "object") {
    errors.push("MCP config must be an object");
    return { valid: false, errors };
  }

  const config = mcp as Record<string, unknown>;

  if (!("command" in config) || typeof config.command !== "string") {
    errors.push("MCP config.command is required and must be a string");
  }

  if ("tools" in config && config.tools !== undefined) {
    if (!Array.isArray(config.tools)) {
      errors.push("MCP config.tools must be an array");
    } else if (!config.tools.every((t: unknown) => typeof t === "string")) {
      errors.push("MCP config.tools must be an array of strings");
    }
  }

  return { valid: errors.length === 0, errors };
}
