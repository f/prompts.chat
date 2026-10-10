// Shared types for the Composition Engine (Level 2).

export type ExecutionStatusLabel = "success" | "partial" | "failed";

export interface ExecutionContext {
  organizationId: string;
  userId: string;
  sessionId?: string | null;
}

/** Per-stage result returned to API callers (matches the execute response schema). */
export interface StageResult {
  stageOrder: number;
  promptId: string;
  input: string;
  output: string;
  tokensUsed: number;
  duration: number;
  success: boolean;
  fallbackApplied: boolean;
}

export interface ExecutionResult {
  executionId: string;
  status: ExecutionStatusLabel;
  stages: StageResult[];
  finalOutput: string;
  totalTokens: number;
  totalDuration: number;
}

/**
 * Richer per-stage trace captured internally. Maps onto the audited StageTrace
 * columns (rawInput/adaptedInput/promptVersion/score/thresholdMet/...), preserved
 * so Level-3 scoring stays migration-free. `thresholdMet` is the engine's `success`.
 */
export interface StageTraceInput {
  stageOrder: number;
  promptId: string;
  promptVersion: number;
  rawInput: string;
  adaptedInput: string;
  output: string | null;
  tokensUsed: number;
  durationMs: number;
  score: number | null;
  thresholdMet: boolean | null;
  fallbackApplied: boolean;
  fallbackPromptId: string | null;
  model: string | null;
  rulesApplied: string[];
  error: string | null;
}
