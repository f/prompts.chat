import { describe, it, expect, vi, beforeAll } from "vitest";
import { NextRequest } from "next/server";
import type { Prisma } from "@prisma/client";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("next/cache", () => ({
  revalidateTag: vi.fn(),
  unstable_cache: <T extends (...args: never[]) => unknown>(fn: T) => fn,
}));
vi.mock("@/lib/webhook", () => ({ triggerWebhooks: vi.fn() }));
vi.mock("@/lib/ai/embeddings", () => ({
  generatePromptEmbedding: vi.fn(async () => undefined),
  findAndSaveRelatedPrompts: vi.fn(async () => undefined),
}));
vi.mock("@/lib/ai/quality-check", () => ({ checkPromptQuality: vi.fn(async () => null) }));

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { POST as createPromptRoute } from "@/app/api/prompts/route";
import { GET as getPromptRoute, PATCH as updatePromptRoute, DELETE as deletePromptRoute } from "@/app/api/prompts/[id]/route";
import { POST as proposeChangeRoute } from "@/app/api/prompts/[id]/changes/route";
import { PATCH as reviewChangeRoute } from "@/app/api/prompts/[id]/changes/[changeId]/route";
import { POST as voteRoute, DELETE as unvoteRoute } from "@/app/api/prompts/[id]/vote/route";
import { findClassifierBySlug, getClassifierCatalog, getClassifierVotes, listedClassifiers } from "@/lib/classifiers/store";
import { curatedClassifierId } from "@/lib/classifiers/schema";
import type { ClassifierFields } from "@/lib/classifiers/change-snapshot";
import { importClassifierCatalog } from "../../../prisma/classifiers/import";
import { prepareClassifierCatalog } from "../../../prisma/classifiers/seed-sql";
import { CLASSIFIERS } from "../../../prisma/classifiers/fixtures";

type TestUser = { id: string; role: "USER" | "ADMIN" };
const admin: TestUser = { id: "db-test-admin", role: "ADMIN" };
const alice: TestUser = { id: "db-test-alice", role: "USER" };
const bob: TestUser = { id: "db-test-bob", role: "USER" };

function signIn(user: TestUser | null) {
  vi.mocked(auth).mockResolvedValue((user ? { user } : null) as never);
}

function request(path: string, method: string, body?: unknown) {
  return new NextRequest(`http://localhost${path}`, {
    method,
    ...(body !== undefined && { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }),
  });
}

const idParams = (id: string) => ({ params: Promise.resolve({ id }) });
const changeParams = (id: string, changeId: string) => ({ params: Promise.resolve({ id, changeId }) });

/**
 * A valid classifier whose text is unique to `seed`, so the shared duplicate and similar-content
 * checks for new prompts do not match it against the curated catalog or other test classifiers
 */
function customFields(seed: string): ClassifierFields {
  let n = 0;
  const words = (count: number) => Array.from({ length: count }, () => `${seed}${(n++).toString(36)}`).join(" ");
  return {
    description: `Sorts ${seed} requests ${words(3)}`,
    config: {
      category: "support",
      problem: `Problem ${words(8)}`,
      goal: `Goal ${words(8)}`,
      input: { summary: `Input ${words(3)}`, fields: [{ name: "message", description: `Message ${words(3)}` }] },
      question: {
        key: "urgency",
        type: "choice",
        instructions: `Decide ${words(8)}`,
        options: [
          { key: "urgent", description: words(3) },
          { key: "routine", description: words(3) },
          { key: "unclear", description: words(3) },
        ],
      },
      outcomes: [
        { id: "urgent", label: "Urgent", when: words(3), tone: "stop" },
        { id: "routine", label: "Routine", when: words(3), tone: "proceed" },
        { id: "unclear", label: "Unclear", when: words(3), tone: "review" },
      ],
      guidance: [],
      scenarios: [{ id: "first-case", title: words(2), state: { message: words(5) }, outcome: "urgent", rationale: words(4) }],
      references: [],
      tags: [],
    },
  };
}

