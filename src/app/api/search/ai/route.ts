import { NextRequest, NextResponse } from "next/server";
import { semanticSearch, isAISearchEnabled } from "@/lib/ai/embeddings";
import { parseLimit } from "@/lib/pagination";
import { aiSearchLimiter, getClientIdentifier } from "@/lib/rate-limit";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;
const MAX_QUERY_LENGTH = 500;

export async function GET(request: NextRequest) {
  try {
    const enabled = await isAISearchEnabled();
    if (!enabled) {
      return NextResponse.json(
        { error: "AI Search is not enabled" },
        { status: 400 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get("q");
    const limit = parseLimit(searchParams.get("limit"), {
      defaultValue: DEFAULT_LIMIT,
      max: MAX_LIMIT,
    });

    if (!query || query.trim().length === 0) {
      return NextResponse.json(
        { error: "Query is required" },
        { status: 400 }
      );
    }

    if (query.length > MAX_QUERY_LENGTH) {
      return NextResponse.json(
        { error: `Query must be at most ${MAX_QUERY_LENGTH} characters` },
        { status: 400 }
      );
    }

    // Each search may call OpenAI (translation + embedding) and scans all
    // stored embeddings, so limit how often a single client can trigger it.
    const rateLimit = aiSearchLimiter.check(getClientIdentifier(request.headers));
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: `Rate limit exceeded. Try again in ${rateLimit.retryAfterSeconds}s.` },
        {
          status: 429,
          headers: { "Retry-After": String(rateLimit.retryAfterSeconds) },
        }
      );
    }

    const results = await semanticSearch(query, limit);

    return NextResponse.json({
      results,
      query,
      count: results.length,
    });
  } catch (error) {
    console.error("AI Search error:", error);
    return NextResponse.json(
      { error: "Search failed" },
      { status: 500 }
    );
  }
}
