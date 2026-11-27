import { describe, it, expect } from "vitest";
import {
  CLASSIFIER_CATEGORIES,
  MAX_SCORE_LEVELS,
  buildSystemOneRequest,
  filterChains,
  filterClassifiers,
  formatClassifierDefinition,
  formatClassifierOutcomes,
  getChainsForClassifier as chainsForClassifier,
  getScenarioHighlight,
  getSharedChains as sharedChains,
  validateCatalog as validateCatalogWith,
  type ClassifierChain,
  type ClassifierDefinition,
} from "@/lib/classifiers";
import { CHAINS, CLASSIFIERS, SOURCES } from "../../../prisma/classifiers/fixtures";

// The curated catalog lives in prisma/classifiers/fixtures and is imported into the database;
// these tests check the fixtures with the same validators the importer runs.
const getClassifiers = () => CLASSIFIERS;
const getChains = () => CHAINS;
const getClassifier = (slug: string) => CLASSIFIERS.find((c) => c.slug === slug);
const getChain = (slug: string) => CHAINS.find((c) => c.slug === slug);
const getChainsForClassifier = (slug: string) => chainsForClassifier(CHAINS, slug);
const getSharedChains = (a: string, b: string) => sharedChains(CHAINS, a, b);
const REFERENCES = Object.fromEntries(SOURCES.map((s) => [s.id, s]));
const validateCatalog = (classifiers: ClassifierDefinition[] = CLASSIFIERS, chains: ClassifierChain[] = CHAINS) =>
  validateCatalogWith(classifiers, chains, SOURCES.map((s) => s.id));

const clone = <T,>(value: T): T => structuredClone(value);

