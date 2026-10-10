# Level 3 Blueprint — Evaluated, Governed, Self-Improving Compositions

> **Status:** build-ready spec. Nothing in this document is implemented yet.
> **Scope rule:** every schema change Level 3 needs lands here, not in Level 2 code.
> **Verified against:** `prisma/schema.prisma` @ branch `claude/wizardly-dirac-mhzb9v`
> (PromptVersion, ChangeRequest, `Prompt.embedding`, `Prompt.bestWithModels`,
> `StageTrace.score` / `thresholdMet` / `overallScore` all already exist in the
> production schema — Level 3 populates them, it does not create them).

Level 2 shipped a deterministic Composition Engine: DAG resolution, stage
execution through the `LLMProvider` abstraction, config-driven adaptation,
`thresholdCheck` gating, fallbacks, and a full audit trail
(`ExecutionRecord` + `StageTrace`). Level 3 turns that audited trace into a
feedback loop — **evaluation, governed improvement, evaluation-refreshed
routing, and MCP exposure** — without ever letting a machine mutate a
production prompt in place.

---

## 1. Validation Framework

### Problem

`thresholdCheck` (src/lib/composition/thresholdCheck.ts) is a deterministic
length/structure heuristic. It answers "did the stage emit *something*
plausible", not "is the output *correct, grounded, and safe to feed forward*".
Level 3 replaces it with an LLM evaluator whose output is a **Zod-enforced
structured contract**. Non-conforming evaluator output is **rejected, never
coerced** — a malformed evaluation is itself a failed evaluation.

### The contract

```ts
// src/lib/composition/evaluation/contract.ts
import { z } from "zod";

export const EvalStateSchema = z.enum([
  "PASS",
  "FAIL",
  "UNKNOWN",                     // evaluator could not determine quality
  "BLOCKED_BY_MISSING_EVIDENCE", // evaluation impossible without facts the stage never had
]);

export const StageEvaluationSchema = z.object({
  state: EvalStateSchema,
  scores: z.object({
    relevance:    z.number().min(0).max(1),
    completeness: z.number().min(0).max(1),
    grounding:    z.number().min(0).max(1), // claims traceable to stage input
    formatFit:    z.number().min(0).max(1), // matches what the next stage expects
  }),
  facts:       z.array(z.string()), // claims in the output supported by the input
  inferences:  z.array(z.string()), // claims derived but not directly stated
  assumptions: z.array(z.string()), // claims with no support in the input
  risks:       z.array(z.string()), // ways this output could mislead stage N+1
  blockers:    z.array(z.string()), // required only when state != PASS; must be non-empty then
});
export type StageEvaluation = z.infer<typeof StageEvaluationSchema>;
```

Hard rules:

- **Reject, never coerce.** `StageEvaluationSchema.safeParse` on the raw model
  output. On failure: one re-ask with the Zod error appended; on second
  failure the evaluation is recorded as `UNKNOWN` with
  `blockers: ["evaluator_nonconforming_output"]`. We never `.catch()`-default
  scores, never clamp, never strip unknown keys silently.
- **Explicit ignorance is a first-class state.** `UNKNOWN` and
  `BLOCKED_BY_MISSING_EVIDENCE` flow through the engine as "not passed" but
  are distinguishable in traces and in the routing aggregation (§3), which
  excludes them from pass-rate denominators.
- The evaluator runs through the existing `LLMProvider` interface (so it can
  run on the Anthropic provider with the stage rubric as a cached system
  prefix), with `output` requested as JSON.

### Data flow

```
stage N executes
   └─> output ──────────────────────────────┐
                                            v
                              evaluator prompt = rubric (stable, cached)
                                            + stage input + stage output
                                            v
                              LLMProvider.complete()
                                            v
                       StageEvaluationSchema.safeParse(raw)
                          │ ok                      │ fail
                          v                         v
                   StageEvaluation          re-ask once with Zod issues
                          │                         │ fail again
                          │                         v
                          │              { state: UNKNOWN,
                          │                blockers: [evaluator_nonconforming_output] }
                          v
        persist into StageTrace reserved columns:
          score        <- mean(scores)            (Float?, exists today)
          thresholdMet <- state == "PASS"         (Boolean?, exists today)
          + new column StageTrace.evaluation Json?   (full contract object)
        ExecutionRecord.overallScore <- mean of stage scores (Float?, exists today)
                          v
        engine gate: PASS -> continue | else -> fallback path (unchanged semantics)
```