async function createClassifier(user: TestUser | null, title: string, fields: ClassifierFields, extra: Record<string, unknown> = {}) {
  // New prompts are rate limited per user; move this user's earlier prompts out of the window
  if (user) await db.prompt.updateMany({ where: { authorId: user.id }, data: { createdAt: new Date(Date.now() - 60_000) } });
  signIn(user);
  return createPromptRoute(request("/api/prompts", "POST", { title, type: "CLASSIFIER", classifier: fields, tagIds: [], isPrivate: false, ...extra }));
}

async function updateClassifier(user: TestUser | null, id: string, body: unknown) {
  signIn(user);
  return updatePromptRoute(request(`/api/prompts/${id}`, "PATCH", body), idParams(id));
}

async function propose(user: TestUser | null, id: string, body: unknown) {
  signIn(user);
  return proposeChangeRoute(request(`/api/prompts/${id}/changes`, "POST", body), idParams(id));
}

async function review(user: TestUser | null, id: string, changeId: string, status: "APPROVED" | "REJECTED") {
  signIn(user);
  return reviewChangeRoute(request(`/api/prompts/${id}/changes/${changeId}`, "PATCH", { status }), changeParams(id, changeId));
}

beforeAll(async () => {
  await db.user.createMany({
    data: [admin, alice, bob].map((u) => ({
      id: u.id,
      role: u.role,
      email: `${u.id}@example.test`,
      username: u.id.replace("db-test-", ""),
      name: u.id,
    })),
  });
});

describe("curated catalog import", () => {
  const fixture = prepareClassifierCatalog().counts;

  it("aborts without writing anything when a curated slug is held by a user classifier", async () => {
    await db.prompt.create({
      data: {
        id: "user-held-slug",
        title: "Mine",
        slug: "ticket-urgency",
        content: "user content",
        type: "CLASSIFIER",
        authorId: alice.id,
        classifierSlug: "ticket-urgency",
        classifierConfig: {},
      },
    });

    await expect(importClassifierCatalog(db, { id: admin.id })).rejects.toThrow(/held by other prompts: ticket-urgency/);
    expect(await db.prompt.count({ where: { id: { startsWith: "classifier-" } } })).toBe(0);
    expect(await db.classifierSource.count()).toBe(0);
    expect((await db.prompt.findUnique({ where: { id: "user-held-slug" } }))?.content).toBe("user content");

    await db.prompt.delete({ where: { id: "user-held-slug" } });
  });

  it("aborts when the catalog owner does not exist", async () => {
    await expect(importClassifierCatalog(db, { username: "nobody" })).rejects.toThrow(/owner .* does not exist/);
    expect(await db.prompt.count()).toBe(0);
  });

  it("imports every classifier, chain, pairing, source and first version", async () => {
    const result = await importClassifierCatalog(db, { id: admin.id });
    expect(result).toMatchObject({ authorId: admin.id, classifiersInserted: fixture.classifiers, chainsInserted: fixture.chains });

    expect(await db.prompt.count({ where: { type: "CLASSIFIER", authorId: admin.id } })).toBe(59);
    expect(await db.classifierChain.count()).toBe(16);
    expect(await db.classifierChainStep.count()).toBe(fixture.steps);
    expect(await db.classifierPairing.count()).toBe(fixture.pairings);
    expect(await db.classifierSource.count()).toBe(fixture.sources);
    expect(await db.promptVersion.count({ where: { prompt: { type: "CLASSIFIER" }, classifierSnapshot: { not: undefined } } })).toBe(59);
  });

  it("reads the catalog back from the database", async () => {
    const catalog = await getClassifierCatalog();
    expect(catalog.classifiers).toHaveLength(59);
    expect(catalog.chains).toHaveLength(16);
    expect(catalog.classifiers.reduce((n, c) => n + c.scenarios.length, 0)).toBe(252);
    expect(catalog.chains.reduce((n, c) => n + c.scenarios.length, 0)).toBe(109);
    expect(catalog.classifiers.every((c) => c.curated)).toBe(true);

    const urgency = catalog.classifiers.find((c) => c.slug === "ticket-urgency")!;
    const expected = CLASSIFIERS.find((c) => c.slug === "ticket-urgency")!;
    expect(urgency.outcomes).toEqual(expected.outcomes);
    expect(urgency.betterTogether.map((l) => l.slug)).toEqual(expected.betterTogether.map((l) => l.slug));
    expect(await findClassifierBySlug("does-not-exist")).toBeNull();
  });

  it("re-runs as a no-op that keeps edits and deletions made since", async () => {
    const id = curatedClassifierId("ticket-urgency");
    await db.prompt.update({ where: { id }, data: { title: "Edited by an admin" } });
    await db.classifierPairing.deleteMany({ where: { fromId: id } });

    const result = await importClassifierCatalog(db, { id: admin.id });
    expect(result).toMatchObject({ classifiersInserted: 0, chainsInserted: 0 });
    expect((await db.prompt.findUnique({ where: { id } }))?.title).toBe("Edited by an admin");
    expect(await db.classifierPairing.count({ where: { fromId: id } })).toBe(0);
    expect(await db.prompt.count({ where: { type: "CLASSIFIER" } })).toBe(59);
  });
});

