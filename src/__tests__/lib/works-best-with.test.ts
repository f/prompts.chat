import { describe, it, expect } from "vitest";
import {
  getModelInfo,
  isValidModelSlug,
  getModelsByProvider,
  validateBestWithModels,
  validateBestWithMCP,
  AI_MODELS,
} from "@/lib/works-best-with";

describe("getModelInfo", () => {
  it("returns model info for valid slugs", () => {
    expect(getModelInfo("gpt-4o")).toEqual({ name: "GPT-4o", provider: "OpenAI" });
    expect(getModelInfo("claude-4-opus")).toEqual({ name: "Claude 4 Opus", provider: "Anthropic" });
    expect(getModelInfo("gemini-2-5-pro")).toEqual({ name: "Gemini 2.5 Pro", provider: "Google" });
  });

  it("returns null for invalid slugs", () => {
    expect(getModelInfo("invalid-model")).toBeNull();
    expect(getModelInfo("")).toBeNull();
    expect(getModelInfo("gpt-99")).toBeNull();
  });

  it("returns correct info for image generation models", () => {
    expect(getModelInfo("dall-e-3")).toEqual({ name: "DALL·E 3", provider: "OpenAI" });
    expect(getModelInfo("midjourney")).toEqual({ name: "Midjourney", provider: "Midjourney" });
  });

  it("returns correct info for video generation models", () => {
    expect(getModelInfo("sora 2")).toEqual({ name: "Sora 2", provider: "OpenAI" });
    expect(getModelInfo("runway-gen4")).toEqual({ name: "Runway Gen-4", provider: "Runway" });
  });

  it("returns correct info for MiniMax models", () => {
    expect(getModelInfo("minimax-m3-1-flash")).toEqual({ name: "MiniMax-M3.1-Flash", provider: "MiniMax" });
    expect(getModelInfo("minimax-m3")).toEqual({ name: "MiniMax-M3", provider: "MiniMax" });
    expect(getModelInfo("minimax-m2-7")).toEqual({ name: "MiniMax-M2.7", provider: "MiniMax" });
  });
});

describe("isValidModelSlug", () => {
  it("returns true for valid model slugs", () => {
    expect(isValidModelSlug("gpt-4o")).toBe(true);
    expect(isValidModelSlug("claude-3-5-sonnet")).toBe(true);
    expect(isValidModelSlug("gemini-2-5-flash")).toBe(true);
    expect(isValidModelSlug("grok-3")).toBe(true);
  });

  it("returns false for invalid slugs", () => {
    expect(isValidModelSlug("invalid")).toBe(false);
    expect(isValidModelSlug("gpt-10")).toBe(false);
    expect(isValidModelSlug("")).toBe(false);
  });

  it("validates all defined model slugs", () => {
    for (const slug of Object.keys(AI_MODELS)) {
      expect(isValidModelSlug(slug)).toBe(true);
    }
  });
});

describe("getModelsByProvider", () => {
  it("returns models grouped by provider", () => {
    const grouped = getModelsByProvider();

    expect(grouped).toHaveProperty("OpenAI");
    expect(grouped).toHaveProperty("Anthropic");
    expect(grouped).toHaveProperty("Google");
    expect(grouped).toHaveProperty("xAI");
    expect(grouped).toHaveProperty("MiniMax");
  });

  it("includes all OpenAI models under OpenAI provider", () => {
    const grouped = getModelsByProvider();
    const openaiModels = grouped["OpenAI"];

    expect(openaiModels).toBeDefined();
    expect(openaiModels.some(m => m.slug === "gpt-4o")).toBe(true);
    expect(openaiModels.some(m => m.slug === "dall-e-3")).toBe(true);
    expect(openaiModels.some(m => m.slug === "sora 2")).toBe(true);
  });

  it("includes all Anthropic models under Anthropic provider", () => {
    const grouped = getModelsByProvider();
    const anthropicModels = grouped["Anthropic"];

    expect(anthropicModels).toBeDefined();
    expect(anthropicModels.some(m => m.slug === "claude-4-opus")).toBe(true);
    expect(anthropicModels.some(m => m.slug === "claude-3-5-sonnet")).toBe(true);
  });

  it("each model entry has slug and name", () => {
    const grouped = getModelsByProvider();

    for (const provider of Object.keys(grouped)) {
      for (const model of grouped[provider]) {
        expect(model).toHaveProperty("slug");
        expect(model).toHaveProperty("name");
        expect(typeof model.slug).toBe("string");
        expect(typeof model.name).toBe("string");
      }
    }
  });

  it("offers Flash first and M3 while preserving legacy model validation", () => {
    expect(getModelsByProvider().MiniMax).toEqual([
      { slug: "minimax-m3-1-flash", name: "MiniMax-M3.1-Flash" },
      { slug: "minimax-m3", name: "MiniMax-M3" },
    ]);
    expect(validateBestWithModels(["minimax-m2-7"]).valid).toBe(true);
  });

  it("covers all models except the legacy MiniMax selection", () => {
    const slugs = Object.values(getModelsByProvider()).flat().map(model => model.slug);
    expect(slugs.sort()).toEqual(Object.keys(AI_MODELS).filter(slug => slug !== "minimax-m2-7").sort());
  });
});

