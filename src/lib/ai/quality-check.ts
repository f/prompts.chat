import OpenAI from "openai";
import { loadPrompt, getSystemPrompt } from "./load-prompt";
import { logger, logQualityCheck, logQualityCheckResult, logQualityCheckError } from "@/lib/logger";

const qualityCheckPrompt = loadPrompt("src/lib/ai/quality-check.prompt.yml");

// DelistReason enum values (matches Prisma schema)
export type DelistReason = "TOO_SHORT" | "NOT_ENGLISH" | "LOW_QUALITY" | "NOT_LLM_INSTRUCTION" | "MANUAL";

let openai: OpenAI | null = null;

function getOpenAIClient(): OpenAI {
  if (!openai) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error("OPENAI_API_KEY is not set");
    }
    openai = new OpenAI({ 
      apiKey,
      baseURL: process.env.OPENAI_BASE_URL || undefined,
    });
  }
  return openai;
}

const GENERATIVE_MODEL = process.env.OPENAI_GENERATIVE_MODEL || "gpt-4o";

// Minimum character count for prompt content
const MIN_CONTENT_LENGTH = 50;

// Minimum word count for prompt content
const MIN_WORD_COUNT = 10;

export interface QualityCheckResult {
  shouldDelist: boolean;
  reason: DelistReason | null;
  confidence: number;
  details: string;
}

/**
 * Performs basic length checks on prompt content
 */
function checkLength(content: string): QualityCheckResult | null {
  const trimmed = content.trim();
  const wordCount = trimmed.split(/\s+/).filter(w => w.length > 0).length;

  if (trimmed.length < MIN_CONTENT_LENGTH) {
    return {
      shouldDelist: true,
      reason: "TOO_SHORT",
      confidence: 1.0,
      details: `Content is too short (${trimmed.length} chars, minimum ${MIN_CONTENT_LENGTH})`,
    };
  }

  if (wordCount < MIN_WORD_COUNT) {
    return {
      shouldDelist: true,
      reason: "TOO_SHORT",
      confidence: 1.0,
      details: `Content has too few words (${wordCount} words, minimum ${MIN_WORD_COUNT})`,
    };
  }

  return null;
}

/**
 * AI-powered quality check for prompt content
 * Returns quality assessment with high precision to avoid false positives
 */
export async function checkPromptQuality(
  title: string,
  content: string,
  description?: string | null
): Promise<QualityCheckResult> {
  logQualityCheck(title, content.length);
  
  // First, run basic length checks (no AI needed)
  const lengthCheck = checkLength(content);
  if (lengthCheck) {
    logQualityCheckResult(lengthCheck);
    return lengthCheck;
  }

  // Check if OpenAI is available
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    logger.debug("[Quality Check] No OpenAI API key - skipping AI check");
    // If no AI available, pass the check (avoid false positives)
    return {
      shouldDelist: false,
      reason: null,
      confidence: 0,
      details: "AI quality check skipped - no API key configured",
    };
  }
  
  logger.debug("[Quality Check] Running AI check...");

  try {
    const client = getOpenAIClient();

    const systemPrompt = getSystemPrompt(qualityCheckPrompt);

    const userMessage = `Title: ${title}
${description ? `Description: ${description}\n` : ""}
Content:
${content}`;

    const response = await client.chat.completions.create({
      model: GENERATIVE_MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage }
      ],
      temperature: 0.1, // Low temperature for consistent results
      max_tokens: 300,
      response_format: { type: "json_object" },
    });

    const responseText = response.choices[0]?.message?.content || "{}";
    logger.debug({ responseText }, "[Quality Check] AI response");
    
    try {
      const result = JSON.parse(responseText);
      
      // Extra safety: only delist if confidence is high enough
      if (result.shouldDelist && result.confidence < 0.85) {
        return {
          shouldDelist: false,
          reason: null,
          confidence: result.confidence,
          details: `Below confidence threshold: ${result.details}`,
        };
      }

      return {
        shouldDelist: !!result.shouldDelist,
        reason: result.reason as DelistReason | null,
        confidence: result.confidence || 0,
        details: result.details || "Quality check completed",
      };
    } catch {
      logQualityCheckError(new Error("Failed to parse AI quality check response"));
      // On parse error, don't delist (avoid false positives)
      return {
        shouldDelist: false,
        reason: null,
        confidence: 0,
        details: "Failed to parse AI response - defaulting to approve",
      };
    }
  } catch (error) {
    logQualityCheckError(error);
    // On error, don't delist (avoid false positives)
    return {
      shouldDelist: false,
      reason: null,
      confidence: 0,
      details: "AI quality check failed - defaulting to approve",
    };
  }
}

/**
 * Check if auto-delist feature is enabled
 */
export async function isAutoDelistEnabled(): Promise<boolean> {
  // Auto-delist requires OpenAI API key for AI checks
  // Basic length checks will still work without it
  return true;
}
