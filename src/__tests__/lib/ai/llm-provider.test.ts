import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Unit tests for the LLM provider abstraction: Anthropic completion mapping,
// token accounting (cache tokens folded into inputTokens), the prompt-caching
// flag on the system prompt, and env-driven provider selection.

const { mockCreate } = vi.hoisted(() => ({ mockCreate: vi.fn() }));

vi.mock("@anthropic-ai/sdk", () => ({
  default: class MockAnthropic {
    messages = { create: mockCreate };
    constructor(public opts: { apiKey: string }) {}
  },
}));

import { getLLMProvider, setLLMProvider } from "@/lib/ai/llm-provider";

function anthropicResponse(overrides: Record<string, unknown> = {}) {
  return {
    content: [{ type: "text", text: "  hello from claude  " }],
    usage: {
      input_tokens: 10,
      output_tokens: 5,
      cache_creation_input_tokens: 100,
      cache_read_input_tokens: 200,
    },
    model: "claude-opus-4-8",
    ...overrides,
  };
}

beforeEach(() => {
  setLLMProvider(null); // clear the cached provider so env changes take effect
  mockCreate.mockReset();
});

afterEach(() => {
  vi.unstubAllEnvs();
  setLLMProvider(null);
});

describe("provider selection", () => {
  it("defaults to OpenAI when no provider env is set", () => {
    vi.stubEnv("LLM_PROVIDER", "");
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    expect(getLLMProvider().name).toBe("openai");
  });

  it("stays on OpenAI when LLM_PROVIDER=anthropic but no API key is set", () => {
    vi.stubEnv("LLM_PROVIDER", "anthropic");
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    expect(getLLMProvider().name).toBe("openai");
  });

  it("stays on OpenAI when only ANTHROPIC_API_KEY is set", () => {
    vi.stubEnv("LLM_PROVIDER", "");
    vi.stubEnv("ANTHROPIC_API_KEY", "sk-test");
    expect(getLLMProvider().name).toBe("openai");
  });

  it("selects Anthropic only when LLM_PROVIDER=anthropic and ANTHROPIC_API_KEY are both set", () => {
    vi.stubEnv("LLM_PROVIDER", "anthropic");
    vi.stubEnv("ANTHROPIC_API_KEY", "sk-test");
    expect(getLLMProvider().name).toBe("anthropic");
  });
});

describe("AnthropicProvider.complete", () => {
  beforeEach(() => {
    vi.stubEnv("LLM_PROVIDER", "anthropic");
    vi.stubEnv("ANTHROPIC_API_KEY", "sk-test");
  });

  it("maps text output, token usage, and model onto LLMCompletionResult", async () => {
    mockCreate.mockResolvedValue(anthropicResponse());

    const result = await getLLMProvider().complete({
      system: "You are stage 1.",
      prompt: "The water cycle",
    });

    expect(result.output).toBe("hello from claude");
    // cache write (100) + cache read (200) are input tokens too
    expect(result.inputTokens).toBe(310);
    expect(result.outputTokens).toBe(5);
    expect(result.model).toBe("claude-opus-4-8");
  });

  it("concatenates only text blocks from mixed content", async () => {
    mockCreate.mockResolvedValue(
      anthropicResponse({
        content: [
          { type: "text", text: "part one" },
          { type: "tool_use", id: "t1", name: "x", input: {} },
          { type: "text", text: " part two" },
        ],
      }),
    );

    const result = await getLLMProvider().complete({ prompt: "hi" });
    expect(result.output).toBe("part one part two");
  });

  it("marks the system prompt with cache_control and never sends sampling params", async () => {
    mockCreate.mockResolvedValue(anthropicResponse());

    await getLLMProvider().complete({
      system: "Stable stage prompt",
      prompt: "input",
      temperature: 0.9,
      maxTokens: 1234,
    });

    const request = mockCreate.mock.calls[0][0];
    expect(request.system).toEqual([
      {
        type: "text",
        text: "Stable stage prompt",
        cache_control: { type: "ephemeral" },
      },
    ]);
    expect(request.messages).toEqual([{ role: "user", content: "input" }]);
    expect(request.max_tokens).toBe(1234);
    // Opus 4.7+ rejects sampling parameters — temperature must not be forwarded.
    expect(request).not.toHaveProperty("temperature");
  });

  it("omits the system field entirely when no system prompt is given", async () => {
    mockCreate.mockResolvedValue(anthropicResponse());

    await getLLMProvider().complete({ prompt: "input" });
    expect(mockCreate.mock.calls[0][0]).not.toHaveProperty("system");
  });

  it("uses ANTHROPIC_GENERATIVE_MODEL when set, defaulting to claude-opus-4-8", async () => {
    mockCreate.mockResolvedValue(anthropicResponse({ model: undefined }));

    await getLLMProvider().complete({ prompt: "hi" });
    expect(mockCreate.mock.calls[0][0].model).toBe("claude-opus-4-8");

    setLLMProvider(null);
    vi.stubEnv("ANTHROPIC_GENERATIVE_MODEL", "claude-sonnet-4-6");
    mockCreate.mockResolvedValue(anthropicResponse());

    await getLLMProvider().complete({ prompt: "hi" });
    expect(mockCreate.mock.calls[1][0].model).toBe("claude-sonnet-4-6");
  });
});
