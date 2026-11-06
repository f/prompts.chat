#!/usr/bin/env npx tsx
/**
 * Validates prompts.csv for structure, content quality, and duplicates.
 *
 * Usage:
 *   npx tsx scripts/validate-prompts-csv.ts
 *   npx tsx scripts/validate-prompts-csv.ts --json   # machine-readable output
 *
 * Exit codes:
 *   0 = no errors (warnings are allowed)
 *   1 = validation errors found
 */

import fs from "fs/promises";
import path from "path";
import { parse } from "csv-parse/sync";
import {
  normalizeContent,
  calculateSimilarity,
} from "../src/lib/similarity";

// --- Types ---

const EXPECTED_HEADER = ["act", "prompt", "for_devs", "type", "contributor"];
const VALID_TYPES = new Set(["TEXT", "JSON", "YAML", "IMAGE", "VIDEO", "AUDIO", "STRUCTURED"]);
const VALID_FOR_DEVS = new Set(["TRUE", "FALSE"]);
const MIN_CONTENT_LENGTH = 50;
const SIMILARITY_THRESHOLD = 0.90;
const MAX_BUCKET_SIZE = 50;

interface CsvRow {
  act: string;
  prompt: string;
  for_devs: string;
  type: string;
  contributor: string;
}

interface PromptInput {
  rowNumber: number;
  title: string;
  content: string;
  forDevs: boolean;
  type: string;
  contributors: string[];
}

type Severity = "error" | "warning";

interface Issue {
  severity: Severity;
  row: number | null;
  check: string;
  message: string;
}

interface DuplicatePair {
  rowA: number;
  titleA: string;
  rowB: number;
  titleB: string;
  similarity: number;
}

interface ValidationReport {
  file: string;
  rowsChecked: number;
  errors: number;
  warnings: number;
  issues: Issue[];
  nearDuplicatePrompts: DuplicatePair[];
}

// --- CSV loading ---

async function loadCsvFile(filePath: string): Promise<string> {
  return fs.readFile(filePath, "utf-8");
}

function parseCsvRows(content: string): { header: string[]; records: string[][] } {
  // csv-parse handles RFC 4180: quoted fields, escaped quotes, multiline fields
  const records: string[][] = parse(content, {
    relax_column_count: true,
    skip_empty_lines: false,
  });

  if (records.length === 0) {
    return { header: [], records: [] };
  }

  const header = records[0];
  return { header, records: records.slice(1) };
}

// --- Row conversion ---

function csvRowToPromptInput(columns: string[], rowNumber: number): { prompt: PromptInput | null; issues: Issue[] } {
  const issues: Issue[] = [];

  if (columns.length !== 5) {
    issues.push({
      severity: "error",
      row: rowNumber,
      check: "structure",
      message: `Expected 5 columns, got ${columns.length}`,
    });
    return { prompt: null, issues };
  }

  const [act, prompt, forDevs, type, contributor] = columns;

  const title = act.trim();
  const content = prompt; // preserve content whitespace intentionally
  const forDevsVal = forDevs.trim().toUpperCase();
  const typeVal = type.trim().toUpperCase();
  const contributorVal = contributor.trim();

  // Required fields
  if (!title) {
    issues.push({ severity: "error", row: rowNumber, check: "required_field", message: "Empty title (act)" });
  }
  if (!content.trim()) {
    issues.push({ severity: "error", row: rowNumber, check: "required_field", message: "Empty content (prompt)" });
  }
  if (!contributorVal) {
    issues.push({ severity: "error", row: rowNumber, check: "required_field", message: "Empty contributor" });
  }

  // Value constraints
  if (forDevsVal && !VALID_FOR_DEVS.has(forDevsVal)) {
    issues.push({
      severity: "error",
      row: rowNumber,
      check: "value_constraint",
      message: `Invalid for_devs value "${forDevs.trim()}", expected TRUE or FALSE`,
    });
  }
  if (typeVal && !VALID_TYPES.has(typeVal)) {
    issues.push({
      severity: "error",
      row: rowNumber,
      check: "value_constraint",
      message: `Invalid type value "${type.trim()}", expected one of: ${[...VALID_TYPES].join(", ")}`,
    });
  }

  // Content quality
  if (content.trim().length > 0 && content.trim().length < MIN_CONTENT_LENGTH) {
    issues.push({
      severity: "warning",
      row: rowNumber,
      check: "content_quality",
      message: `Content is only ${content.trim().length} characters (minimum recommended: ${MIN_CONTENT_LENGTH})`,
    });
  }

  // Parse contributors
  const contributors = contributorVal
    ? contributorVal.split(",").map((c) => c.trim()).filter(Boolean)
    : [];

  const promptInput: PromptInput = {
    rowNumber,
    title,
    content,
    forDevs: forDevsVal === "TRUE",
    type: typeVal || "TEXT",
    contributors,
  };

  return { prompt: promptInput, issues };
}

