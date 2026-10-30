import OpenAI from "openai";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { getConfig } from "@/lib/config";
import { NON_BOT_PROMPTS } from "@/lib/prompt-list";
import { loadPrompt, getSystemPrompt } from "./load-prompt";

const queryTranslatorPrompt = loadPrompt("src/lib/ai/query-translator.prompt.yml");

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

const EMBEDDING_MODEL = process.env.OPENAI_EMBEDDING_MODEL || "text-embedding-3-small";
const TRANSLATION_MODEL = process.env.OPENAI_TRANSLATION_MODEL || "gpt-4o-mini";

/**
 * Translate a non-English search query to English keywords for better semantic search.
 * Uses a cheap model to extract and translate keywords.
 */
export async function translateQueryToEnglish(query: string): Promise<string> {
  const client = getOpenAIClient();
  
  try {
    const response = await client.chat.completions.create({
      model: TRANSLATION_MODEL,
      messages: [
        {
          role: "system",
          content: getSystemPrompt(queryTranslatorPrompt)
        },
        {
          role: "user",
          content: query
        }
      ],
      max_tokens: queryTranslatorPrompt.modelParameters?.maxTokens || 100,
      temperature: queryTranslatorPrompt.modelParameters?.temperature || 0,
    });
    
    const translatedQuery = response.choices[0]?.message?.content?.trim();
    return translatedQuery || query;
  } catch (error) {
    // If translation fails, return original query
    console.error("Query translation failed:", error);
    return query;
  }
}

/**
 * Check if a string contains non-ASCII characters (likely non-English)
 */
function containsNonEnglish(text: string): boolean {
  // Check for characters outside basic ASCII range (excluding common punctuation)
  // This catches Chinese, Arabic, Japanese, Korean, Cyrillic, etc.
  return /[^\x00-\x7F]/.test(text);
}

export async function generateEmbedding(text: string): Promise<number[]> {
  const client = getOpenAIClient();
  
  const response = await client.embeddings.create({
    model: EMBEDDING_MODEL,
    input: text,
  });
  
  return response.data[0].embedding;
}

export async function generatePromptEmbedding(promptId: string): Promise<void> {
  const config = await getConfig();
  if (!config.features.aiSearch) return;

  const prompt = await db.prompt.findUnique({
    where: { id: promptId },
    select: { title: true, description: true, content: true, isPrivate: true },
  });

  if (!prompt) return;

  // Never generate embeddings for private prompts
  if (prompt.isPrivate) return;

  // Combine title, description, and content for embedding
  const textToEmbed = [
    prompt.title,
    prompt.description || "",
    prompt.content,
  ].join("\n\n").trim();

  const embedding = await generateEmbedding(textToEmbed);
  
  await db.prompt.update({
    where: { id: promptId },
    data: { embedding },
  });
}

