import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "@/app/api/improve-prompt/route";
import { auth } from "@/lib/auth";
import { getConfig } from "@/lib/config";
import { improvePrompt } from "@/lib/ai/improve-prompt";

vi.mock("@/lib/db", () => ({
  db: {
    user: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("@/lib/config", () => ({
  getConfig: vi.fn(),
}));

vi.mock("@/lib/ai/improve-prompt", () => ({
  improvePrompt: vi.fn(),
}));

function makeRequest(body: unknown) {
  return new NextRequest("http://localhost:3000/api/improve-prompt", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/improve-prompt", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getConfig).mockResolvedValue({ features: { promptEnhancer: true } } as never);
  });

  it("returns 404 without authenticating or calling OpenAI when the prompt enhancer is disabled", async () => {
    vi.mocked(getConfig).mockResolvedValue({ features: { promptEnhancer: false } } as never);

    const response = await POST(makeRequest({ prompt: "write a poem" }));

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "Prompt enhancer is not enabled" });
    expect(auth).not.toHaveBeenCalled();
    expect(improvePrompt).not.toHaveBeenCalled();
  });

  it("requires authentication when enabled", async () => {
    vi.mocked(auth).mockResolvedValue(null as never);

    const response = await POST(makeRequest({ prompt: "write a poem" }));

    expect(response.status).toBe(401);
    expect(improvePrompt).not.toHaveBeenCalled();
  });

  it("improves the prompt when enabled and authenticated", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "user-1", name: "alice" } } as never);
    const result = {
      original: "write a poem",
      improved: "You are a poet...",
      outputType: "text",
      outputFormat: "text",
      inspirations: [],
      model: "gpt-4o",
    };
    vi.mocked(improvePrompt).mockResolvedValue(result as never);

    const response = await POST(makeRequest({ prompt: "write a poem" }));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(result);
    expect(improvePrompt).toHaveBeenCalledWith({
      prompt: "write a poem",
      outputFormat: "text",
      outputType: "text",
    });
  });

  it("treats an unset flag as enabled", async () => {
    vi.mocked(getConfig).mockResolvedValue({ features: {} } as never);
    vi.mocked(auth).mockResolvedValue(null as never);

    const response = await POST(makeRequest({ prompt: "write a poem" }));

    expect(response.status).toBe(401);
  });
});
