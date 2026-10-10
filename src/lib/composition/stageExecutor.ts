import { db } from "@/lib/db";
import { getLLMProvider } from "@/lib/ai/llm-provider";

export interface StageExecutionResult {
  output: string;
  tokensUsed: number;
  duration: number;
  model: string;
  promptVersion: number;
}

/**
 * Execute a single stage: load the prompt content (pinning the executed version),
 * invoke the active LLM provider with the stage input, and return the output plus
 * token/duration metrics.
 *
 * Throws on a missing prompt or a provider error — the orchestrator catches and
 * applies the stage's fallback.
 */
export async function executeStage(params: {
  promptId: string;
  input: string;
}): Promise<StageExecutionResult> {
  const { promptId, input } = params;

  const prompt = await db.prompt.findUnique({
    where: { id: promptId },
    select: {
      content: true,
      versions: {
        orderBy: { version: "desc" },
        take: 1,
        select: { version: true },
      },
    },
  });

  if (!prompt) {
    throw new Error(`Prompt not found: ${promptId}`);
  }

  const promptVersion = prompt.versions[0]?.version ?? 1;

  const start = Date.now();
  const result = await getLLMProvider().complete({
    system: prompt.content,
    prompt: input,
  });
  const duration = Date.now() - start;

  return {
    output: result.output,
    tokensUsed: result.inputTokens + result.outputTokens,
    duration,
    model: result.model,
    promptVersion,
  };
}
