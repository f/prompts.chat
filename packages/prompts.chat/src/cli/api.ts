import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import { createHash } from 'crypto';
import { getBaseUrl, USER_AGENT } from './config.js';

const CACHE_DIR = join(homedir(), '.prompts-chat');
const FETCH_TIMEOUT_MS = 120_000;

export interface Prompt {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  content: string;
  type: 'TEXT' | 'IMAGE' | 'VIDEO' | 'AUDIO' | 'STRUCTURED' | 'SKILL' | 'TASTE';
  mediaUrl: string | null;
  voteCount: number;
  viewCount: number;
  author: {
    username: string;
    name: string | null;
    avatar: string | null;
    verified: boolean;
  };
  category: {
    id: string;
    name: string;
    slug: string;
  } | null;
  tags: Array<{
    id: string;
    name: string;
    slug: string;
  }>;
  createdAt: string;
  updatedAt: string;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  count: number;
}

interface CachedData {
  prompts: Prompt[];
  fetchedAt: number;
  etag?: string;
}

let cachedPrompts: Prompt[] | null = null;

export function promptsUrl(baseUrl: string = getBaseUrl()): string {
  return `${baseUrl}/prompts.json?full_content=true`;
}

/**
 * One cache file per instance. The name is versioned because caches written by 0.1.x can hold
 * preview-only prompts without `content`.
 */
export function cacheFile(baseUrl: string = getBaseUrl()): string {
  const key = createHash('sha1').update(baseUrl).digest('hex').slice(0, 10);
  return join(CACHE_DIR, `prompts-v2-${key}.json`);
}

/** prompts.json drops `content` unless full_content=true; never hand the UI an undefined body */
export function normalizePrompts(raw: unknown): Prompt[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((p) => {
    const prompt = p as Prompt & { contentPreview?: string };
    return {
      ...prompt,
      content: prompt.content ?? prompt.contentPreview ?? '',
      voteCount: prompt.voteCount ?? 0,
      tags: prompt.tags ?? [],
      author: prompt.author ?? { username: 'unknown', name: null, avatar: null, verified: false },
    };
  });
}

function readCache(): CachedData | null {
  try {
    const file = cacheFile();
    if (existsSync(file)) {
      const data = JSON.parse(readFileSync(file, 'utf-8')) as CachedData;
      return { ...data, prompts: normalizePrompts(data.prompts) };
    }
  } catch {
    // Ignore cache read errors
  }
  return null;
}

function saveToCache(prompts: Prompt[], etag: string | undefined) {
  try {
    if (!existsSync(CACHE_DIR)) mkdirSync(CACHE_DIR, { recursive: true });
    const data: CachedData = { prompts, fetchedAt: Date.now(), etag };
    writeFileSync(cacheFile(), JSON.stringify(data));
  } catch {
    // Ignore cache write errors
  }
}

export async function loadPrompts(): Promise<Prompt[]> {
  if (cachedPrompts) {
    return cachedPrompts;
  }

  const cache = readCache();
  let failure = '';
  try {
    const headers: Record<string, string> = { Accept: 'application/json', 'User-Agent': USER_AGENT };
    if (cache?.etag && cache.prompts.length > 0) headers['If-None-Match'] = cache.etag;
    const response = await fetch(promptsUrl(), { headers, signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
    if (response.status === 304 && cache) {
      cachedPrompts = cache.prompts;
      return cachedPrompts;
    }
    if (response.ok) {
      const data = (await response.json()) as { prompts?: unknown };
      cachedPrompts = normalizePrompts(data.prompts);
      saveToCache(cachedPrompts, response.headers.get('etag') ?? undefined);
      return cachedPrompts;
    }
    failure = `HTTP ${response.status}`;
  } catch (error) {
    failure = error instanceof Error ? error.message : String(error);
  }

  if (cache && cache.prompts.length > 0) {
    cachedPrompts = cache.prompts;
    return cachedPrompts;
  }

  throw new Error(`Could not load prompts from ${getBaseUrl()} (${failure}). Check your internet connection or PROMPTS_CHAT_URL.`);
}

export function getCategories(prompts: Prompt[]): Category[] {
  const categoryMap = new Map<string, Category>();
  
  for (const prompt of prompts) {
    if (prompt.category) {
      const existing = categoryMap.get(prompt.category.slug);
      if (existing) {
        existing.count++;
      } else {
        categoryMap.set(prompt.category.slug, {
          id: prompt.category.id,
          name: prompt.category.name,
          slug: prompt.category.slug,
          count: 1,
        });
      }
    }
  }
  
  return Array.from(categoryMap.values()).sort((a, b) => a.name.localeCompare(b.name));
}

export function filterPrompts(prompts: Prompt[], options: {
  q?: string;
  category?: string;
  page?: number;
  perPage?: number;
}): { prompts: Prompt[]; total: number; page: number; perPage: number; totalPages: number } {
  let filtered = prompts;
  
  // Filter by search query
  if (options.q) {
    const query = options.q.toLowerCase();
    filtered = filtered.filter(p => 
      p.title.toLowerCase().includes(query) ||
      p.content.toLowerCase().includes(query) ||
      p.description?.toLowerCase().includes(query) ||
      p.author.username.toLowerCase().includes(query) ||
      p.author.name?.toLowerCase().includes(query) ||
      p.tags.some(t => t.name.toLowerCase().includes(query) || t.slug.toLowerCase().includes(query))
    );
  }
  
  // Filter by category
  if (options.category) {
    filtered = filtered.filter(p => p.category?.slug === options.category);
  }
  
  const total = filtered.length;
  const page = options.page || 1;
  const perPage = options.perPage || 20;
  const totalPages = Math.ceil(total / perPage);
  
  // Paginate
  const start = (page - 1) * perPage;
  const paged = filtered.slice(start, start + perPage);
  
  return { prompts: paged, total, page, perPage, totalPages };
}

export function getPrompt(prompts: Prompt[], id: string): Prompt | undefined {
  return prompts.find(p => p.id === id || p.slug === id || `${p.id}_${p.slug}` === id);
}
