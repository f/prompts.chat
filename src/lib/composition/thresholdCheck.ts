// Threshold check: score a stage output and decide whether it passes.
//
// Level 2 uses a minimal deterministic scorer: a non-empty, non-whitespace
// output scores 1.0, an empty output scores 0.0. This intentionally defers real
// scoring to Level 3 (heuristic -> model-based per EXECUTION-TRACE-SCORING-SPEC
// Q2) while still giving the orchestrator a real signal that can drop below the
// configured successThreshold (e.g. an empty/failed output) to drive fallback.

export interface ThresholdResult {
  score: number;
  passed: boolean;
}

export function checkThreshold(output: string, successThreshold: number): ThresholdResult {
  const score = output && output.trim().length > 0 ? 1 : 0;
  return { score, passed: score >= successThreshold };
}
