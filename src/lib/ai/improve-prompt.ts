import OpenAI from "openai";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { generateEmbedding, isAISearchEnabled } from "@/lib/ai/embeddings";
import { loadPrompt, getSystemPrompt, interpolatePrompt } from "@/lib/ai/load-prompt";
import { TYPE_DEFINITIONS } from "@/data/type-definitions";
import { logger } from "@/lib/logger";

const IMPROVE_MODEL = process.env.OPENAI_IMPROVE_MODEL || "gpt-4o";

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

export type OutputType = "text" | "image" | "video" | "sound";
export type OutputFormat = "text" | "structured_json" | "structured_yaml";

export interface ImprovePromptInput {
  prompt: string;
  outputType?: OutputType;
  outputFormat?: OutputFormat;
}

export interface ImprovePromptResult {
  original: string;
  improved: string;
  outputType: OutputType;
  outputFormat: OutputFormat;
  inspirations: Array<{ id: string; slug: string | null; title: string; similarity: number }>;
  model: string;
}

function cosineSimilarity(a: number[], b: number[]): number {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

function mapOutputTypeToDbType(outputType: OutputType): "TEXT" | "IMAGE" | "VIDEO" | "AUDIO" | null {
  switch (outputType) {
    case "image": return "IMAGE";
    case "video": return "VIDEO";
    case "sound": return "AUDIO";
    default: return null;
  }
}

async function findSimilarPrompts(
  query: string,
  outputType: OutputType,
  limit: number = 3
): Promise<Array<{ id: string; slug: string | null; title: string; content: string; similarity: number }>> {
  const aiSearchEnabled = await isAISearchEnabled();
  if (!aiSearchEnabled) {
    logger.debug("[improve-prompt] AI search is not enabled");
    return [];
  }

  try {
    const queryEmbedding = await generateEmbedding(query);
    const dbType = mapOutputTypeToDbType(outputType);

    const prompts = await db.prompt.findMany({
      where: {
        isPrivate: false,
        deletedAt: null,
        embedding: { not: Prisma.DbNull },
        ...(dbType ? { type: dbType } : {}),
      },
      select: {
        id: true,
        slug: true,
        title: true,
        content: true,
        embedding: true,
      },
      take: 100,
    });

    logger.debug({ count: prompts.length }, "[improve-prompt] Found prompts with embeddings");

    const SIMILARITY_THRESHOLD = 0.3;

    const scoredPrompts = prompts
      .map((prompt) => {
        const embedding = prompt.embedding as number[];
        const similarity = cosineSimilarity(queryEmbedding, embedding);
        return {
          id: prompt.id,
          slug: prompt.slug,
          title: prompt.title,
          content: prompt.content,
          similarity,
        };
      })
      .filter((prompt) => prompt.similarity >= SIMILARITY_THRESHOLD);

    scoredPrompts.sort((a, b) => b.similarity - a.similarity);

    return scoredPrompts.slice(0, limit);
  } catch (error) {
    logger.error({ error }, "[improve-prompt] Error finding similar prompts");
    return [];
  }
}

function formatSimilarPrompts(
  prompts: Array<{ title: string; content: string; similarity: number }>
): string {
  if (prompts.length === 0) {
    return "No similar prompts found for inspiration.";
  }

  return prompts
    .map(
      (p, i) =>
        `### Inspiration ${i + 1}: ${p.title}\n${p.content.slice(0, 500)}${p.content.length > 500 ? "..." : ""}`
    )
    .join("\n\n");
}

export async function improvePrompt(input: ImprovePromptInput): Promise<ImprovePromptResult> {
  const { prompt, outputType = "text", outputFormat = "text" } = input;

  if (!process.env.OPENAI_API_KEY) {
    throw new Error("AI features are not configured");
  }

  // Find similar prompts for inspiration
  const similarPrompts = await findSimilarPrompts(prompt, outputType);
  const similarPromptsText = formatSimilarPrompts(similarPrompts);

  // Load and interpolate the prompt template
  const improvePromptFile = loadPrompt("src/lib/ai/improve-prompt.prompt.yml");

  const systemPrompt = interpolatePrompt(getSystemPrompt(improvePromptFile), {
    similarPrompts: similarPromptsText,
    typeDefinitions: TYPE_DEFINITIONS,
  });

  const userMessage = improvePromptFile.messages.find((m) => m.role === "user");
  const userPrompt = interpolatePrompt(userMessage?.content || "", {
    outputFormat,
    outputType,
    originalPrompt: prompt,
  });

  // Call OpenAI
  const client = getOpenAIClient();
  const response = await client.chat.completions.create({
    model: IMPROVE_MODEL,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    temperature: improvePromptFile.modelParameters?.temperature ?? 0.7,
    max_tokens: improvePromptFile.modelParameters?.maxTokens ?? 4000,
  });

  const improvedPrompt = response.choices[0]?.message?.content?.trim() || "";

  if (!improvedPrompt) {
    throw new Error("Failed to generate improved prompt");
  }

  return {
    original: prompt,
    improved: improvedPrompt,
    outputType,
    outputFormat,
    inspirations: similarPrompts.map((p) => ({
      id: p.id,
      slug: p.slug,
      title: p.title,
      similarity: Math.round(p.similarity * 100),
    })),
    model: IMPROVE_MODEL,
  };
}
