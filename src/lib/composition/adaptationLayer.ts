// Adaptation layer: transform stage N output -> stage N+1 input.
//
// Config-based (deterministic, debuggable) per EXECUTION-TRACE-SCORING-SPEC Q1.
// If the stage defines `extractFields`, we pull those fields out of the prior
// output (parsed as JSON when possible) and frame each with its `transformRules`
// entry. With no `extractFields`, the raw output is threaded straight through.

type TransformRules = Record<string, unknown>;

export interface AdaptationResult {
  adaptedInput: string;
  /** Names of fields whose transformRules entry actually fired (for the trace). */
  rulesApplied: string[];
}

function tryParseJsonObject(text: string): Record<string, unknown> | null {
  try {
    const parsed: unknown = JSON.parse(text);
    return parsed !== null && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

function stringifyValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  return JSON.stringify(value);
}

export function adaptOutput(
  output: string,
  extractFields: string[],
  transformRules: unknown,
): AdaptationResult {
  if (!extractFields || extractFields.length === 0) {
    return { adaptedInput: output, rulesApplied: [] };
  }

  const rules: TransformRules =
    transformRules !== null &&
    typeof transformRules === "object" &&
    !Array.isArray(transformRules)
      ? (transformRules as TransformRules)
      : {};

  const parsed = tryParseJsonObject(output);
  const parts: string[] = [];
  const rulesApplied: string[] = [];

  for (const field of extractFields) {
    // Prefer the extracted field from structured output; otherwise fall back to
    // the whole output so the chain still threads information forward.
    const value =
      parsed && field in parsed ? stringifyValue(parsed[field]) : output;
    const rule = rules[field];
    if (typeof rule === "string" && rule.length > 0) {
      parts.push(`${rule}: ${value}`);
      rulesApplied.push(field);
    } else {
      parts.push(`${field}: ${value}`);
    }
  }

  return { adaptedInput: parts.join("\n\n"), rulesApplied };
}
