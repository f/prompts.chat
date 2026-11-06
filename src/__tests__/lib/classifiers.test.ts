import { describe, it, expect } from "vitest";
import {
  CLASSIFIER_CATEGORIES,
  MAX_SCORE_LEVELS,
  REFERENCES,
  buildSystemOneRequest,
  filterChains,
  filterClassifiers,
  formatClassifierDefinition,
  formatClassifierOutcomes,
  getChain,
  getChains,
  getChainsForClassifier,
  getClassifier,
  getClassifiers,
  getScenarioHighlight,
  getSharedChains,
  validateCatalog,
  type ClassifierChain,
  type ClassifierDefinition,
} from "@/lib/classifiers";

const clone = <T,>(value: T): T => structuredClone(value);

describe("classifier catalog integrity", () => {
  it("passes every catalog check", () => {
    expect(validateCatalog()).toEqual([]);
  });

  it("ships a focused initial set", () => {
    expect(getClassifiers().length).toBeGreaterThanOrEqual(8);
    expect(getClassifiers().length).toBeLessThanOrEqual(12);
    expect(getChains().length).toBeGreaterThanOrEqual(3);
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

  it("puts every classifier in at least one chain and some in several", () => {
    for (const c of getClassifiers()) {
      expect(getChainsForClassifier(c.slug).length, c.slug).toBeGreaterThan(0);
    }
    expect(getClassifiers().some((c) => getChainsForClassifier(c.slug).length > 1)).toBe(true);
  });

  it("gives each classifier a human review or caution outcome", () => {
    for (const c of getClassifiers()) {
      expect(c.outcomes.some((o) => o.tone === "review" || o.tone === "caution"), c.slug).toBe(true);
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
