/**
 * Composition Engine — live smoke test (Level 2).
 *
 * Drives ONE real 3-stage chain through the actual HTTP routes against a
 * DEPLOYED server (staging), using a real OPENAI_API_KEY on the server side,
 * then asserts the ExecutionRecord + StageTrace rows landed in the real DB.
 *
 * It:
 *   1. Seeds prerequisites in the DB (org, user, 3 prompts) via Prisma.
 *   2. Mints a valid NextAuth (v5, JWT) session cookie for the seeded user.
 *   3. POST /api/v1/compositions          -> create a 3-stage composition (HTTP)
 *   4. POST /api/v1/compositions/:id/execute -> run the chain               (HTTP)
 *   5. Reads ExecutionRecord + StageTrace back from the DB and asserts them.
 *   6. Cleans up (unless SMOKE_KEEP=1).
 *
 * REQUIRED ENV:
 *   SMOKE_BASE_URL   Base URL of the deployed app, e.g. https://staging.example.com
 *   DATABASE_URL     The SAME database the deployed app writes to (Prisma uses this)
 *   AUTH secret      One of SMOKE_AUTH_SECRET | AUTH_SECRET | NEXTAUTH_SECRET,
 *                    matching the deployment's secret (so the cookie verifies).
 *
 * OPTIONAL ENV:
 *   SMOKE_SESSION_COOKIE  Override the session cookie name (default derived from
 *                         the URL scheme: __Secure-authjs.session-token on https,
 *                         authjs.session-token on http).
 *   SMOKE_KEEP=1          Keep the seeded composition/prompts (default: clean up).
 *
 * RUN:
 *   SMOKE_BASE_URL=https://staging... DATABASE_URL=postgres://... \
 *   NEXTAUTH_SECRET=<staging secret> npx tsx scripts/smoke-composition.ts
 */

import { PrismaClient } from "@prisma/client";
import { encode } from "next-auth/jwt";

const prisma = new PrismaClient();

// ---- env ----
const BASE_URL = (process.env.SMOKE_BASE_URL || process.env.BASE_URL || "").replace(/\/$/, "");
const AUTH_SECRET =
  process.env.SMOKE_AUTH_SECRET || process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || "";
const KEEP = process.env.SMOKE_KEEP === "1";

function fail(msg: string): never {
  console.error(`\n❌ ASSERT FAILED: ${msg}`);
  process.exit(1);
}
function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) fail(msg);
  console.log(`  ✓ ${msg}`);
}

interface ExecuteResponse {
  executionId: string;
  status: "success" | "partial" | "failed";
  stages: Array<{
    stageOrder: number;
    promptId: string;
    input: string;
    output: string;
    tokensUsed: number;
    duration: number;
    success: boolean;
    fallbackApplied: boolean;
  }>;
  finalOutput: string;
  totalTokens: number;
  totalDuration: number;
  executionTrace: unknown[];
}

