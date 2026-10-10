import { db } from "@/lib/db";
import { resolveDag } from "./dagResolver";
import { executeStage } from "./stageExecutor";
import { adaptOutput } from "./adaptationLayer";
import { checkThreshold } from "./thresholdCheck";
import { persistExecution } from "./traceRecorder";
import type {
  ExecutionContext,
  ExecutionResult,
  ExecutionStatusLabel,
  StageResult,
  StageTraceInput,
} from "./types";

export type {
  ExecutionContext,
  ExecutionResult,
  StageResult,
} from "./types";

/**
 * Orchestrate a composition execution end-to-end:
 *   resolve -> for each stage { execute -> threshold -> fallback? } -> adapt -> trace
 * then persist one ExecutionRecord with its StageTrace rows.
 *
 * Status: "success" = all stages passed, no fallback. "partial" = completed but at
 * least one stage used fallback. "failed" = a stage produced no usable output and
 * had no working fallback (chain stops).
 */
export async function executeComposition(
  compositionId: string,
  input: string,
  context: ExecutionContext,
): Promise<ExecutionResult> {
  const composition = await db.composition.findUnique({
    where: { id: compositionId },
    include: { stages: true },
  });

  if (!composition) {
    throw new Error(`Composition not found: ${compositionId}`);
  }

  const stages = resolveDag(composition.stages);

  const stageResults: StageResult[] = [];
  const traces: StageTraceInput[] = [];

  // rawInput  = what the current stage received BEFORE adaptation
  // adaptedInput = what it received AFTER the previous stage's adaptation rules
  let rawInput = input;
  let adaptedInput = input;
  let lastOutput = "";
  let totalTokens = 0;
  let totalDurationMs = 0;
  let anyFallback = false;
  let chainFailed = false;

  for (let i = 0; i < stages.length; i++) {
    const stage = stages[i];

    let output = "";
    let tokensUsed = 0;
    let durationMs = 0;
    let model: string | null = null;
    let promptVersion = 1;
    let usedPromptId = stage.promptId;
    let fallbackApplied = false;
    let success = false;
    let score: number | null = null;
    let errorMessage: string | null = null;

    // --- primary attempt ---
    try {
      const r = await executeStage({ promptId: stage.promptId, input: adaptedInput });
      output = r.output;
      tokensUsed = r.tokensUsed;
      durationMs = r.duration;
      model = r.model;
      promptVersion = r.promptVersion;
      const tc = checkThreshold(output, stage.successThreshold);
      score = tc.score;
      success = tc.passed;
    } catch (err) {
      errorMessage = err instanceof Error ? err.message : String(err);
      success = false;
    }

    // --- fallback when the primary failed or scored below threshold ---
    if (!success && stage.fallbackPromptId) {
      try {
        const fb = await executeStage({
          promptId: stage.fallbackPromptId,
          input: adaptedInput,
        });
        output = fb.output;
        tokensUsed += fb.tokensUsed;
        durationMs += fb.duration;
        model = fb.model;
        promptVersion = fb.promptVersion;
        usedPromptId = stage.fallbackPromptId;
        fallbackApplied = true;
        anyFallback = true;
        const tc = checkThreshold(output, stage.successThreshold);
        score = tc.score;
        success = tc.passed;
      } catch (err) {
        const fbErr = err instanceof Error ? err.message : String(err);
        errorMessage = errorMessage
          ? `${errorMessage}; fallback failed: ${fbErr}`
          : `fallback failed: ${fbErr}`;
        success = false;
      }
    }

    totalTokens += tokensUsed;
    totalDurationMs += durationMs;

    const trace: StageTraceInput = {
      stageOrder: stage.order,
      promptId: usedPromptId,
      promptVersion,
      rawInput,
      adaptedInput,
      output: output || null,
      tokensUsed,
      durationMs,
      score,
      thresholdMet: success,
      fallbackApplied,
      fallbackPromptId: stage.fallbackPromptId,
      model,
      rulesApplied: [],
      error: errorMessage,
    };
    traces.push(trace);

    stageResults.push({
      stageOrder: stage.order,
      promptId: usedPromptId,
      input: adaptedInput,
      output,
      tokensUsed,
      duration: durationMs,
      success,
      fallbackApplied,
    });

    if (!success) {
      // No usable output and no working fallback -> the chain cannot continue.
      chainFailed = true;
      break;
    }

    lastOutput = output;

    // --- adapt this stage's output into the next stage's input ---
    if (i < stages.length - 1) {
      const adaptation = adaptOutput(output, stage.extractFields, stage.transformRules);
      rawInput = output;
      adaptedInput = adaptation.adaptedInput;
      trace.rulesApplied = adaptation.rulesApplied;
    }
  }

  const status: ExecutionStatusLabel = chainFailed
    ? "failed"
    : anyFallback
      ? "partial"
      : "success";

  const executionId = await persistExecution(
    {
      compositionId,
      context,
      status,
      input,
      finalOutput: lastOutput,
      totalTokens,
      totalDurationMs,
    },
    traces,
  );

  return {
    executionId,
    status,
    stages: stageResults,
    finalOutput: lastOutput,
    totalTokens,
    totalDuration: totalDurationMs,
  };
}