### Schema delta (migration lands in Level 3, not before)

```prisma
model StageTrace {
  // existing reserved columns get populated: score, thresholdMet
  evaluation Json? // full StageEvaluation contract; null = legacy thresholdCheck run
}
```

### API sketch

No new routes. The execute/test responses gain an optional per-stage
`evaluation` object (the parsed contract), and `GET /history` exposes it via
the existing StageTrace include. Engine config: `Stage.successThreshold` is
reinterpreted as the minimum mean score for `PASS` at evaluation time;
`EVALUATOR_ENABLED=true` env-gates the rollout (default off, falls back to
`thresholdCheck` — same default-off discipline as the Anthropic provider).

---

## 2. Governed Promotion Pipeline

### Problem

Self-improvement must never mutate production prompts in place. The schema
already has the full governance surface: `PromptVersion` (append-only version
history, `@@unique([promptId, version])`) and `ChangeRequest`
(PENDING → APPROVED/REJECTED review flow with `originalContent` /
`proposedContent` / `reviewNote`). Level 3 reuses both, unchanged.

### Flow

```
candidate generation (machine)            review (human)              production
─────────────────────────────            ───────────────             ──────────
StageTrace rows where state in
(FAIL, UNKNOWN) for prompt P
        │  (improvement job batches the failing
        │   inputs/outputs/blockers as evidence)
        v
LLMProvider: "propose improved prompt"        
        v
candidate evaluation: re-run the SAME
evaluator (§1) over a frozen sample of
recent inputs, candidate vs current
        │ candidate mean score <= current  ──> discard, log, stop
        │ candidate wins
        v
db.changeRequest.create({
  promptId: P,
  authorId: SYSTEM_IMPROVER_USER_ID,   // dedicated bot user, exists in users table
  originalContent / originalTitle,     // snapshot at proposal time
  proposedContent,
  reason: "<evidence: N failing traces, before/after eval scores>",
  status: PENDING,
})                                            
        v
              human reviews in the existing ChangeRequest UI
              (features.changeRequests is already a config flag)
        │ REJECTED ──> reviewNote recorded; improver backs off for that prompt
        │ APPROVED
        v
                                          promotion (existing approval path):
                                          db.promptVersion.create({ version: n+1,
                                            content, changeNote: reason, createdBy })
                                          + prompt.content updated transactionally
        v
rollback = promote version n again as n+2 (append-only; no destructive revert)
```

### Invariants

- Machine-generated improvements arrive **only** as `ChangeRequest` rows.
  There is no code path from the improver to `prompt.update()`.
- The improver bot is a normal `User` row scoped to the organization — RLS
  and the Phase-B authz rules apply to it like anyone else.
- `StageTrace.promptVersion` already pins which version each execution used,
  so before/after comparison across a promotion is a pure query.
- Rollback is a forward promotion of an old version — version history is
  append-only.

### API sketch

```
POST /api/v1/prompts/:id/improvement-runs     (admin/system) trigger candidate generation
GET  /api/v1/prompts/:id/improvement-runs     list runs + candidate eval scores
-- review/approve/reject: existing ChangeRequest routes, unchanged
```

Schema delta: none required. Optional nicety (decide at build time): a
`source` enum column on ChangeRequest (`USER` | `SYSTEM_IMPROVER`) so the UI
can badge machine proposals; until then the bot author id serves that role.

---

## 3. Computed Routing Hints

### Problem

`Prompt.bestWithModels` (`String[]`, the "works best with" metadata surfaced
in the prompt UI) is hand-maintained opinion. Level 3 converts it into
**evaluation-refreshed routing data** computed from StageTrace outcomes.

### Aggregation job

