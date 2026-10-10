import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";

// Provider-agnostic LLM completion abstraction.
//
// stageExecutor (and any future caller) depends ONLY on this interface, so the
// underlying provider can be swapped without touching call sites. The default
// is the OpenAI-backed implementation that reuses the existing src/lib/ai
// setup (OPENAI_API_KEY / OPENAI_BASE_URL / OPENAI_GENERATIVE_MODEL). The
// Anthropic-backed provider is selected only when BOTH LLM_PROVIDER=anthropic
// and ANTHROPIC_API_KEY are set — existing behavior is otherwise unchanged.

export interface LLMCompletionRequest {
  /** Optional system / instruction prompt (the stage's prompt content). */
  system?: string;
  /** User input for this turn (the stage input). */
  prompt: string;
  temperature?: number;
  maxTokens?: number;
}

export interface LLMCompletionResult {
  output: string;
  inputTokens: number;
  outputTokens: number;
  model: string;
}

export interface LLMProvider {
  readonly name: string;
  complete(req: LLMCompletionRequest): Promise<LLMCompletionResult>;
}

class OpenAIProvider implements LLMProvider {
  readonly name = "openai";
  private client: OpenAI | null = null;
  private readonly model = process.env.OPENAI_GENERATIVE_MODEL || "gpt-4o-mini";

  private getClient(): OpenAI {
    if (!this.client) {
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) {
        throw new Error("OPENAI_API_KEY is not set");
      }
      this.client = new OpenAI({
        apiKey,
        baseURL: process.env.OPENAI_BASE_URL || undefined,
      });
    }
    return this.client;
  }

  async complete(req: LLMCompletionRequest): Promise<LLMCompletionResult> {
    const client = this.getClient();
    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [];
    if (req.system) {
      messages.push({ role: "system", content: req.system });
    }
    messages.push({ role: "user", content: req.prompt });

    const response = await client.chat.completions.create({
      model: this.model,
      messages,
      temperature: req.temperature ?? 0.7,
      max_tokens: req.maxTokens ?? 4000,
    });

    return {
      output: response.choices[0]?.message?.content?.trim() ?? "",
      inputTokens: response.usage?.prompt_tokens ?? 0,
      outputTokens: response.usage?.completion_tokens ?? 0,
      model: response.model ?? this.model,
    };
  }
}

class AnthropicProvider implements LLMProvider {
  readonly name = "anthropic";
  private client: Anthropic | null = null;
  private readonly model = process.env.ANTHROPIC_GENERATIVE_MODEL || "claude-opus-4-8";

  private getClient(): Anthropic {
    if (!this.client) {
      const apiKey = process.env.ANTHROPIC_API_KEY;
      if (!apiKey) {
        throw new Error("ANTHROPIC_API_KEY is not set");
      }
      this.client = new Anthropic({ apiKey });
    }
    return this.client;
  }

  async complete(req: LLMCompletionRequest): Promise<LLMCompletionResult> {
    const client = this.getClient();

    const response = await client.messages.create({
      model: this.model,
      max_tokens: req.maxTokens ?? 4000,
      // The stage's system prompt is a stable prefix re-sent on every chain
      // execution — cache_control marks it so repeated executions hit the
      // prompt cache instead of re-processing it at full price.
      ...(req.system
        ? {
            system: [
              {
                type: "text" as const,
                text: req.system,
                cache_control: { type: "ephemeral" as const },
              },
            ],
          }
        : {}),
      messages: [{ role: "user", content: req.prompt }],
      // req.temperature is intentionally not forwarded: current Claude models
      // (Opus 4.7+) reject sampling parameters with a 400.
    });

    const output = response.content
      .map((block) => (block.type === "text" ? block.text : ""))
      .join("")
      .trim();

    const usage = response.usage;
    return {
      output,
      // Cache reads/writes are still input tokens — fold them in so
      // StageTrace.tokensUsed stays comparable across providers.
      inputTokens:
        (usage?.input_tokens ?? 0) +
        (usage?.cache_creation_input_tokens ?? 0) +
        (usage?.cache_read_input_tokens ?? 0),
      outputTokens: usage?.output_tokens ?? 0,
      model: response.model ?? this.model,
    };
  }
}

let activeProvider: LLMProvider | null = null;

function createDefaultProvider(): LLMProvider {
  if (process.env.LLM_PROVIDER === "anthropic" && process.env.ANTHROPIC_API_KEY) {
    return new AnthropicProvider();
  }
  return new OpenAIProvider();
}

/**
 * Returns the active LLM provider. OpenAI-backed by default; Anthropic-backed
 * only when LLM_PROVIDER=anthropic and ANTHROPIC_API_KEY are both set.
 */
export function getLLMProvider(): LLMProvider {
  if (!activeProvider) {
    activeProvider = createDefaultProvider();
  }
  return activeProvider;
}

/** Override the active provider (used by tests and future provider swaps). */
export function setLLMProvider(provider: LLMProvider | null): void {
  activeProvider = provider;
}
