import type { PrismaClient } from "@prisma/client";
import { db } from "@/lib/db";
import type {
  ExecutionContext,
  ExecutionStatusLabel,
  StageTraceInput,
} from "./types";

export interface ExecutionRecordInput {
  compositionId: string;
  context: ExecutionContext;
  status: ExecutionStatusLabel;
  input: string;
  finalOutput: string;
  totalTokens: number;
  totalDurationMs: number;
}

const STATUS_MAP = {
  success: "SUCCESS",
  partial: "PARTIAL",
  failed: "FAILED",
} as const;

/**
 * Persist the ExecutionRecord and all of its StageTrace rows atomically.
 * All LLM work is already done by the time this runs, so the transaction is short.
 * Returns the new executionId.
 */
export async function persistExecution(
  record: ExecutionRecordInput,
  traces: StageTraceInput[],
  client: PrismaClient = db,
): Promise<string> {
  const exec = await client.$transaction(async (tx) => {
    const created = await tx.executionRecord.create({
      data: {
        compositionId: record.compositionId,
        organizationId: record.context.organizationId,
        userId: record.context.userId,
        sessionId: record.context.sessionId ?? null,
        status: STATUS_MAP[record.status],
        input: record.input,
        finalOutput: record.finalOutput,
        totalTokens: record.totalTokens,
        totalDurationMs: record.totalDurationMs,
        completedAt: new Date(),
      },
    });

    if (traces.length > 0) {
      await tx.stageTrace.createMany({
        data: traces.map((t) => ({
          executionId: created.id,
          stageOrder: t.stageOrder,
          promptId: t.promptId,
          promptVersion: t.promptVersion,
          rawInput: t.rawInput,
          adaptedInput: t.adaptedInput,
          output: t.output,
          tokensUsed: t.tokensUsed,
          durationMs: t.durationMs,
          score: t.score,
          thresholdMet: t.thresholdMet,
          fallbackApplied: t.fallbackApplied,
          fallbackPromptId: t.fallbackPromptId,
          model: t.model,
          rulesApplied: t.rulesApplied,
          error: t.error,
        })),
      });
    }

    return created;
  });

  return exec.id;
}
