import { NextRequest } from "next/server";
import OpenAI from "openai";
import { auth } from "@/lib/auth";
import { getConfig } from "@/lib/config";

const GENERATIVE_MODEL = process.env.OPENAI_GENERATIVE_MODEL || "gpt-4o-mini";

// Rate limiting configuration
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS_AUTH = 5; // 5 requests per minute for authenticated users
const RATE_LIMIT_MAX_REQUESTS_ANON = 3; // 3 requests per minute for anonymous users
const DAILY_LIMIT_ANON = 10; // 10 requests per day for anonymous users

// In-memory rate limit stores
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();
const dailyLimitStore = new Map<string, { count: number; resetAt: number }>();

function getClientId(request: NextRequest, userId?: string): string {
  if (userId) return `user:${userId}`;
  
  // For anonymous users, use IP address
  const forwarded = request.headers.get("x-forwarded-for");
  const ip = forwarded ? forwarded.split(",")[0].trim() : "unknown";
  return `ip:${ip}`;
}

function checkRateLimit(
  clientId: string, 
  isAuthenticated: boolean
): { allowed: boolean; remaining: number; resetIn: number; dailyRemaining?: number } {
  const now = Date.now();
  const maxRequests = isAuthenticated ? RATE_LIMIT_MAX_REQUESTS_AUTH : RATE_LIMIT_MAX_REQUESTS_ANON;
  
  // Check per-minute rate limit
  const userLimit = rateLimitStore.get(clientId);

  if (!userLimit || now > userLimit.resetAt) {
    rateLimitStore.set(clientId, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
  } else if (userLimit.count >= maxRequests) {
    return { allowed: false, remaining: 0, resetIn: userLimit.resetAt - now };
  } else {
    userLimit.count++;
  }

  const remaining = maxRequests - (rateLimitStore.get(clientId)?.count || 1);
  const resetIn = (rateLimitStore.get(clientId)?.resetAt || now + RATE_LIMIT_WINDOW_MS) - now;

  // For anonymous users, also check daily limit
  if (!isAuthenticated) {
    const dayMs = 24 * 60 * 60 * 1000;
    const dailyLimit = dailyLimitStore.get(clientId);
    
    if (!dailyLimit || now > dailyLimit.resetAt) {
      dailyLimitStore.set(clientId, { count: 1, resetAt: now + dayMs });
    } else if (dailyLimit.count >= DAILY_LIMIT_ANON) {
      return { 
        allowed: false, 
        remaining: 0, 
        resetIn: dailyLimit.resetAt - now,
        dailyRemaining: 0 
      };
    } else {
      dailyLimit.count++;
    }
    
    const dailyRemaining = DAILY_LIMIT_ANON - (dailyLimitStore.get(clientId)?.count || 1);
    return { allowed: true, remaining, resetIn, dailyRemaining };
  }

  return { allowed: true, remaining, resetIn };
}

export type DemoType = 
  | "run_prompt"        // Run a prompt and get response
  | "analyze_prompt"    // Analyze prompt quality
  | "score_challenge"   // Score a challenge submission
  | "compare_prompts"   // Compare two prompts
  | "validate_blanks"   // Validate fill-in-the-blank answers semantically
  | "check_consistency"; // Check if filled prompt is internally consistent (open-ended)

interface BlankValidation {
  id: string;
  expectedAnswers: string[];
  userAnswer: string;
  context?: string;
}

interface RequestBody {
  type: DemoType;
  prompt?: string;
  prompts?: [string, string]; // For compare
  task?: string; // For challenge scoring
  criteria?: string[]; // For challenge scoring
  systemPrompt?: string;
  blanks?: BlankValidation[]; // For validate_blanks
  template?: string; // For validate_blanks
}

const SYSTEM_PROMPTS: Record<DemoType, string> = {
  run_prompt: "You are a helpful AI assistant. Respond naturally and helpfully to the user's prompt. Keep responses concise but complete.",
  
  analyze_prompt: `You are a prompt engineering expert. Analyze the given prompt and provide structured feedback.

Return JSON with this exact structure:
{
  "score": <number 1-10>,
  "clarity": "<brief assessment>",
  "specificity": "<brief assessment>",
  "missingElements": ["<element1>", "<element2>"],
  "suggestions": ["<suggestion1>", "<suggestion2>"],
  "improved": "<improved version of the prompt>"
}`,

  score_challenge: `You are a prompt engineering instructor evaluating a student's prompt.

Given a task and criteria, score how well the submitted prompt addresses them.

Return JSON with this exact structure:
{
  "score": <number 0-100>,
  "criteriaScores": [{"criterion": "<name>", "met": <boolean>, "feedback": "<brief>"}],
  "overallFeedback": "<2-3 sentences>",
  "suggestions": ["<improvement1>", "<improvement2>"]
}`,

  compare_prompts: `You are a prompt engineering expert comparing two prompts.

Analyze both prompts and explain which is better and why.

Return JSON with this exact structure:
{
  "winner": <1 or 2>,
  "prompt1Analysis": {"strengths": ["..."], "weaknesses": ["..."]},
  "prompt2Analysis": {"strengths": ["..."], "weaknesses": ["..."]},
  "explanation": "<why the winner is better>",
  "keyDifferences": ["<difference1>", "<difference2>"]
}`,

  validate_blanks: `You are validating fill-in-the-blank answers for a prompt engineering exercise.

For each blank, determine if the user's answer is semantically equivalent to any of the expected answers. Be lenient with synonyms and variations that convey the same meaning (e.g., "software engineer" = "software developer" = "developer").

Return JSON with this exact structure:
{
  "validations": [
    {
      "blankId": "<id>",
      "isCorrect": <boolean>,
      "feedback": "<brief feedback if incorrect, explaining why or suggesting improvement>"
    }
  ]
}`,

  check_consistency: `You are evaluating the internal consistency and quality of a filled-in prompt template.

The user can write ANY values they want - there are no "correct" answers. Instead, check if:
1. The filled values make logical sense together (e.g., "teacher with expertise in math" working on "a math curriculum" is consistent, but working on "biology" is inconsistent)
2. The role matches the expertise area
3. The context matches what someone in that role would work on
4. The task is appropriate for the role and context
5. Constraints and format make sense for the task

Be encouraging but point out logical inconsistencies. Accept creative or unusual combinations if they make sense.

Return JSON with this exact structure:
{
  "isConsistent": <boolean - true if prompt is internally consistent>,
  "overallScore": <number 1-10>,
  "issues": [
    {"blankId": "<id of problematic blank>", "issue": "<what's inconsistent and why>"}
  ],
  "suggestions": ["<suggestion for improvement>"],
  "praise": "<what they did well, if anything>"
}`
};

/** Process an interactive book AI demo request. */
export async function POST(request: NextRequest) {
  const session = await auth();
  const isAuthenticated = !!session?.user;
  const userId = session?.user?.id || session?.user?.email;
  
  const clientId = getClientId(request, userId);
  const rateLimit = checkRateLimit(clientId, isAuthenticated);
  
  if (!rateLimit.allowed) {
    return new Response(JSON.stringify({ 
      error: "Rate limit exceeded. Please try again later.",
      resetIn: Math.ceil(rateLimit.resetIn / 1000),
      dailyRemaining: rateLimit.dailyRemaining,
      signInForMore: !isAuthenticated
    }), {
      status: 429,
      headers: { 
        "Content-Type": "application/json",
        "X-RateLimit-Remaining": String(rateLimit.remaining),
        "X-RateLimit-Reset": String(Math.ceil(rateLimit.resetIn / 1000)),
      },
    });
  }

  const config = await getConfig();
  if (!config.features.aiGeneration) {
    return new Response(JSON.stringify({ error: "AI features are not enabled" }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "OpenAI API key not configured" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const body: RequestBody = await request.json();
    const { type, prompt, prompts, task, criteria, systemPrompt } = body;

    if (!type || !SYSTEM_PROMPTS[type]) {
      return new Response(JSON.stringify({ error: "Invalid demo type" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const openai = new OpenAI({
      apiKey,
      baseURL: process.env.OPENAI_BASE_URL || undefined,
    });

    let userContent: string;
    let responseFormat: "text" | "json_object" = "text";

    switch (type) {
      case "run_prompt":
        if (!prompt) {
          return new Response(JSON.stringify({ error: "Prompt is required" }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          });
        }
        userContent = prompt;
        break;

      case "analyze_prompt":
        if (!prompt) {
          return new Response(JSON.stringify({ error: "Prompt is required" }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          });
        }
        userContent = `Analyze this prompt:\n\n${prompt}`;
        responseFormat = "json_object";
        break;

      case "score_challenge":
        if (!prompt || !task) {
          return new Response(JSON.stringify({ error: "Prompt and task are required" }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          });
        }
        userContent = `Task: ${task}\n\nCriteria to evaluate:\n${(criteria || []).map((c, i) => `${i + 1}. ${c}`).join("\n")}\n\nStudent's submitted prompt:\n${prompt}`;
        responseFormat = "json_object";
        break;

      case "compare_prompts":
        if (!prompts || prompts.length !== 2) {
          return new Response(JSON.stringify({ error: "Two prompts are required" }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          });
        }
        userContent = `Compare these two prompts:\n\nPrompt 1:\n${prompts[0]}\n\nPrompt 2:\n${prompts[1]}`;
        responseFormat = "json_object";
        break;

      case "validate_blanks":
        if (!body.blanks || body.blanks.length === 0) {
          return new Response(JSON.stringify({ error: "Blanks are required" }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          });
        }
        userContent = `Validate these fill-in-the-blank answers:\n\n${body.blanks.map(b => 
          `Blank ID: ${b.id}\nExpected answers (examples): ${b.expectedAnswers.join(", ")}\nUser's answer: "${b.userAnswer}"${b.context ? `\nContext: ${b.context}` : ""}`
        ).join("\n\n")}`;
        responseFormat = "json_object";
        break;

      case "check_consistency":
        if (!body.blanks || body.blanks.length === 0 || !body.template) {
          return new Response(JSON.stringify({ error: "Blanks and template are required" }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          });
        }
        // Build the filled prompt for context
        let filledPrompt = body.template;
        for (const blank of body.blanks) {
          filledPrompt = filledPrompt.replace(`{{${blank.id}}}`, blank.userAnswer || "[empty]");
        }
        userContent = `Check the consistency of this filled prompt template:\n\nTemplate with blanks:\n${body.template}\n\nFilled values:\n${body.blanks.map(b => 
          `- ${b.id}: "${b.userAnswer}"${b.context ? ` (expected type: ${b.context})` : ""}`
        ).join("\n")}\n\nResulting prompt:\n${filledPrompt}`;
        responseFormat = "json_object";
        break;

      default:
        return new Response(JSON.stringify({ error: "Invalid demo type" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
    }

    const response = await openai.chat.completions.create({
      model: GENERATIVE_MODEL,
      messages: [
        { role: "system", content: systemPrompt || SYSTEM_PROMPTS[type] },
        { role: "user", content: userContent }
      ],
      temperature: type === "run_prompt" ? 0.7 : 0.3,
      max_completion_tokens: 500,
      ...(responseFormat === "json_object" && { response_format: { type: "json_object" } }),
    });

    const content = response.choices[0]?.message?.content || "";
    
    let result: unknown;
    if (responseFormat === "json_object") {
      try {
        result = JSON.parse(content);
      } catch {
        result = { error: "Failed to parse response", raw: content };
      }
    } else {
      result = content;
    }

    return new Response(JSON.stringify({ 
      result,
      remaining: rateLimit.remaining,
      dailyRemaining: rateLimit.dailyRemaining,
    }), {
      status: 200,
      headers: { 
        "Content-Type": "application/json",
        "X-RateLimit-Remaining": String(rateLimit.remaining),
      },
    });
  } catch (error) {
    console.error("Book demo API error:", error);
    return new Response(JSON.stringify({ error: "Failed to process request" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
