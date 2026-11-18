/**
 * Chat modes for the prompt-builder chat, modeled after Perplexity's two tiers:
 *
 *  - "search": fast, search-enabled. Retrieves relevant prompts as grounding
 *    context, runs a small agentic loop with the base model.
 *  - "pro":    extra compute. Pulls more sources, runs a longer agentic loop with
 *    a stronger model and a larger token budget. Also search-enabled.
 *
 * This module is intentionally pure (no network / no SDK) so it can be unit
 * tested in isolation and reused by both the API route and the client.
 */

export const CHAT_MODES = ["search", "pro"] as const;
export type ChatMode = (typeof CHAT_MODES)[number];

export const DEFAULT_CHAT_MODE: ChatMode = "search";

export interface ChatModeConfig {
  /** Canonical mode id. */
  mode: ChatMode;
  /** Human label (used in UI). */
  label: string;
  /** Whether semantic search grounding is used for this mode. */
  searchEnabled: boolean;
  /** How many top prompts to retrieve as grounding context. */
  searchLimit: number;
  /** Max agentic tool-calling loops. */
  maxLoops: number;
  /** Sampling temperature. */
  temperature: number;
  /** Max output tokens per turn. */
  maxTokens: number;
  /** Env var name that overrides the model for this mode. */
  modelEnvVar: string;
  /** Model used when the env var is not set. */
  defaultModel: string;
}

export const CHAT_MODE_CONFIG: Record<ChatMode, ChatModeConfig> = {
  search: {
    mode: "search",
    label: "Search",
    searchEnabled: true,
    searchLimit: 5,
    maxLoops: 6,
    temperature: 0.7,
    maxTokens: 2000,
    modelEnvVar: "OPENAI_GENERATIVE_MODEL",
    defaultModel: "gpt-4o-mini",
  },
  pro: {
    mode: "pro",
    label: "Pro",
    searchEnabled: true,
    searchLimit: 12,
    maxLoops: 12,
    temperature: 0.5,
    maxTokens: 4000,
    modelEnvVar: "OPENAI_PRO_MODEL",
    defaultModel: "gpt-4o",
  },
};

/**
 * Narrow an arbitrary (possibly untrusted) value to a valid ChatMode.
 * Unknown / missing values fall back to DEFAULT_CHAT_MODE so the chat never
 * fails just because a client sent a bad mode.
 */
export function resolveChatMode(input: unknown): ChatMode {
  if (typeof input === "string") {
    const normalized = input.trim().toLowerCase();
    if ((CHAT_MODES as readonly string[]).includes(normalized)) {
      return normalized as ChatMode;
    }
  }
  return DEFAULT_CHAT_MODE;
}

/** Resolve the full config for a mode (with fallback for bad input). */
export function getChatModeConfig(input: unknown): ChatModeConfig {
  return CHAT_MODE_CONFIG[resolveChatMode(input)];
}

/**
 * Resolve the model name for a mode, honoring the per-mode env override.
 * `env` is injectable so this stays pure and testable.
 */
export function resolveModel(
  input: unknown,
  env: Record<string, string | undefined> = process.env
): string {
  const config = getChatModeConfig(input);
  const override = env[config.modelEnvVar];
  return override && override.trim().length > 0 ? override.trim() : config.defaultModel;
}

export interface SearchContextSource {
  title: string;
  content: string;
  similarity?: number;
}

/**
 * Format retrieved prompts into a grounding block for the system message,
 * Perplexity-style: numbered sources the model can cite as [1], [2], ...
 * Returns an empty string when there is nothing to ground on.
 */
export function buildSearchContext(sources: SearchContextSource[]): string {
  if (!sources || sources.length === 0) return "";
  const lines = sources.map((s, i) => {
    const title = (s.title || "Untitled").trim();
    const content = (s.content || "").trim().replace(/\s+/g, " ").slice(0, 500);
    return `[${i + 1}] ${title}\n${content}`;
  });
  return `

RELEVANT PROMPTS (grounding sources — cite as [n] when you use them):
${lines.join("\n\n")}`;
}
