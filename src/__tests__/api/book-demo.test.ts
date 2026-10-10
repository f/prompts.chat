import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { createCompletion } = vi.hoisted(() => ({
  createCompletion: vi.fn(),
}));

vi.mock("openai", () => ({
  default: vi.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: createCompletion,
      },
    },
  })),
}));

vi.mock("@/lib/auth", () => ({
  auth: vi.fn().mockResolvedValue(null),
}));

vi.mock("@/lib/config", () => ({
  getConfig: vi.fn().mockResolvedValue({ features: { aiGeneration: true } }),
}));

import { POST } from "@/app/api/book/demo/route";

describe("POST /api/book/demo", () => {
  let originalApiKey: string | undefined;

  beforeEach(() => {
    vi.clearAllMocks();
    originalApiKey = process.env.OPENAI_API_KEY;
    process.env.OPENAI_API_KEY = "test-key";
    createCompletion.mockResolvedValue({
      choices: [{ message: { content: "A useful response" } }],
    });
  });

  afterEach(() => {
    if (originalApiKey === undefined) {
      delete process.env.OPENAI_API_KEY;
    } else {
      process.env.OPENAI_API_KEY = originalApiKey;
    }
  });

  it("uses the current completion token parameter for run requests", async () => {
    const request = new Request("http://localhost:3000/api/book/demo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "run_prompt", prompt: "Review this code" }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.result).toBe("A useful response");
    expect(createCompletion).toHaveBeenCalledWith(
      expect.objectContaining({
        max_completion_tokens: 500,
      }),
    );
    expect(createCompletion.mock.calls[0][0]).not.toHaveProperty("max_tokens");
  });
});