// --- Spam heuristics ---

const MAX_URLS = 3;
const MAX_WORD_REPEATS = 30;
const MAX_CONTENT_LENGTH = 20_000;
const REPEATED_CHARS_RE = /([!?.])\1{3,}/; // 4+ of the same punctuation in a row
const STOP_WORDS = new Set([
  "the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for",
  "of", "with", "by", "from", "as", "is", "was", "are", "were", "be",
  "been", "being", "have", "has", "had", "do", "does", "did", "will",
  "would", "could", "should", "may", "might", "shall", "can", "need",
  "it", "its", "you", "your", "we", "our", "they", "their", "this",
  "that", "these", "those", "not", "no", "if", "then", "else", "when",
  "up", "out", "so", "about", "into", "than", "also", "each", "which",
  "any", "all", "more", "most", "such", "only", "other", "new", "one",
]);

function checkSpamHeuristics(prompt: PromptInput): Issue[] {
  const issues: Issue[] = [];
  const { content, rowNumber, title } = prompt;
  const label = `"${title}"`;

  // URLs
  const urls = content.match(/https?:\/\/[^\s)>"',]+/gi);
  if (urls && urls.length > MAX_URLS) {
    issues.push({
      severity: "warning",
      row: rowNumber,
      check: "spam_heuristic",
      message: `${label} contains ${urls.length} URLs (max ${MAX_URLS})`,
    });
  }

  // Repeated punctuation
  if (REPEATED_CHARS_RE.test(content)) {
    issues.push({
      severity: "warning",
      row: rowNumber,
      check: "spam_heuristic",
      message: `${label} contains repeated punctuation characters`,
    });
  }

  // Same word repeated excessively
  const words = content.toLowerCase().split(/\s+/).filter(Boolean);
  const freq = new Map<string, number>();
  for (const w of words) {
    freq.set(w, (freq.get(w) || 0) + 1);
  }
  for (const [word, count] of freq) {
    const isMarkdown = /^[-#`=~>|*]{2,}$/.test(word);
    if (count > MAX_WORD_REPEATS && word.length > 2 && !STOP_WORDS.has(word) && !isMarkdown) {
      issues.push({
        severity: "warning",
        row: rowNumber,
        check: "spam_heuristic",
        message: `${label} repeats word "${word}" ${count} times`,
      });
      break; // one warning per prompt is enough
    }
  }

  // Excessive length
  if (content.length > MAX_CONTENT_LENGTH) {
    issues.push({
      severity: "warning",
      row: rowNumber,
      check: "spam_heuristic",
      message: `${label} is ${content.length.toLocaleString()} characters (threshold: ${MAX_CONTENT_LENGTH.toLocaleString()})`,
    });
  }

  return issues;
}

// --- Duplicate detection ---

function findExactTitleDuplicates(prompts: PromptInput[]): Issue[] {
  const issues: Issue[] = [];
  const titleMap = new Map<string, number[]>();

  for (const p of prompts) {
    const key = p.title.toLowerCase();
    const rows = titleMap.get(key) || [];
    rows.push(p.rowNumber);
    titleMap.set(key, rows);
  }

  for (const [title, rows] of titleMap) {
    if (rows.length > 1) {
      issues.push({
        severity: "warning",
        row: rows[0],
        check: "duplicate_title",
        message: `Duplicate title "${title}" found in rows: ${rows.join(", ")}`,
      });
    }
  }

  return issues;
}

function findNearDuplicateTitles(prompts: PromptInput[]): Issue[] {
  const issues: Issue[] = [];
  const normalizedMap = new Map<string, number[]>();

  for (const p of prompts) {
    const key = normalizeContent(p.title);
    if (!key) continue;
    const rows = normalizedMap.get(key) || [];
    rows.push(p.rowNumber);
    normalizedMap.set(key, rows);
  }

  for (const [, rows] of normalizedMap) {
    if (rows.length > 1) {
      // Only report if not already an exact-title duplicate
      const titles = rows.map((r) => prompts.find((p) => p.rowNumber === r)!.title);
      const allSame = titles.every((t) => t.toLowerCase() === titles[0].toLowerCase());
      if (!allSame) {
        issues.push({
          severity: "warning",
          row: rows[0],
          check: "near_duplicate_title",
          message: `Near-duplicate titles in rows ${rows.join(", ")}: ${titles.map((t) => `"${t}"`).join(" vs ")}`,
        });
      }
    }
  }

  return issues;
}

/**
 * Two-stage near-duplicate detection designed for 100k+ prompts.
 *
 * Stage 1 (cheap, O(n)):
 *   - Normalize once, truncate to NORM_CAP chars to bound memory
 *   - Pre-compute word count per prompt
 *   - Build buckets (fingerprint + first-3-words), all capped at MAX_BUCKET_SIZE
 *   - For each candidate pair, apply a length pre-filter:
 *     skip if word counts differ by >50% (can't reach 0.90 similarity)
 *
 * Stage 2 (expensive, only on surviving candidates):
 *   - Run calculateSimilarity on the pre-normalized (already clean) strings
 *   - Since normalizeContent is idempotent, passing pre-normalized text
 *     to calculateSimilarity avoids redundant regex work inside it
 */

const NORM_CAP = 5000; // Truncate normalized content to bound memory and n-gram cost
const LENGTH_RATIO_FILTER = 0.5; // Skip pairs where shorter/longer < 0.5
const SUB_BUCKET_THRESHOLD = 200; // Split buckets larger than this into sub-buckets
const SUB_BUCKET_OFFSET = 200; // Secondary key starts after the primary fingerprint
const SUB_BUCKET_LENGTH = 120; // Length of the secondary hash key

function findNearDuplicatePrompts(prompts: PromptInput[]): { issues: Issue[]; pairs: DuplicatePair[] } {
  const issues: Issue[] = [];
  const pairs: DuplicatePair[] = [];
  const n = prompts.length;

  // --- Stage 1: cheap pre-processing ---

  // Normalize once and truncate to cap memory and n-gram cost
  const normalized: string[] = new Array(n);
  const wordCounts: number[] = new Array(n);
  for (let i = 0; i < n; i++) {
    const full = normalizeContent(prompts[i].content);
    normalized[i] = full.length > NORM_CAP ? full.slice(0, NORM_CAP) : full;
    wordCounts[i] = normalized[i].split(" ").length;
  }

  // Pre-compute character lengths for the length-difference filter
  const charLengths: number[] = new Array(n);
  for (let i = 0; i < n; i++) {
    charLengths[i] = normalized[i].length;
  }

  // Build candidate pairs from multiple bucket strategies, all capped
  const candidatePairs = new Set<string>();

  // Stage 1 length gate: skip pairs where the shorter text is less than
  // half the length of the longer text. Two strings that differ by >2x in
  // character count cannot reach 0.90 Jaccard+n-gram similarity.
  function emitPairs(indices: number[]): void {
    for (let a = 0; a < indices.length; a++) {
      for (let b = a + 1; b < indices.length; b++) {
        const lenA = charLengths[indices[a]];
        const lenB = charLengths[indices[b]];
        const shorter = Math.min(lenA, lenB);
        const longer = Math.max(lenA, lenB);
        if (longer > 0 && shorter / longer < LENGTH_RATIO_FILTER) continue;
        candidatePairs.add(`${indices[a]}:${indices[b]}`);
      }
    }
  }

  function addBucketPairs(buckets: Map<string, number[]>): void {
    for (const indices of buckets.values()) {
      if (indices.length < 2) continue;

      // Small bucket: emit pairs directly
      if (indices.length <= MAX_BUCKET_SIZE) {
        emitPairs(indices);
        continue;
      }

      // Large bucket (> MAX_BUCKET_SIZE): split into sub-buckets
      // using a secondary key (next 120 chars of normalized content)
      if (indices.length <= SUB_BUCKET_THRESHOLD) {
        // Between MAX_BUCKET_SIZE and SUB_BUCKET_THRESHOLD: skip entirely
        // (too large for direct pairing, too small to warrant sub-bucketing)
        continue;
      }

      // Over SUB_BUCKET_THRESHOLD: split by secondary hash
      const subBuckets = new Map<string, number[]>();
      for (const idx of indices) {
        const subKey = normalized[idx].slice(SUB_BUCKET_OFFSET, SUB_BUCKET_OFFSET + SUB_BUCKET_LENGTH);
        const sub = subBuckets.get(subKey);
        if (sub) sub.push(idx);
        else subBuckets.set(subKey, [idx]);
      }

      for (const subIndices of subBuckets.values()) {
        if (subIndices.length >= 2 && subIndices.length <= MAX_BUCKET_SIZE) {
          emitPairs(subIndices);
        }
        // Sub-buckets that are still too large are dropped —
        // these prompts share 320+ identical normalized chars
        // and will be caught by the fingerprint bucket instead
      }
    }
  }

  // Bucket A: fingerprint (first 200 chars of normalized content)
  const fingerprintBuckets = new Map<string, number[]>();
  for (let i = 0; i < n; i++) {
    const key = normalized[i].slice(0, 200);
    if (!key) continue;
    const bucket = fingerprintBuckets.get(key);
    if (bucket) bucket.push(i);
    else fingerprintBuckets.set(key, [i]);
  }
  addBucketPairs(fingerprintBuckets);

  // Bucket B: first 3 normalized words
  const wordBuckets = new Map<string, number[]>();
  for (let i = 0; i < n; i++) {
    const words = normalized[i].split(" ");
    const key = words.slice(0, 3).join(" ");
    if (!key) continue;
    const bucket = wordBuckets.get(key);
    if (bucket) bucket.push(i);
    else wordBuckets.set(key, [i]);
  }
  addBucketPairs(wordBuckets);

  // --- Stage 2: expensive similarity only on surviving candidates ---

  const reported = new Set<string>();

  for (const pairKey of candidatePairs) {
    const [ai, bi] = pairKey.split(":").map(Number);

    // Stage 2 length guard (word count) — catches cases the char-length
    // filter in emitPairs let through due to differing word/char ratios
    const wcA = wordCounts[ai];
    const wcB = wordCounts[bi];
    if (Math.min(wcA, wcB) / Math.max(wcA, wcB) < LENGTH_RATIO_FILTER) continue;

    // Feed pre-normalized text to calculateSimilarity
    // (normalizeContent is idempotent, so the internal re-normalization is a no-op)
    const score = calculateSimilarity(normalized[ai], normalized[bi]);
    if (score >= SIMILARITY_THRESHOLD) {
      const pa = prompts[ai];
      const pb = prompts[bi];
      const dedupKey = [pa.rowNumber, pb.rowNumber].sort().join(",");
      if (reported.has(dedupKey)) continue;
      reported.add(dedupKey);

      pairs.push({
        rowA: pa.rowNumber,
        titleA: pa.title,
        rowB: pb.rowNumber,
        titleB: pb.title,
        similarity: Math.round(score * 1000) / 1000,
      });

      issues.push({
        severity: "warning",
        row: pa.rowNumber,
        check: "near_duplicate_prompt",
        message: `Near-duplicate prompt (${(score * 100).toFixed(1)}%): row ${pa.rowNumber} ("${pa.title}") ↔ row ${pb.rowNumber} ("${pb.title}")`,
      });
    }
  }

  return { issues, pairs };
}

// --- Header validation ---

function validateHeader(header: string[]): Issue[] {
  const issues: Issue[] = [];

  if (header.length !== EXPECTED_HEADER.length) {
    issues.push({
      severity: "error",
      row: 1,
      check: "header",
      message: `Expected ${EXPECTED_HEADER.length} header columns, got ${header.length}`,
    });
    return issues;
  }

  for (let i = 0; i < EXPECTED_HEADER.length; i++) {
    if (header[i].trim().toLowerCase() !== EXPECTED_HEADER[i]) {
      issues.push({
        severity: "error",
        row: 1,
        check: "header",
        message: `Column ${i + 1} header should be "${EXPECTED_HEADER[i]}", got "${header[i]}"`,
      });
    }
  }

  return issues;
}

// --- Dataset drift detection ---

const BASELINE_ROW_COUNT = 1391; // Updated: 2026-03-03. Bump when prompts.csv grows intentionally.
const DROP_THRESHOLD = 0.10; // >10% drop = error (data loss)
const SPIKE_THRESHOLD = 0.30; // >30% increase = warning (bulk import review)

function checkDatasetDrift(count: number): Issue[] {
  const issues: Issue[] = [];

  const dropLimit = Math.floor(BASELINE_ROW_COUNT * (1 - DROP_THRESHOLD));
  const spikeLimit = Math.ceil(BASELINE_ROW_COUNT * (1 + SPIKE_THRESHOLD));

  if (count < dropLimit) {
    const dropPct = (((BASELINE_ROW_COUNT - count) / BASELINE_ROW_COUNT) * 100).toFixed(1);
    issues.push({
      severity: "error",
      row: null,
      check: "dataset_drift",
      message: `Row count dropped ${dropPct}%: ${count} rows vs ${BASELINE_ROW_COUNT} baseline (min ${dropLimit}). Possible truncation or data loss.`,
    });
  } else if (count > spikeLimit) {
    const spikePct = (((count - BASELINE_ROW_COUNT) / BASELINE_ROW_COUNT) * 100).toFixed(1);
    issues.push({
      severity: "warning",
      row: null,
      check: "dataset_drift",
      message: `Row count increased ${spikePct}%: ${count} rows vs ${BASELINE_ROW_COUNT} baseline (max before warning: ${spikeLimit}). Review bulk additions and update BASELINE_ROW_COUNT.`,
    });
  }

  return issues;
}

// --- Main ---

async function main(): Promise<void> {
  const jsonOutput = process.argv.includes("--json");
  const csvPath = path.join(process.cwd(), "prompts.csv");

  const report: ValidationReport = {
    file: csvPath,
    rowsChecked: 0,
    errors: 0,
    warnings: 0,
    issues: [],
    nearDuplicatePrompts: [],
  };

  // Load and parse
  let content: string;
  try {
    content = await loadCsvFile(csvPath);
  } catch {
    report.issues.push({
      severity: "error",
      row: null,
      check: "file_read",
      message: `Cannot read ${csvPath}`,
    });
    report.errors = 1;
    printReport(report, jsonOutput);
    process.exit(1);
  }

  const { header, records } = parseCsvRows(content);

  // Check 1: header validation
  report.issues.push(...validateHeader(header));

  // Bail early if header is broken
  if (report.issues.some((i) => i.check === "header" && i.severity === "error")) {
    report.errors = report.issues.filter((i) => i.severity === "error").length;
    report.warnings = report.issues.filter((i) => i.severity === "warning").length;
    printReport(report, jsonOutput);
    process.exit(1);
  }

  // Check 2-5: convert rows and validate structure/values/quality
  const prompts: PromptInput[] = [];
  for (let i = 0; i < records.length; i++) {
    const rowNumber = i + 2; // +2: 1-indexed + header row
    const { prompt, issues } = csvRowToPromptInput(records[i], rowNumber);
    report.issues.push(...issues);
    if (prompt) {
      prompts.push(prompt);
    }
  }

  report.rowsChecked = records.length;

  // Check 6: spam heuristics
  for (const prompt of prompts) {
    report.issues.push(...checkSpamHeuristics(prompt));
  }

  // Check 7: dataset drift (drop >10% = error, spike >30% = warning)
  report.issues.push(...checkDatasetDrift(records.length));

  // Check 7: exact title duplicates
  report.issues.push(...findExactTitleDuplicates(prompts));

  // Check 8: near-duplicate prompts (bucket strategy, similarity >= 0.90)
  const { issues: dupIssues, pairs: dupPairs } = findNearDuplicatePrompts(prompts);
  report.issues.push(...dupIssues);
  report.nearDuplicatePrompts = dupPairs;

  // Check 9: near-duplicate titles
  report.issues.push(...findNearDuplicateTitles(prompts));

  // Tally
  report.errors = report.issues.filter((i) => i.severity === "error").length;
  report.warnings = report.issues.filter((i) => i.severity === "warning").length;

  // Write persistent report for maintainer observability
  await writeReportFile(report);

  printReport(report, jsonOutput);
  process.exit(report.errors > 0 ? 1 : 0);
}

// --- Report file ---

const REPORT_DIR = path.join(process.cwd(), ".validation");
const REPORT_FILE = path.join(REPORT_DIR, "validation-report.json");

async function writeReportFile(report: ValidationReport): Promise<void> {
  const summary = {
    timestamp: new Date().toISOString(),
    total_rows: report.rowsChecked,
    errors_count: report.errors,
    warnings_count: report.warnings,
    baseline_row_count: BASELINE_ROW_COUNT,
    checks: Object.fromEntries(
      report.issues.reduce((map, issue) => {
        const entry = map.get(issue.check) || { errors: 0, warnings: 0 };
        if (issue.severity === "error") entry.errors++;
        else entry.warnings++;
        map.set(issue.check, entry);
        return map;
      }, new Map<string, { errors: number; warnings: number }>())
    ),
    near_duplicate_prompts: report.nearDuplicatePrompts,
  };

  try {
    await fs.mkdir(REPORT_DIR, { recursive: true });
    await fs.writeFile(REPORT_FILE, JSON.stringify(summary, null, 2) + "\n");
  } catch (err) {
    // Non-fatal: don't fail validation because the report file couldn't be written
    console.error(`Warning: could not write report to ${REPORT_FILE}:`, err);
  }
}

// --- Output ---

function printReport(report: ValidationReport, json: boolean): void {
  if (json) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  console.log("\n=== Prompt CSV Validation Report ===\n");
  console.log(`File:         ${report.file}`);
  console.log(`Rows checked: ${report.rowsChecked}`);
  console.log(`Errors:       ${report.errors}`);
  console.log(`Warnings:     ${report.warnings}`);

  if (report.issues.length > 0) {
    // Group by check
    const byCheck = new Map<string, Issue[]>();
    for (const issue of report.issues) {
      const list = byCheck.get(issue.check) || [];
      list.push(issue);
      byCheck.set(issue.check, list);
    }

    for (const [check, issues] of byCheck) {
      console.log(`\n--- ${check} (${issues.length}) ---`);
      for (const issue of issues) {
        const prefix = issue.severity === "error" ? "  ERROR" : "  WARN ";
        const rowStr = issue.row ? ` row ${issue.row}:` : "";
        console.log(`${prefix}${rowStr} ${issue.message}`);
      }
    }
  }

  console.log("\n" + (report.errors === 0 ? "PASSED (no errors)" : "FAILED") + "\n");
}

main().catch((err) => {
  console.error("Validation script failed:", err);
  process.exit(1);
});