describe("classifier catalog integrity", () => {
  it("passes every catalog check", () => {
    expect(validateCatalog()).toEqual([]);
  });

  it("ships an expanded catalog of around sixty classifiers and fifteen chains", () => {
    expect(getClassifiers().length).toBeGreaterThanOrEqual(55);
    expect(getClassifiers().length).toBeLessThanOrEqual(65);
    expect(getChains().length).toBeGreaterThanOrEqual(14);
    expect(getChains().length).toBeLessThanOrEqual(17);
  });

  it("covers each requested domain with classifiers and a chain", () => {
    const domainChains = [
      "order-problem-resolution",
      "return-intake-and-inspection",
      "delivery-exception-routing",
      "saas-billing-desk",
      "incident-alert-triage",
      "it-helpdesk-intake",
      "issue-intake-triage",
      "pull-request-review-prep",
      "finance-mailbox-intake",
      "feedback-triage",
      "course-assistant-questions",
      "agent-action-safety",
      "community-post-moderation",
      "grounded-support-assistant",
    ];
    for (const slug of domainChains) expect(getChain(slug), slug).toBeDefined();
    for (const category of CLASSIFIER_CATEGORIES) {
      expect(getClassifiers().filter((c) => c.category === category).length, category).toBeGreaterThanOrEqual(2);
    }
  });

  it("reuses shared classifiers across chains", () => {
    for (const slug of ["prompt-injection-signal", "agent-tool-routing", "passage-relevance", "answer-groundedness"]) {
      expect(getChainsForClassifier(slug).length, slug).toBeGreaterThanOrEqual(2);
    }
  });

  it("covers every requested use case", () => {
    for (const slug of [
      "support-ticket-routing",
      "ticket-urgency",
      "refund-eligibility",
      "refund-information-completeness",
      "content-policy-category",
      "agent-tool-routing",
      "answer-groundedness",
      "prompt-injection-signal",
    ]) {
      expect(getClassifier(slug), slug).toBeDefined();
    }
  });

  it("uses every category", () => {
    const used = new Set(getClassifiers().map((c) => c.category));
    expect([...used].sort()).toEqual([...CLASSIFIER_CATEGORIES].sort());
  });

  it("puts nearly every classifier in a chain and pairs the standalone ones", () => {
    const standalone = getClassifiers().filter((c) => getChainsForClassifier(c.slug).length === 0);
    expect(standalone.length / getClassifiers().length).toBeLessThanOrEqual(0.1);
    for (const c of standalone) expect(c.betterTogether.length, c.slug).toBeGreaterThanOrEqual(2);
  });

  it("gives each classifier a human review or caution outcome", () => {
    for (const c of getClassifiers()) {
      expect(c.outcomes.some((o) => o.tone === "review" || o.tone === "caution"), c.slug).toBe(true);
    }
  });

  it("gives each classifier varied examples, including an uncertain one", () => {
    for (const c of getClassifiers()) {
      expect(c.scenarios.length, c.slug).toBeGreaterThanOrEqual(3);
      expect(new Set(c.scenarios.map((s) => s.outcome)).size, c.slug).toBeGreaterThanOrEqual(3);
      const uncertain = c.outcomes.filter((o) => o.tone === "review" || o.tone === "caution").map((o) => o.id);
      expect(c.scenarios.some((s) => uncertain.includes(s.outcome)), c.slug).toBe(true);
    }
  });

  it("keeps Better together links pointing at real, distinct classifiers", () => {
    for (const c of getClassifiers()) {
      expect(c.betterTogether.length, c.slug).toBeGreaterThan(0);
      for (const link of c.betterTogether) {
        expect(getClassifier(link.slug), `${c.slug} -> ${link.slug}`).toBeDefined();
        expect(link.slug).not.toBe(c.slug);
        expect(link.reason.length).toBeGreaterThan(10);
      }
    }
  });

  it("makes every Better together link reciprocal", () => {
    for (const c of getClassifiers()) {
      for (const link of c.betterTogether) {
        const partner = getClassifier(link.slug)!;
        expect(partner.betterTogether.map((l) => l.slug), `${link.slug} -> ${c.slug}`).toContain(c.slug);
      }
    }
  });

  it("keeps classifier and chain slugs unique across the catalog", () => {
    const slugs = [...getClassifiers().map((c) => c.slug), ...getChains().map((c) => c.slug)];
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("only classifies the type of high-stakes documents and messages, then hands off", () => {
    const documentType = getClassifier("business-document-type")!;
    expect(documentType.caveats?.join(" ")).toMatch(/type only/);
    expect(getClassifier("student-question-type")!.caveats?.join(" ")).toMatch(/doesn't assess/);
    const finance = getChain("finance-mailbox-intake")!;
    for (const id of ["legal", "restricted", "callback", "approval"]) {
      expect(finance.terminals.find((t) => t.id === id)?.kind, id).toBe("human");
    }
  });

  it("never blocks a cancellation", () => {
    const desk = getChain("saas-billing-desk")!;
    const reason = desk.steps.find((s) => s.classifier === "cancellation-reason")!;
    for (const branch of reason.branches) expect(branch.to, branch.outcomes.join()).toMatch(/^cancel/);
  });

  it("keeps a person in charge of merges, payments, severity and access", () => {
    const prChain = getChain("pull-request-review-prep")!;
    for (const t of prChain.terminals.filter((t) => t.kind === "automated" && t.id !== "ask_author")) {
      expect(t.description, t.id).toMatch(/A person reviews and merges/);
    }
    expect(getClassifier("pr-change-risk")!.caveats?.join(" ")).toMatch(/Never merge/);
    expect(getClassifier("incident-severity")!.caveats?.join(" ")).toMatch(/proposal only/i);
    expect(getClassifier("access-request-completeness")!.caveats?.join(" ")).toMatch(/never grants access/);
  });

  it("only cites known references with https URLs", () => {
    for (const ref of Object.values(REFERENCES)) {
      expect(ref.url).toMatch(/^https:\/\//);
    }
    for (const c of getClassifiers()) {
      for (const id of c.references) expect(REFERENCES[id], `${c.slug}: ${id}`).toBeDefined();
      for (const s of c.scenarios) {
        if (s.adaptedFrom) expect(REFERENCES[s.adaptedFrom]).toBeDefined();
      }
    }
  });

  it("never presents the injection signal as a security boundary", () => {
    const injection = getClassifier("prompt-injection-signal")!;
    expect(injection.caveats?.join(" ").toLowerCase()).toContain("never a security boundary");
  });

  it("contains no fabricated accuracy or adoption numbers", () => {
    const text = JSON.stringify([getClassifiers(), getChains()]).toLowerCase();
    expect(text).not.toMatch(/\d+(\.\d+)?\s?% (accuracy|precision|recall)/);
    expect(text).not.toMatch(/"(confidence|probability)":\s*0?\.\d/);
  });
});

describe("chains", () => {
  it("covers every outcome of every step with exactly one branch", () => {
    for (const chain of getChains()) {
      for (const step of chain.steps) {
        const classifier = getClassifier(step.classifier)!;
        const covered = step.branches.flatMap((b) => b.outcomes).sort();
        expect(covered, `${chain.slug}/${step.id}`).toEqual(classifier.outcomes.map((o) => o.id).sort());
      }
    }
  });

  it("walks every scenario from the entry to its terminal", () => {
    for (const chain of getChains()) {
      for (const scenario of chain.scenarios) {
        let current = chain.entry;
        for (const { step, outcome } of scenario.path) {
          expect(step).toBe(current);
          const branch = chain.steps.find((s) => s.id === step)!.branches.find((b) => b.outcomes.includes(outcome));
          expect(branch, `${chain.slug}/${scenario.id}/${step}`).toBeDefined();
          current = branch!.to;
        }
        expect(current, `${chain.slug}/${scenario.id}`).toBe(scenario.terminal);
      }
    }
  });

  it("shows several alternative endings per chain", () => {
    for (const chain of getChains()) {
      expect(new Set(chain.scenarios.map((s) => s.terminal)).size, chain.slug).toBeGreaterThanOrEqual(3);
    }
  });

  it("passes every step in at least one scenario and ends at least one with a person", () => {
    for (const chain of getChains()) {
      const visited = new Set(chain.scenarios.flatMap((s) => s.path.map((p) => p.step)));
      for (const step of chain.steps) expect(visited.has(step.id), `${chain.slug}/${step.id}`).toBe(true);
      const ends = new Set(chain.scenarios.map((s) => s.terminal));
      expect(chain.terminals.some((t) => t.kind === "human" && ends.has(t.id)), chain.slug).toBe(true);
      expect(new Set(chain.scenarios.map((s) => s.id)).size, chain.slug).toBe(chain.scenarios.length);
    }
  });

  it("only hands off to chains that exist", () => {
    const slugs = new Set(getChains().map((c) => c.slug));
    const handoffs = getChains().flatMap((c) => c.terminals.filter((t) => t.kind === "handoff"));
    expect(handoffs.length).toBeGreaterThanOrEqual(8);
    for (const t of handoffs) expect(slugs.has(t.handoffChain!), t.id).toBe(true);
  });

  it("links the triage and refund chains in both directions", () => {
    const triage = getChain("support-inbox-triage")!;
    const refund = getChain("refund-request-resolution")!;
    expect(triage.terminals.find((t) => t.handoffChain === refund.slug)).toBeDefined();
    expect(refund.terminals.find((t) => t.handoffChain === triage.slug)).toBeDefined();
  });

  it("finds chains shared by two classifiers", () => {
    const shared = getSharedChains("support-ticket-routing", "ticket-urgency").map((c) => c.slug);
    expect(shared).toContain("support-inbox-triage");
    expect(getSharedChains("harm-severity", "passage-relevance")).toEqual([]);
  });

  it("highlights the steps, edges and terminal of a scenario", () => {
    const chain = getChain("support-inbox-triage")!;
    const highlight = getScenarioHighlight(chain, "duplicate-charge")!;
    expect([...highlight.steps]).toEqual(["scope", "route", "refund_check"]);
    expect(highlight.edges.has("route->refund_check")).toBe(true);
    expect(highlight.terminal).toBe("refund_flow");
    expect(highlight.outcomes.get("route")).toBe("billing");
    expect(getScenarioHighlight(chain, "missing")).toBeUndefined();
  });
});

describe("validateCatalog catches broken data", () => {
  const classifiers = () => clone(getClassifiers());
  const chains = () => clone(getChains());

  it("flags a dangling Better together link", () => {
    const list = classifiers();
    list[0].betterTogether.push({ slug: "does-not-exist", reason: "Broken on purpose for the test." });
    expect(validateCatalog(list, getChains()).join("\n")).toMatch(/does-not-exist/);
  });

  it("flags duplicate slugs", () => {
    const list = classifiers();
    list.push(clone(list[0]));
    expect(validateCatalog(list, getChains()).join("\n")).toMatch(/duplicate slug/);
  });

  it("flags a choice option without an outcome", () => {
    const list = classifiers();
    const routing = list.find((c) => c.slug === "support-ticket-routing")!;
    routing.question.options.push({ key: "legal", description: "Legal questions." });
    expect(validateCatalog(list, getChains()).length).toBeGreaterThan(0);
  });

  it("flags a score question above the API limit", () => {
    const list = classifiers();
    const score = list.find((c) => c.question.type === "score")!;
    score.question.options = Array.from({ length: MAX_SCORE_LEVELS + 1 }, (_, i) => ({
      key: String(i),
      description: `Level ${i}`,
    }));
    expect(validateCatalog(list, getChains()).length).toBeGreaterThan(0);
  });

  it("flags an outcome without a branch", () => {
    const list = chains();
    list[0].steps[0].branches.pop();
    expect(validateCatalog(getClassifiers(), list).length).toBeGreaterThan(0);
  });

  it("flags a branch to an unknown node", () => {
    const list = chains();
    list[0].steps[0].branches[0].to = "nowhere";
    expect(validateCatalog(getClassifiers(), list).join("\n")).toMatch(/nowhere/);
  });

  it("flags a scenario that ends somewhere else", () => {
    const list = chains();
    const chain = list.find((c) => c.slug === "support-inbox-triage")!;
    chain.scenarios.find((s) => s.id === "duplicate-charge")!.terminal = "on_call";
    expect(validateCatalog(getClassifiers(), list).length).toBeGreaterThan(0);
  });

  it("flags inputs taken from a step that has not run yet", () => {
    const list = chains();
    const chain = list.find((c) => c.slug === "support-inbox-triage")!;
    chain.steps[0].receives.push({ from: chain.steps[chain.steps.length - 1].id, value: "too early" });
    expect(validateCatalog(getClassifiers(), list).length).toBeGreaterThan(0);
  });

  it("flags a cycle", () => {
    const list = chains();
    const chain: ClassifierChain = list.find((c) => c.slug === "refund-request-resolution")!;
    const last = chain.steps[chain.steps.length - 1];
    last.branches[0].to = chain.entry;
    expect(validateCatalog(getClassifiers(), list).length).toBeGreaterThan(0);
  });

  it("flags a Better together link that is not returned", () => {
    const list = classifiers();
    const routing = list.find((c) => c.slug === "support-ticket-routing")!;
    routing.betterTogether.push({ slug: "reading-level-fit", reason: "Not linked back on purpose." });
    expect(validateCatalog(list, getChains()).join("\n")).toMatch(/does not link back/);
  });

  it("flags a classifier without an uncertain example", () => {
    const list = classifiers();
    const routing = list.find((c) => c.slug === "support-ticket-routing")!;
    routing.scenarios = routing.scenarios.filter((s) => s.outcome !== "low_confidence");
    expect(validateCatalog(list, getChains()).join("\n")).toMatch(/review or caution/);
  });

  it("flags a chain with no human ending", () => {
    const list = chains();
    const chain = list.find((c) => c.slug === "feedback-triage")!;
    for (const t of chain.terminals) if (t.kind === "human") t.kind = "automated";
    expect(validateCatalog(getClassifiers(), list).join("\n")).toMatch(/person decides/);
  });

  it("flags a step that no scenario passes through", () => {
    const list = chains();
    const chain = list.find((c) => c.slug === "feedback-triage")!;
    chain.scenarios = chain.scenarios.filter((s) => !s.path.some((p) => p.step === "specificity"));
    expect(validateCatalog(getClassifiers(), list).join("\n")).toMatch(/no scenario passes through step "specificity"/);
  });

  it("flags duplicate chain scenario ids", () => {
    const list = chains();
    list[0].scenarios[1].id = list[0].scenarios[0].id;
    expect(validateCatalog(getClassifiers(), list).join("\n")).toMatch(/duplicate scenario ids/);
  });

  it("flags a handoff to an unknown chain", () => {
    const list = chains();
    const handoff = list.flatMap((c) => c.terminals).find((t) => t.kind === "handoff")!;
    handoff.handoffChain = "ghost-chain";
    expect(validateCatalog(getClassifiers(), list).join("\n")).toMatch(/handoff needs a known chain/);
  });
});

describe("buildSystemOneRequest", () => {
  it("sends choice criteria as an object", () => {
    const body = buildSystemOneRequest(getClassifier("support-ticket-routing")!);
    expect(body.model).toBe("jev-latest");
    const question = Object.values(body.questions)[0];
    expect(question.type).toBe("choice");
    expect(Array.isArray(question.criteria)).toBe(false);
    expect(Object.keys(question.criteria as Record<string, string>)).toContain("billing");
  });

  it("sends score criteria as an ordered array", () => {
    const classifier = getClassifier("ticket-urgency")!;
    const question = Object.values(buildSystemOneRequest(classifier, { model: "kev-latest" }).questions)[0];
    expect(Array.isArray(question.criteria)).toBe(true);
    expect((question.criteria as string[]).length).toBe(classifier.question.options.length);
  });

  it("sends noul criteria as true/false", () => {
    const question = Object.values(buildSystemOneRequest(getClassifier("prompt-injection-signal")!).questions)[0];
    expect(Object.keys(question.criteria as Record<string, string>)).toEqual(["true", "false"]);
  });

  it("uses the provided state", () => {
    const body = buildSystemOneRequest(getClassifier("in-scope-check")!, { state: "hello" });
    expect(body.state).toBe("hello");
  });
});

describe("formatting and filtering", () => {
  const routing = getClassifier("support-ticket-routing")!;

  it("formats a copyable definition", () => {
    const text = formatClassifierDefinition(routing);
    expect(text).toContain(routing.name);
    expect(text).toContain(routing.question.instructions);
    for (const o of routing.outcomes) expect(text).toContain(o.id);
  });

  it("formats copyable outcomes", () => {
    expect(formatClassifierOutcomes(routing).split("\n")).toHaveLength(routing.outcomes.length);
  });

  it("filters by category and query", () => {
    const all: ClassifierDefinition[] = getClassifiers();
    const refunds = filterClassifiers(all, { category: "refunds" });
    expect(refunds.length).toBeGreaterThan(0);
    expect(refunds.every((c) => c.category === "refunds")).toBe(true);
    expect(filterClassifiers(all, { query: "injection" }).map((c) => c.slug)).toContain("prompt-injection-signal");
    expect(filterClassifiers(all, { query: "zzzz-no-match" })).toEqual([]);
  });

  it("includes chains that use a classifier from the filtered category", () => {
    const chains = filterChains(getChains(), getClassifiers(), { category: "refunds" }).map((c) => c.slug);
    expect(chains).toContain("refund-request-resolution");
    expect(chains).toContain("support-inbox-triage");
  });
});
