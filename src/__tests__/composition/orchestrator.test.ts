import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { LLMProvider } from "@/lib/ai/llm-provider";

// --- Mock the Prisma client (sandbox has no DB egress). Capture what gets written. ---
const { mockDb, captured } = vi.hoisted(() => {
  const captured: {
    traces: Array<Record<string, unknown>>;
    record: Record<string, unknown> | null;
  } = { traces: [], record: null };

  const tx = {
    executionRecord: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        captured.record = data;
        return { id: "exec_test_1", ...data };
      },
    },
    stageTrace: {
      createMany: async ({ data }: { data: Array<Record<string, unknown>> }) => {
        captured.traces = data;
        return { count: data.length };
      },
    },
  };

  const mockDb = {
    composition: { findUnique: vi.fn() },
    prompt: { findUnique: vi.fn() },
    $transaction: async (cb: (t: typeof tx) => unknown) => cb(tx),
  };

  return { mockDb, captured };
});

vi.mock("@/lib/db", () => ({ db: mockDb }));

import { executeComposition } from "@/lib/composition";
import { setLLMProvider } from "@/lib/ai/llm-provider";

// --- Stub LLM provider: deterministic outputs keyed off the prompt content. ---
const stub: LLMProvider = {
  name: "stub",
  async complete(req) {
    const id = (req.system ?? "").replace("SYS:", "");
    if (id === "p1") {
      // structured output so the adaptation layer can extract a field
      return {
        output: JSON.stringify({ summary: "S1-summary", topic: "weather" }),
        inputTokens: 10,
        outputTokens: 20,
        model: "stub",
      };
    }
    if (id === "p2") {
      // empty output -> scores below threshold -> triggers fallback
      return { output: "", inputTokens: 5, outputTokens: 0, model: "stub" };
    }
    return {
      output: `out:${id}:${req.prompt.slice(0, 24)}`,
      inputTokens: 7,
      outputTokens: 8,
      model: "stub",
    };
  },
};

interface StageSeed {
  order: number;
  promptId: string;
  fallbackPromptId: string | null;
  successThreshold: number;
  extractFields: string[];
  transformRules: unknown;
}

function stage(seed: StageSeed) {
  return {
    id: `stage_${seed.order}`,
    compositionId: "comp1",
    createdAt: new Date(),
    ...seed,
  };
}

beforeEach(() => {
  captured.traces = [];
  captured.record = null;
  mockDb.prompt.findUnique.mockImplementation(
    async ({ where }: { where: { id: string } }) => ({
      content: `SYS:${where.id}`,
      versions: [{ version: 1 }],
    }),
  );
  setLLMProvider(stub);
});

afterEach(() => {
  setLLMProvider(null);
  vi.clearAllMocks();
});

describe("executeComposition", () => {
  it("runs a 3-stage chain, adapts between stages, and applies fallback (partial)", async () => {
    mockDb.composition.findUnique.mockResolvedValue({
      id: "comp1",
      organizationId: "org1",
      name: "Test chain",
      // intentionally out of order to prove dagResolver sorts by `order`
      stages: [
        stage({ order: 2, promptId: "p2", fallbackPromptId: "p2fb", successThreshold: 0.5, extractFields: [], transformRules: null }),
        stage({ order: 1, promptId: "p1", fallbackPromptId: null, successThreshold: 0.5, extractFields: ["summary"], transformRules: { summary: "Use this summary as context" } }),
        stage({ order: 3, promptId: "p3", fallbackPromptId: null, successThreshold: 0.5, extractFields: [], transformRules: null }),
      ],
    });

    const result = await executeComposition("comp1", "hello", {
      organizationId: "org1",
      userId: "u1",
      sessionId: "sess1",
    });

    // status + per-stage results
    expect(result.status).toBe("partial");
    expect(result.stages).toHaveLength(3);
    expect(result.stages[0].fallbackApplied).toBe(false); // stage 1 ok
    expect(result.stages[1].fallbackApplied).toBe(true); // stage 2 fell back
    expect(result.stages[2].fallbackApplied).toBe(false); // stage 3 ok
    expect(result.finalOutput).toContain("out:p3");
    expect(result.totalTokens).toBeGreaterThan(0);
    expect(result.totalDuration).toBeGreaterThanOrEqual(0);

    // one StageTrace row per stage
    expect(captured.traces).toHaveLength(3);

    // adaptation: stage 2's adaptedInput is built from stage 1 output via transformRules
    const t2 = captured.traces.find((t) => t.stageOrder === 2)!;
    expect(t2.adaptedInput).toContain("Use this summary as context");
    expect(t2.adaptedInput).toContain("S1-summary");
    expect(t2.fallbackApplied).toBe(true);
    expect(t2.promptId).toBe("p2fb"); // the prompt actually used is recorded
    expect(t2.fallbackPromptId).toBe("p2fb");
    expect(t2.thresholdMet).toBe(true); // fallback output passed

    // stage 1 trace records which adaptation rules fired
    const t1 = captured.traces.find((t) => t.stageOrder === 1)!;
    expect(t1.rulesApplied).toEqual(["summary"]);

    // ExecutionRecord persisted with mapped enum status + context
    expect(captured.record).toMatchObject({
      compositionId: "comp1",
      organizationId: "org1",
      userId: "u1",
      sessionId: "sess1",
      status: "PARTIAL",
    });
    expect(result.executionId).toBe("exec_test_1");
  });

  it("returns success when all stages pass with no fallback", async () => {
    mockDb.composition.findUnique.mockResolvedValue({
      id: "comp1",
      organizationId: "org1",
      name: "Happy path",
      stages: [
        stage({ order: 1, promptId: "p1", fallbackPromptId: null, successThreshold: 0.5, extractFields: ["summary"], transformRules: null }),
        stage({ order: 2, promptId: "p3", fallbackPromptId: null, successThreshold: 0.5, extractFields: [], transformRules: null }),
      ],
    });

    const result = await executeComposition("comp1", "hi", {
      organizationId: "org1",
      userId: "u1",
    });

    expect(result.status).toBe("success");
    expect(result.stages.every((s) => s.success && !s.fallbackApplied)).toBe(true);
    expect(captured.record).toMatchObject({ status: "SUCCESS", sessionId: null });
  });

  it("returns failed when a stage fails and has no fallback", async () => {
    mockDb.composition.findUnique.mockResolvedValue({
      id: "comp1",
      organizationId: "org1",
      name: "Failing chain",
      stages: [
        stage({ order: 1, promptId: "p2", fallbackPromptId: null, successThreshold: 0.5, extractFields: [], transformRules: null }),
      ],
    });

    const result = await executeComposition("comp1", "hi", {
      organizationId: "org1",
      userId: "u1",
    });

    expect(result.status).toBe("failed");
    expect(result.stages[0].success).toBe(false);
    expect(captured.traces).toHaveLength(1);
    expect(captured.traces[0].thresholdMet).toBe(false);
    expect(captured.record).toMatchObject({ status: "FAILED" });
  });
});