```
nightly job (Vercel cron, 03:00 UTC)            read path
──────────────────────────────────             ─────────
SELECT promptId, model,
       count(*)                                    AS runs,
       avg(CASE WHEN thresholdMet THEN 1 ELSE 0 END
           FILTER (state not in UNKNOWN/BLOCKED)   AS passRate,
       avg(tokensUsed)                             AS avgTokens,
       avg(durationMs)                             AS avgDurationMs
FROM stage_traces
WHERE createdAt > now() - interval '30 days'   -- rolling window
GROUP BY promptId, model
HAVING count(*) >= 20                          -- min sample size; below it, keep prior value
        │
        v
rank models per prompt: passRate DESC, then avgTokens ASC (cost tiebreak)
        │
        v
write top 3 slugs -> Prompt.bestWithModels     (existing String[] column)
write full rows   -> PromptModelStats          (new table, see delta)
        │
        v
read path: composition engine + MCP recommend tool (§4) read PromptModelStats
           (full numbers); the prompt page keeps reading bestWithModels (slugs)
```

- **Refresh cadence:** nightly, plus an immediate re-aggregation for a prompt
  when a promotion (§2) lands, so routing reflects the new version quickly.
- `UNKNOWN` / `BLOCKED_BY_MISSING_EVIDENCE` traces are excluded from the
  pass-rate denominator (they measure the evaluator, not the prompt).
- Model names come from `StageTrace.model` (already recorded per stage by
  both providers).

### Schema delta

```prisma
model PromptModelStats {
  id           String   @id @default(cuid())
  promptId     String
  model        String
  windowDays   Int      @default(30)
  runs         Int
  passRate     Float
  avgTokens    Float
  avgDurationMs Float
  computedAt   DateTime @default(now())

  @@unique([promptId, model])
  @@index([promptId])
  @@map("prompt_model_stats")
}
```

### API sketch

```
GET /api/v1/prompts/:id/routing-hints
  -> { promptId, computedAt, hints: [{ model, passRate, avgTokens, avgDurationMs, runs }] }
```

---

## 4. MCP Tools

Two tools added to the existing MCP server (`src/pages/api/mcp.ts`, which
already exposes prompt search/save via `server.registerTool`). Both are
org-scoped through the same session/API-key auth the server already performs,
combined with the Phase-B rule: organization resolved server-side, never from
tool input.

### `recommend_composition`

```ts
server.registerTool("recommend_composition", {
  description: "Recommend prompts/compositions for a task, ranked by measured performance",
  inputSchema: {
    task: z.string().min(1),          // natural-language description
    limit: z.number().int().max(10).default(3),
  },
}, handler);
```

Data flow:

```
task text
   └─> embed via existing src/lib/ai/embeddings.ts (same model that fills Prompt.embedding)
          v
   pgvector similarity over prompts.embedding
   WHERE organizationId = <caller org>            -- org scoping is in the SQL, not post-filter
   ORDER BY embedding <=> $task_embedding
   LIMIT 25 candidates
          v
   re-rank: similarity x routing hints (§3)
     score = sim * w1 + passRate * w2 - normalizedCost * w3
   (prompts with no PromptModelStats rows rank on similarity alone, flagged "unmeasured")
          v
   return [{ promptId, title, model: bestModel, passRate, similarity, rationale }]
```

**Stated prerequisite — embedding backfill.** `Prompt.embedding` is currently
`Json?` and **unpopulated**: the prompts table is empty until content seeding
completes. The Level 3 plan therefore includes, in order:

1. content seeding completes (prompts > 0);
2. **post-seed embedding backfill job** — batch job that walks all prompts
   with `embedding IS NULL` and fills them via the existing embedding path
   (`generatePromptEmbedding`), rate-limited, resumable by cursor;
3. migration of `embedding Json?` → a real `vector` column + HNSW index
   (pgvector is available on Supabase; the Json column was a placeholder).

`recommend_composition` ships behind a flag until (1)–(3) are done.

### `execute_composition`

```ts
server.registerTool("execute_composition", {
  description: "Execute a saved composition chain and return the final output + trace summary",
  inputSchema: {
    compositionId: z.string().min(1),
    input: z.string().min(1),
  },
}, handler);
```

Data flow: resolve caller → org (server-side) → verify the composition belongs
to that org (404 otherwise, identical to the Phase-B HTTP rule) → call
`executeComposition()` directly (same engine the HTTP route uses) → return
`{ executionId, status, finalOutput, totalTokens, totalDuration, stages: [...summaries] }`.
Execution context is `{ organizationId: <resolved>, userId: <caller>, sessionId: "mcp" }` —
the MCP surface gets no identity inputs at all.