// Delay helper to avoid rate limits
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function generateAllEmbeddings(
  onProgress?: (current: number, total: number, success: number, failed: number) => void,
  regenerate: boolean = false
): Promise<{ success: number; failed: number; total: number }> {
  const config = await getConfig();
  if (!config.features.aiSearch) {
    throw new Error("AI Search is not enabled");
  }

  const prompts = await db.prompt.findMany({
    where: { 
      ...(regenerate ? {} : { embedding: { equals: Prisma.DbNull } }),
      isPrivate: false,
      deletedAt: null,
    },
    select: { id: true },
  });

  const total = prompts.length;
  let success = 0;
  let failed = 0;

  for (let i = 0; i < prompts.length; i++) {
    const prompt = prompts[i];
    try {
      await generatePromptEmbedding(prompt.id);
      success++;
    } catch {
      failed++;
    }
    
    // Report progress
    if (onProgress) {
      onProgress(i + 1, total, success, failed);
    }
    
    // Rate limit: wait 1000ms between requests to avoid hitting API limits
    // (GitHub Models API and other providers have stricter rate limits)
    if (i < prompts.length - 1) {
      await delay(1000);
    }
  }

  return { success, failed, total };
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

export interface SemanticSearchResult {
  id: string;
  title: string;
  description: string | null;
  content: string;
  similarity: number;
  author: {
    id: string;
    name: string | null;
    username: string;
    avatar: string | null;
    verified?: boolean;
  };
  category: {
    id: string;
    name: string;
    slug: string;
  } | null;
  tags: Array<{
    tag: {
      id: string;
      name: string;
      slug: string;
      color: string;
    };
  }>;
  voteCount: number;
  type: string;
  structuredFormat: string | null;
  mediaUrl: string | null;
  isPrivate: boolean;
  createdAt: Date;
}

/**
 * Public prompts ranked by embedding similarity to the query. `where` narrows the candidates and
 * defaults to every type except bots, which have their own listing.
 */
export async function semanticSearch(
  query: string,
  limit: number = 20,
  { where = NON_BOT_PROMPTS }: { where?: Prisma.PromptWhereInput } = {}
): Promise<SemanticSearchResult[]> {
  const config = await getConfig();
  if (!config.features.aiSearch) {
    throw new Error("AI Search is not enabled");
  }

  // Translate non-English queries to English for better semantic matching
  let searchQuery = query;
  if (containsNonEnglish(query)) {
    searchQuery = await translateQueryToEnglish(query);
  }

  // Generate embedding for the query
  const queryEmbedding = await generateEmbedding(searchQuery);

  // Fetch all public prompts with embeddings (excluding soft-deleted)
  const prompts = await db.prompt.findMany({
    where: {
      isPrivate: false,
      deletedAt: null,
      embedding: { not: Prisma.DbNull },
      ...where,
    },
    select: {
      id: true,
      title: true,
      description: true,
      content: true,
      type: true,
      structuredFormat: true,
      mediaUrl: true,
      isPrivate: true,
      createdAt: true,
      embedding: true,
      author: {
        select: {
          id: true,
          name: true,
          username: true,
          avatar: true,
          verified: true,
        },
      },
      category: {
        select: {
          id: true,
          name: true,
          slug: true,
        },
      },
      tags: {
        include: {
          tag: true,
        },
      },
      _count: {
        select: { votes: true },
      },
    },
  });

  // Calculate similarity scores and filter by threshold
  const SIMILARITY_THRESHOLD = 0.4; // Filter out results below this similarity
  
  const scoredPrompts = prompts
    .map((prompt) => {
      const embedding = prompt.embedding as number[];
      const similarity = cosineSimilarity(queryEmbedding, embedding);
      return {
        ...prompt,
        similarity,
        voteCount: prompt._count.votes,
      };
    })
    .filter((prompt) => prompt.similarity >= SIMILARITY_THRESHOLD);

  // Sort by similarity and return top results
  scoredPrompts.sort((a, b) => b.similarity - a.similarity);

  return scoredPrompts.slice(0, limit).map(({ _count, embedding, ...rest }) => rest);
}

export async function isAISearchEnabled(): Promise<boolean> {
  const config = await getConfig();
  return config.features.aiSearch === true && !!process.env.OPENAI_API_KEY;
}

/**
 * Find and save 4 related prompts based on embedding similarity
 * Uses PromptConnection with label "related" to store relationships
 */
export async function findAndSaveRelatedPrompts(promptId: string): Promise<void> {
  const config = await getConfig();
  if (!config.features.aiSearch) return;

  const prompt = await db.prompt.findUnique({
    where: { id: promptId },
    select: { embedding: true, isPrivate: true, authorId: true, type: true },
  });

  if (!prompt || !prompt.embedding || prompt.isPrivate) return;

  const promptEmbedding = prompt.embedding as number[];

  // Fetch all public prompts with embeddings (excluding this prompt and soft-deleted)
  // Only match prompts of the same type
  const candidates = await db.prompt.findMany({
    where: {
      id: { not: promptId },
      isPrivate: false,
      isUnlisted: false,
      deletedAt: null,
      embedding: { not: Prisma.DbNull },
      type: prompt.type, // Must match the same type
    },
    select: {
      id: true,
      embedding: true,
    },
  });

  // Calculate similarity scores
  const SIMILARITY_THRESHOLD = 0.5;
  
  const scoredPrompts = candidates
    .map((p) => ({
      id: p.id,
      similarity: cosineSimilarity(promptEmbedding, p.embedding as number[]),
    }))
    .filter((p) => p.similarity >= SIMILARITY_THRESHOLD)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, 4);

  if (scoredPrompts.length === 0) return;

  // Delete existing related connections for this prompt
  await db.promptConnection.deleteMany({
    where: {
      sourceId: promptId,
      label: "related",
    },
  });

  // Create new related connections
  await db.promptConnection.createMany({
    data: scoredPrompts.map((p, index) => ({
      sourceId: promptId,
      targetId: p.id,
      label: "related",
      order: index,
    })),
    skipDuplicates: true,
  });
}