describe("user classifiers", () => {
  const aliceFields = customFields("alpha");
  const editOf = () => structuredClone(aliceFields);
  let aliceId = "";
  let aliceSlug = "";

  it("requires sign-in to create", async () => {
    const response = await createClassifier(null, "Anonymous classifier", customFields("anon"));
    expect(response.status).toBe(401);
  });

  it("creates a classifier owned by the signed-in user, ignoring a submitted author", async () => {
    const response = await createClassifier(alice, "Refund urgency", aliceFields, { authorId: bob.id, content: "ignored" });
    expect(response.status).toBe(200);
    const created = await response.json();
    aliceId = created.id;

    const row = await db.prompt.findUniqueOrThrow({ where: { id: aliceId }, include: { versions: true } });
    aliceSlug = row.classifierSlug!;
    expect(row).toMatchObject({ authorId: alice.id, type: "CLASSIFIER", classifierSlug: "refund-urgency", isPrivate: false });
    expect(row.content).toContain("Refund urgency");
    expect(row.content).not.toBe("ignored");
    expect(row.versions).toHaveLength(1);
    expect(row.versions[0].classifierSnapshot).toMatchObject({ title: "Refund urgency" });

    const catalog = await getClassifierCatalog();
    const record = catalog.classifiers.find((c) => c.slug === aliceSlug);
    expect(record).toMatchObject({ curated: false, author: { username: "alice" } });
  });

  it("gives a second classifier with the same name its own slug and never takes a curated or reserved one", async () => {
    const again = await (await createClassifier(bob, "Refund urgency", customFields("bravo"))).json();
    const curated = await (await createClassifier(bob, "Ticket urgency", customFields("charlie"))).json();
    const reserved = await (await createClassifier(bob, "New", customFields("delta"))).json();
    const slugs = await db.prompt.findMany({ where: { id: { in: [again.id, curated.id, reserved.id] } }, select: { classifierSlug: true } });
    expect(slugs.map((s) => s.classifierSlug).sort()).toEqual(["new-2", "refund-urgency-2", "ticket-urgency-2"]);
  });

  it("rejects invalid structured fields on create", async () => {
    const broken = customFields("foxtrot");
    broken.config.scenarios[0].outcome = "not_an_outcome";
    const response = await createClassifier(alice, "Broken", broken);
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: "invalid_classifier" });

    const missing = await createClassifier(alice, "No fields", undefined as never);
    expect(missing.status).toBe(400);
    expect(await db.prompt.count({ where: { title: { in: ["Broken", "No fields"] } } })).toBe(0);
  });

  it("lets the owner edit and versions the change, deriving the content again", async () => {
    const fields = editOf();
    fields.config.question.instructions = "Decide how quickly a refund request needs a person.";
    const response = await updateClassifier(alice, aliceId, { title: "Refund urgency", classifier: fields });
    expect(response.status).toBe(200);

    const row = await db.prompt.findUniqueOrThrow({ where: { id: aliceId }, include: { versions: { orderBy: { version: "asc" } } } });
    expect(row.classifierSlug).toBe(aliceSlug);
    expect(row.content).toContain("Decide how quickly a refund request needs a person.");
    expect(row.versions.map((v) => v.version)).toEqual([1, 2]);
    expect(row.versions[1].classifierSnapshot).toMatchObject({ config: { question: { instructions: fields.config.question.instructions } } });
  });

  it("rejects raw content, type changes and invalid fields on edit", async () => {
    expect((await updateClassifier(alice, aliceId, { content: "free text" })).status).toBe(400);
    expect((await updateClassifier(alice, aliceId, { type: "TEXT" })).status).toBe(400);
    const broken = editOf();
    broken.config.outcomes = broken.config.outcomes.slice(0, 1);
    expect((await updateClassifier(alice, aliceId, { classifier: broken })).status).toBe(400);
  });

  it("refuses edits from signed-out and other users", async () => {
    const before = await db.prompt.findUniqueOrThrow({ where: { id: aliceId } });
    expect((await updateClassifier(null, aliceId, { classifier: editOf() })).status).toBe(401);
    expect((await updateClassifier(bob, aliceId, { title: "Taken over", classifier: editOf() })).status).toBe(403);
    const after = await db.prompt.findUniqueOrThrow({ where: { id: aliceId } });
    expect(after.title).toBe(before.title);
    expect(after.content).toBe(before.content);
  });

  describe("change requests", () => {
    it("lets another user propose a validated change without touching the classifier", async () => {
      const before = await db.prompt.findUniqueOrThrow({ where: { id: aliceId } });
      const fields = editOf();
      fields.description = "Sorts refund requests by how quickly they need a reply.";
      const response = await propose(bob, aliceId, { proposedClassifier: fields, reason: "Clearer summary" });
      expect(response.status).toBe(201);
      const change = await response.json();

      const stored = await db.changeRequest.findUniqueOrThrow({ where: { id: change.id } });
      expect(stored).toMatchObject({ authorId: bob.id, status: "PENDING" });
      expect(stored.proposedClassifier).toMatchObject({ description: fields.description });
      expect(stored.originalClassifier).toMatchObject({ description: before.description });
      expect(stored.proposedContent).toContain(fields.description);
      expect((await db.prompt.findUniqueOrThrow({ where: { id: aliceId } })).description).toBe(before.description);
    });

    it("validates proposals and refuses the owner, signed-out users and no-op changes", async () => {
      const broken = editOf();
      broken.config.question.options = broken.config.question.options.slice(0, 1);
      expect((await propose(bob, aliceId, { proposedClassifier: broken })).status).toBe(400);

      const current = await db.prompt.findUniqueOrThrow({ where: { id: aliceId } });
      const unchanged = { description: current.description!, config: current.classifierConfig as ClassifierFields["config"] };
      const noop = await propose(bob, aliceId, { proposedClassifier: unchanged });
      expect(noop.status).toBe(400);
      expect(await noop.json()).toMatchObject({ error: "no_change" });

      expect((await propose(alice, aliceId, { proposedClassifier: editOf() })).status).toBe(403);
      expect((await propose(null, aliceId, { proposedClassifier: editOf() })).status).toBe(401);
      expect(await db.changeRequest.count({ where: { promptId: aliceId } })).toBe(1);
    });

    it("only lets the owner accept, then applies the fields, records a version and credits the contributor", async () => {
      const change = await db.changeRequest.findFirstOrThrow({ where: { promptId: aliceId, status: "PENDING" } });
      expect((await review(bob, aliceId, change.id, "APPROVED")).status).toBe(403);
      expect((await review(null, aliceId, change.id, "APPROVED")).status).toBe(401);

      const response = await review(alice, aliceId, change.id, "APPROVED");
      expect(response.status).toBe(200);
      const row = await db.prompt.findUniqueOrThrow({
        where: { id: aliceId },
        include: { contributors: { select: { id: true } }, versions: { orderBy: { version: "desc" }, take: 1 } },
      });
      expect(row.description).toBe("Sorts refund requests by how quickly they need a reply.");
      expect(row.content).toContain("Sorts refund requests by how quickly they need a reply.");
      expect(row.contributors.map((c) => c.id)).toContain(bob.id);
      expect(row.versions[0]).toMatchObject({ version: 3, createdBy: bob.id });
      expect((await db.changeRequest.findUniqueOrThrow({ where: { id: change.id } })).status).toBe("APPROVED");
    });

    it("leaves the classifier unchanged when the owner rejects", async () => {
      const before = await db.prompt.findUniqueOrThrow({ where: { id: aliceId } });
      const fields = editOf();
      fields.config.goal = "A goal the owner does not want.";
      const change = await (await propose(bob, aliceId, { proposedClassifier: fields })).json();

      expect((await review(alice, aliceId, change.id, "REJECTED")).status).toBe(200);
      const after = await db.prompt.findUniqueOrThrow({ where: { id: aliceId } });
      expect(after.classifierConfig).toEqual(before.classifierConfig);
      expect(after.content).toBe(before.content);
    });

    it("validates the stored proposal again on acceptance", async () => {
      const fields = editOf();
      fields.config.goal = "Another goal.";
      const change = await (await propose(bob, aliceId, { proposedClassifier: fields })).json();
      const broken = { ...fields, config: { ...fields.config, outcomes: [] } };
      await db.changeRequest.update({ where: { id: change.id }, data: { proposedClassifier: broken as unknown as Prisma.InputJsonValue } });

      const before = await db.prompt.findUniqueOrThrow({ where: { id: aliceId } });
      const response = await review(alice, aliceId, change.id, "APPROVED");
      expect(response.status).toBe(400);
      const after = await db.prompt.findUniqueOrThrow({ where: { id: aliceId } });
      expect(after.content).toBe(before.content);
      expect((await db.changeRequest.findUniqueOrThrow({ where: { id: change.id } })).status).toBe("PENDING");
    });
  });

  describe("visibility", () => {
    let privateId = "";
    let privateSlug = "";

    it("keeps private classifiers out of the catalog and away from other users", async () => {
      const created = await (await createClassifier(alice, "Private triage", customFields("echo"), { isPrivate: true })).json();
      privateId = created.id;
      privateSlug = (await db.prompt.findUniqueOrThrow({ where: { id: privateId } })).classifierSlug!;

      const catalog = await getClassifierCatalog();
      expect(catalog.classifiers.some((c) => c.slug === privateSlug)).toBe(false);

      signIn(bob);
      expect((await getPromptRoute(request(`/api/prompts/${privateId}`, "GET"), idParams(privateId))).status).toBe(403);
      signIn(null);
      expect((await getPromptRoute(request(`/api/prompts/${privateId}`, "GET"), idParams(privateId))).status).toBe(403);
      signIn(alice);
      expect((await getPromptRoute(request(`/api/prompts/${privateId}`, "GET"), idParams(privateId))).status).toBe(200);
    });

    it("refuses change requests on private classifiers", async () => {
      expect((await propose(bob, privateId, { proposedClassifier: editOf() })).status).toBe(403);
      expect(await db.changeRequest.count({ where: { promptId: privateId } })).toBe(0);
    });

    it("keeps unlisted classifiers out of the listing but reachable by link", async () => {
      await db.prompt.update({ where: { id: aliceId }, data: { isUnlisted: true } });
      const catalog = await getClassifierCatalog();
      expect(catalog.classifiers.some((c) => c.slug === aliceSlug)).toBe(true);
      expect(listedClassifiers(catalog).some((c) => c.slug === aliceSlug)).toBe(false);
      expect(await findClassifierBySlug(aliceSlug)).not.toBeNull();
      await db.prompt.update({ where: { id: aliceId }, data: { isUnlisted: false } });
    });

    it("drops deleted classifiers from the catalog", async () => {
      signIn(admin);
      const response = await deletePromptRoute(request(`/api/prompts/${privateId}`, "DELETE"), idParams(privateId));
      expect(response.status).toBe(200);
      expect(await findClassifierBySlug(privateSlug)).toBeNull();
    });
  });
});