---

## 5. Provider Phase 2 — Citations Mode

Builds directly on the Phase-C `AnthropicProvider`. For **evidence-backed
stages** (stages whose output feeds the §1 evaluator's `facts[]`/`grounding`
checks), the provider accepts source documents and returns cited spans.

### Interface extension (additive, optional fields only)

```ts
export interface LLMCompletionRequest {
  system?: string;
  prompt: string;
  temperature?: number;
  maxTokens?: number;
  // Level 3: evidence documents for citation-grounded stages
  documents?: Array<{ title: string; content: string }>;
}

export interface LLMCompletionResult {
  output: string;
  inputTokens: number;
  outputTokens: number;
  model: string;
  // Level 3: populated only by providers/stages that support citations
  citations?: Array<{
    text: string;        // the cited span in the output
    documentTitle: string;
    start: number;       // char offsets into the source document
    end: number;
  }>;
}
```

OpenAIProvider ignores `documents` (passes content inline) and returns no
`citations` — callers must treat the field as optional. AnthropicProvider maps
`documents` to the Messages API `document` content blocks with
`citations: { enabled: true }` and maps the returned citation deltas onto the
result shape above. The stage rubric stays a cached system prefix (Phase C
caching v1 carries over unchanged).

### Where citations land

```
stage executes with documents
   └─> result.citations
          └─> evaluator (§1) receives them as ground truth:
              facts[] entries that match a cited span score grounding=1,
              uncited claims fall to inferences[]/assumptions[]
          └─> StageTrace.evaluation Json captures the citation map
```

Schema delta: none (rides in the `evaluation Json` column from §1).

---

## 6. Sequencing and Non-Goals

### Two-week build order

| Days | Work | Depends on |
|------|------|-----------|
| 1–2  | §1 evaluation contract + evaluator module behind `EVALUATOR_ENABLED`, unit tests with mocked provider (conforming, non-conforming, re-ask, UNKNOWN paths) | nothing |
| 3    | §1 migration (`StageTrace.evaluation Json?`) + engine wiring + trace persistence | days 1–2 |
| 4–5  | §2 improvement job: failure batching, candidate generation, candidate-vs-current eval, ChangeRequest creation; improver bot user + backoff | §1 (evaluator is the judge) |
| 6    | §2 promotion/rollback verification on the existing ChangeRequest approval path; before/after query on `StageTrace.promptVersion` | days 4–5 |
| 7–8  | §3 `PromptModelStats` migration + nightly aggregation job + `bestWithModels` writer + routing-hints route | §1 (needs real scores flowing) |
| 9    | Content seeding completes → **post-seed embedding backfill job** → pgvector column + index migration | external (seeding) |
| 10–11| §4 MCP tools: `execute_composition` first (no embedding dependency), then `recommend_composition` behind a flag | §3 (ranker), day 9 (embeddings) |
| 12–13| §5 citations mode on AnthropicProvider + evaluator grounding integration, mocked-SDK tests | §1, Phase C |
| 14   | End-to-end smoke (extend `scripts/smoke-composition.ts` with an evaluated run), docs, flag-flip checklist | all |

Dependency spine: **§1 → §2 → §3 → §4**, with §5 parallelizable after §1.
If seeding slips, day 9–11's `recommend_composition` slips with it; everything
else is unaffected.

### Explicit non-goals

- **No continuous-learning swarm.** One improvement job, batch cadence,
  per-prompt backoff. No agent fleet mutating prompts concurrently.
- **No auto-publishing loops.** Nothing promotes without a human approving
  the ChangeRequest. The improver cannot approve its own proposals, and there
  is no "auto-approve above score X" rule in Level 3.
- **Nothing bypasses ChangeRequest review.** No direct `prompt.update()` from
  any machine path, no shadow prompts, no per-execution prompt rewriting.
- No cross-organization learning (traces never inform another org's prompts).
- No evaluator-of-the-evaluator recursion; evaluator quality is monitored by
  humans via the `UNKNOWN`-rate metric, not by another model.
