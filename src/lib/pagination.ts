interface ParseLimitOptions {
  /** Value used when the input is missing or not a valid integer. */
  defaultValue: number;
  /** Smallest allowed value (inclusive). Defaults to 1. */
  min?: number;
  /** Largest allowed value (inclusive). */
  max: number;
}

/**
 * Parse a user-supplied `limit` query parameter into a safe integer.
 *
 * - Missing, empty, or non-integer input (e.g. "abc", "1.5", "10abc") falls
 *   back to `defaultValue`, instead of leaking `NaN` into Prisma's `take` or
 *   `Array#slice`.
 * - Valid integers are clamped to the inclusive range [min, max], so negative
 *   and oversized values cannot be used.
 */
export function parseLimit(
  raw: string | null | undefined,
  { defaultValue, min = 1, max }: ParseLimitOptions,
): number {
  const trimmed = raw?.trim();
  if (!trimmed || !/^-?\d+$/.test(trimmed)) {
    return defaultValue;
  }

  const parsed = Number.parseInt(trimmed, 10);
  if (!Number.isSafeInteger(parsed)) {
    return max;
  }

  return Math.min(Math.max(parsed, min), max);
}