async function main(): Promise<void> {
  // ---- preconditions ----
  if (!BASE_URL) fail("SMOKE_BASE_URL (or BASE_URL) is required, e.g. https://staging.example.com");
  if (!process.env.DATABASE_URL) fail("DATABASE_URL is required (same DB the deployed app uses)");
  if (!AUTH_SECRET) fail("AUTH secret required: set SMOKE_AUTH_SECRET / AUTH_SECRET / NEXTAUTH_SECRET to the deployment's value");

  const isHttps = BASE_URL.startsWith("https://");
  const cookieName =
    process.env.SMOKE_SESSION_COOKIE || (isHttps ? "__Secure-authjs.session-token" : "authjs.session-token");

  console.log(`\n🔧 Smoke test against ${BASE_URL}`);
  console.log(`   session cookie: ${cookieName}\n`);

  // ---- 1. seed org + user + 3 prompts ----
  console.log("1) Seeding org, user, prompts…");
  const org = await prisma.organization.upsert({
    where: { slug: "smoke-composition" },
    update: {},
    create: { name: "Smoke Test Org", slug: "smoke-composition", tier: "internal" },
  });
  const user = await prisma.user.upsert({
    where: { email: "smoke-composition@prompts.chat" },
    update: { organizationId: org.id },
    create: {
      email: "smoke-composition@prompts.chat",
      username: "smoke_composition",
      name: "Smoke Composition Bot",
      role: "USER",
      locale: "en",
      organizationId: org.id,
    },
  });

  const mkPrompt = (title: string, content: string) =>
    prisma.prompt.create({
      data: { title, content, type: "TEXT", authorId: user.id, organizationId: org.id },
    });
  const pA = await mkPrompt(
    "Smoke Stage 1",
    "You are stage 1. Given the user's topic, reply with ONE short factual sentence about it. No preamble.",
  );
  const pB = await mkPrompt(
    "Smoke Stage 2",
    "You are stage 2. Expand the provided context into exactly two concise bullet points. No preamble.",
  );
  const pC = await mkPrompt(
    "Smoke Stage 3",
    "You are stage 3. Summarize the provided text in exactly ONE sentence. No preamble.",
  );
  console.log(`   org=${org.id} user=${user.id} prompts=[${pA.id}, ${pB.id}, ${pC.id}]`);

  // ---- 2. mint a session cookie for the seeded user ----
  const token = await encode({
    salt: cookieName,
    secret: AUTH_SECRET,
    maxAge: 60 * 60,
    token: {
      id: user.id,
      sub: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      username: user.username,
      locale: user.locale,
      picture: null,
    },
  });
  const cookie = `${cookieName}=${token}`;

  const postJson = async (path: string, body: unknown): Promise<{ status: number; json: unknown }> => {
    const res = await fetch(`${BASE_URL}${path}`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify(body),
    });
    let json: unknown = null;
    try {
      json = await res.json();
    } catch {
      /* non-JSON body */
    }
    return { status: res.status, json };
  };

  // ---- 3. create the composition over HTTP ----
  console.log("\n2) Creating composition via POST /api/v1/compositions…");
  const createRes = await postJson("/api/v1/compositions", {
    name: "Smoke 3-stage chain",
    description: "Live smoke test composition",
    organizationId: org.id,
    stages: [
      {
        order: 1,
        promptId: pA.id,
        successThreshold: 0.3,
        extractFields: ["sentence"],
        transformRules: { sentence: "Context from stage 1" },
      },
      {
        order: 2,
        promptId: pB.id,
        fallbackPromptId: pC.id,
        successThreshold: 0.3,
        extractFields: ["points"],
        transformRules: { points: "Bullet points from stage 2" },
      },
      { order: 3, promptId: pC.id, successThreshold: 0.3, extractFields: [] },
    ],
  });
  if (createRes.status !== 201) {
    fail(`create returned ${createRes.status} (expected 201). Body: ${JSON.stringify(createRes.json)} — check the session cookie/secret and that the deploy is up.`);
  }
  const compositionId = (createRes.json as { id: string }).id;
  assert(typeof compositionId === "string" && compositionId.length > 0, "composition created, got an id");

  // ---- 4. execute the chain over HTTP ----
  console.log("\n3) Executing chain via POST /api/v1/compositions/:id/execute…");
  const execRes = await postJson(`/api/v1/compositions/${compositionId}/execute`, {
    input: "The water cycle",
    context: { organizationId: org.id, userId: user.id, sessionId: "smoke-1" },
  });
  if (execRes.status !== 200) {
    fail(`execute returned ${execRes.status} (expected 200). Body: ${JSON.stringify(execRes.json)}`);
  }
  const result = execRes.json as ExecuteResponse;
  console.log(`   status=${result.status} executionId=${result.executionId} totalTokens=${result.totalTokens} totalDuration=${result.totalDuration}ms`);

  // ---- 5a. assert the HTTP response shape ----
  console.log("\n4) Asserting HTTP response…");
  assert(typeof result.executionId === "string" && result.executionId.length > 0, "response has executionId");
  assert(["success", "partial", "failed"].includes(result.status), `response.status is valid (${result.status})`);
  assert(Array.isArray(result.stages) && result.stages.length === 3, "response has 3 stage results");
  assert(typeof result.finalOutput === "string" && result.finalOutput.length > 0, "response finalOutput is non-empty");
  assert(result.totalTokens > 0, `response totalTokens > 0 (real LLM usage: ${result.totalTokens})`);

  // ---- 5b. assert the rows landed in the real DB ----
  console.log("\n5) Asserting rows in the live database…");
  const exec = await prisma.executionRecord.findUnique({
    where: { id: result.executionId },
    include: { stageTraces: { orderBy: { stageOrder: "asc" } } },
  });
  assert(exec !== null, "ExecutionRecord row exists in the DB");
  if (!exec) return; // type narrowing
  assert(exec.compositionId === compositionId, "ExecutionRecord.compositionId matches the composition");
  assert(exec.organizationId === org.id, "ExecutionRecord.organizationId matches the org");
  assert(exec.userId === user.id, "ExecutionRecord.userId matches the context user");
  assert(exec.sessionId === "smoke-1", "ExecutionRecord.sessionId persisted");
  assert(["SUCCESS", "PARTIAL", "FAILED"].includes(exec.status), `ExecutionRecord.status is a valid enum (${exec.status})`);
  assert(exec.totalTokens > 0, `ExecutionRecord.totalTokens > 0 (${exec.totalTokens})`);
  assert((exec.finalOutput ?? "").length > 0, "ExecutionRecord.finalOutput persisted");

  assert(exec.stageTraces.length === 3, `exactly 3 StageTrace rows persisted (got ${exec.stageTraces.length})`);
  for (const t of exec.stageTraces) {
    assert(t.output !== null && t.output.length > 0, `stage ${t.stageOrder}: output persisted`);
    assert(t.tokensUsed > 0, `stage ${t.stageOrder}: tokensUsed > 0 (${t.tokensUsed})`);
    assert(t.promptVersion >= 1, `stage ${t.stageOrder}: promptVersion pinned`);
    assert(typeof t.thresholdMet === "boolean", `stage ${t.stageOrder}: thresholdMet (success) recorded`);
  }

  // adaptation proof: each stage's adaptedInput carries the prior stage's transformRule label
  const t2 = exec.stageTraces.find((t) => t.stageOrder === 2);
  const t3 = exec.stageTraces.find((t) => t.stageOrder === 3);
  assert(!!t2 && t2.adaptedInput.includes("Context from stage 1"), "stage 2 adaptedInput shows stage-1 adaptation");
  assert(!!t3 && t3.adaptedInput.includes("Bullet points from stage 2"), "stage 3 adaptedInput shows stage-2 adaptation");

  // ---- 6. cleanup ----
  if (KEEP) {
    console.log(`\n6) SMOKE_KEEP=1 → leaving data. compositionId=${compositionId}, executionId=${result.executionId}`);
  } else {
    console.log("\n6) Cleaning up (composition cascades execution_records + stage_traces)…");
    await prisma.composition.delete({ where: { id: compositionId } });
    await prisma.prompt.deleteMany({ where: { id: { in: [pA.id, pB.id, pC.id] } } });
    console.log("   cleaned up composition + prompts (org/user retained for reuse).");
  }

  console.log("\n✅ SMOKE TEST PASSED — chain executed over HTTP and traces verified in the live DB.\n");
}

main()
  .catch((err) => {
    console.error("\n❌ SMOKE TEST ERROR:", err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