describe("validateBestWithModels", () => {
  describe("valid inputs", () => {
    it("accepts empty array", () => {
      const result = validateBestWithModels([]);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("accepts single valid model", () => {
      const result = validateBestWithModels(["gpt-4o"]);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("accepts up to 3 valid models", () => {
      const result = validateBestWithModels(["gpt-4o", "claude-4-opus", "gemini-2-5-pro"]);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe("invalid inputs", () => {
    it("rejects more than 3 models", () => {
      const result = validateBestWithModels(["gpt-4o", "claude-4-opus", "gemini-2-5-pro", "grok-3"]);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Maximum 3 models allowed");
    });

    it("rejects unknown model slugs", () => {
      const result = validateBestWithModels(["gpt-4o", "unknown-model"]);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Unknown model: unknown-model");
    });

    it("reports multiple errors", () => {
      const result = validateBestWithModels(["invalid1", "invalid2", "invalid3", "invalid4"]);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(1);
      expect(result.errors).toContain("Maximum 3 models allowed");
      expect(result.errors).toContain("Unknown model: invalid1");
    });
  });
});

describe("validateBestWithMCP", () => {
  describe("valid inputs", () => {
    it("accepts null", () => {
      const result = validateBestWithMCP(null);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("accepts undefined", () => {
      const result = validateBestWithMCP(undefined);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("accepts valid config with command only", () => {
      const result = validateBestWithMCP({ command: "npx @modelcontextprotocol/server-filesystem" });
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("accepts valid config with command and tools", () => {
      const result = validateBestWithMCP({
        command: "npx @modelcontextprotocol/server-filesystem",
        tools: ["read_file", "write_file"]
      });
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("accepts config with empty tools array", () => {
      const result = validateBestWithMCP({
        command: "some-command",
        tools: []
      });
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe("invalid inputs", () => {
    it("rejects non-object values", () => {
      expect(validateBestWithMCP("string").valid).toBe(false);
      expect(validateBestWithMCP(123).valid).toBe(false);
      expect(validateBestWithMCP([]).valid).toBe(false);
      expect(validateBestWithMCP(true).valid).toBe(false);
    });

    it("rejects missing command", () => {
      const result = validateBestWithMCP({});
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("MCP config.command is required and must be a string");
    });

    it("rejects non-string command", () => {
      const result = validateBestWithMCP({ command: 123 });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("MCP config.command is required and must be a string");
    });

    it("rejects non-array tools", () => {
      const result = validateBestWithMCP({ command: "cmd", tools: "not-array" });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("MCP config.tools must be an array");
    });

    it("rejects tools array with non-string elements", () => {
      const result = validateBestWithMCP({ command: "cmd", tools: ["valid", 123, "also-valid"] });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("MCP config.tools must be an array of strings");
    });
  });

  describe("edge cases", () => {
    it("handles object with extra properties", () => {
      const result = validateBestWithMCP({
        command: "cmd",
        tools: ["tool1"],
        extraProp: "ignored"
      });
      expect(result.valid).toBe(true);
    });

    it("handles deeply nested invalid tools", () => {
      const result = validateBestWithMCP({
        command: "cmd",
        tools: [["nested"]]
      });
      expect(result.valid).toBe(false);
    });
  });
});