describe("classifiers used by curated chains", () => {
  const urgencyId = curatedClassifierId("ticket-urgency");

  it("cannot be made private or deleted", async () => {
    const response = await updateClassifier(admin, urgencyId, { isPrivate: true });
    expect(response.status).toBe(409);
    expect((await db.prompt.findUniqueOrThrow({ where: { id: urgencyId } })).isPrivate).toBe(false);

    signIn(admin);
    const deleted = await deletePromptRoute(request(`/api/prompts/${urgencyId}`, "DELETE"), idParams(urgencyId));
    expect(deleted.status).toBe(409);
    await expect(db.prompt.delete({ where: { id: urgencyId } })).rejects.toThrow();
  });

  it("refuses a proposal that would break a chain branch", async () => {
    const row = await db.prompt.findUniqueOrThrow({ where: { id: urgencyId } });
    const config = structuredClone(row.classifierConfig) as ClassifierFields["config"];
    const removed = config.outcomes.pop()!;
    config.scenarios = config.scenarios.filter((s) => s.outcome !== removed.id);
    const response = await propose(bob, urgencyId, { proposedClassifier: { description: row.description!, config } });
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: "classifier_in_chain" });
  });

  it("counts upvotes from the shared prompt vote route for catalog cards, per viewer", async () => {
    const id = curatedClassifierId("refund-eligibility");
    const vote = (user: TestUser | null, method: "POST" | "DELETE") => {
      signIn(user);
      return (method === "POST" ? voteRoute : unvoteRoute)(request(`/api/prompts/${id}/vote`, method), idParams(id));
    };

    expect((await vote(null, "POST")).status).toBe(401);
    expect(await getClassifierVotes([id])).toEqual({ counts: new Map(), voted: new Set() });

    expect(await (await vote(alice, "POST")).json()).toEqual({ voted: true, voteCount: 1 });
    expect(await (await vote(bob, "POST")).json()).toEqual({ voted: true, voteCount: 2 });
    expect(await getClassifierVotes([id, urgencyId], alice.id)).toEqual({ counts: new Map([[id, 2]]), voted: new Set([id]) });
    expect((await getClassifierVotes([id])).voted.size).toBe(0);

    expect(await (await vote(alice, "DELETE")).json()).toEqual({ voted: false, voteCount: 1 });
    expect(await getClassifierVotes([id], alice.id)).toEqual({ counts: new Map([[id, 1]]), voted: new Set() });
    expect((await getClassifierVotes([id], bob.id)).voted).toEqual(new Set([id]));
  });

  it("accepts a change that keeps every chain valid and serves it from the catalog", async () => {
    const row = await db.prompt.findUniqueOrThrow({ where: { id: urgencyId } });
    const config = structuredClone(row.classifierConfig) as ClassifierFields["config"];
    config.goal = "Edited goal, served from the database.";
    const change = await (await propose(bob, urgencyId, { proposedClassifier: { description: row.description!, config } })).json();
    expect((await review(admin, urgencyId, change.id, "APPROVED")).status).toBe(200);

    const catalog = await getClassifierCatalog();
    expect(catalog.classifiers.find((c) => c.slug === "ticket-urgency")?.goal).toBe("Edited goal, served from the database.");
    expect(catalog.chains).toHaveLength(16);
  });
});
