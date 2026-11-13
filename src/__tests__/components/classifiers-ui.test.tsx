import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { ClassifierCatalog } from "@/components/classifiers/classifier-catalog";
import { ScenarioExplorer } from "@/components/classifiers/scenario-explorer";
import { ChainFlow } from "@/components/classifiers/chain-flow";
import { FilterProvider, useFilterContext } from "@/components/prompts/filter-context";
import { CHAINS, CLASSIFIERS, SOURCES } from "../../../prisma/classifiers/fixtures";

const author = { id: "user-ada", name: "Ada", username: "ada", avatar: null, verified: false };
const getClassifiers = () =>
  CLASSIFIERS.map((c, index) => ({ ...c, id: `prompt-${c.slug}`, author, voteCount: index, voted: index === 1 }));
const getChains = () => CHAINS;
const getClassifier = (slug: string) => CLASSIFIERS.find((c) => c.slug === slug);
const getChain = (slug: string) => CHAINS.find((c) => c.slug === slug);

const classifierMap = Object.fromEntries(getClassifiers().map((c) => [c.slug, c]));
const chainNames = Object.fromEntries(getChains().map((c) => [c.slug, c.name]));

beforeEach(() => {
  window.history.replaceState(null, "", "/classifiers");
});

describe("ClassifierCatalog", () => {
  const renderCatalog = () => render(<ClassifierCatalog classifiers={getClassifiers()} chains={getChains()} />);

  it("lists every classifier and chain", () => {
    renderCatalog();
    expect(screen.getAllByTestId("classifier-card")).toHaveLength(getClassifiers().length);
    expect(screen.getAllByTestId("chain-card")).toHaveLength(getChains().length);
  });

  it("shows the author and upvotes like prompt cards, with the title linking the whole card", () => {
    renderCatalog();
    const [first, second] = screen.getAllByTestId("classifier-card");
    const [firstClassifier, secondClassifier] = getClassifiers();

    const title = within(first).getByRole("link", { name: firstClassifier.name });
    expect(title).toHaveAttribute("href", `/classifiers/${firstClassifier.slug}`);
    expect(title.className).toContain("after:inset-0");
    const profile = within(first).getByRole("link", { name: /@ada/ });
    expect(profile).toHaveAttribute("href", "/@ada");
    expect(profile).toHaveClass("relative", "z-10");
    expect(within(first).getAllByRole("link")).toHaveLength(2);
    expect(first.querySelector("a a")).toBeNull();

    const count = (card: HTMLElement, value: number) => within(card).getByText(String(value), { selector: "span" });
    expect(count(first, 0)).not.toHaveClass("text-primary");
    expect(count(second, 1)).toHaveClass("text-primary");
    expect(within(second).getByRole("link", { name: secondClassifier.name })).toBeInTheDocument();
  });

  type Filters = { query?: string; category?: Parameters<typeof ClassifierCatalog>[0]["category"] };
  const renderFiltered = (filters: Filters) =>
    render(<ClassifierCatalog classifiers={getClassifiers()} chains={getChains()} {...filters} />);
  const cardNames = () => screen.queryAllByTestId("classifier-card").map((card) => within(card).getAllByRole("link")[0].textContent);

  it("filters by the category from the URL", () => {
    renderFiltered({ category: "security" });
    const expected = getClassifiers().filter((c) => c.category === "security");
    expect(expected.length).toBeGreaterThan(0);
    expect(cardNames()).toEqual(expected.map((c) => c.name));
  });

  it("filters by a domain category and keeps chains that use it", () => {
    renderFiltered({ category: "logistics" });
    expect(screen.getAllByTestId("classifier-card")).toHaveLength(
      getClassifiers().filter((c) => c.category === "logistics").length
    );
    const chainCards = screen.getAllByTestId("chain-card").map((card) => card.textContent ?? "");
    expect(chainCards.some((text) => text.includes(getChain("delivery-exception-routing")!.name))).toBe(true);
  });

  it("searches classifiers and chains from the URL query", () => {
    renderFiltered({ query: "groundedness" });
    expect(cardNames().length).toBeGreaterThan(0);
    expect(cardNames().length).toBeLessThan(getClassifiers().length);
    expect(cardNames().every((name) => name)).toBe(true);
  });

  it("combines search with a category", () => {
    const refund = getClassifier("refund-eligibility")!;
    const { unmount } = renderFiltered({ query: "refund" });
    const searchOnly = cardNames();
    unmount();
    renderFiltered({ query: "refund", category: refund.category });
    expect(cardNames()).toContain(refund.name);
    expect(cardNames().length).toBeLessThan(searchOnly.length);
    const inCategory = new Set(getClassifiers().filter((c) => c.category === refund.category).map((c) => c.name));
    for (const name of cardNames()) expect(inCategory.has(name!)).toBe(true);
  });

  it("shows no results with a link that resets every filter", () => {
    renderFiltered({ query: "zzzz-no-match", category: "security" });
    expect(screen.queryByTestId("classifier-card")).toBeNull();
    expect(screen.queryByTestId("chain-card")).toBeNull();
    expect(screen.getByText("noResults")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "clearFilters" })).toHaveAttribute("href", "/classifiers");
  });

  it("leaves search and category controls to the listing sidebar", () => {
    renderCatalog();
    expect(screen.queryByRole("searchbox")).toBeNull();
    expect(screen.queryByRole("button", { name: "categories.security" })).toBeNull();
    expect(screen.queryByRole("link", { name: "clearFilters" })).toBeNull();
  });

  it("dims the results while a new filter loads and restores them when it arrives", () => {
    function PendingTrigger() {
      const { setFilterPending } = useFilterContext();
      return <button onClick={() => setFilterPending(true)}>filter</button>;
    }
    const { rerender, container } = render(
      <FilterProvider>
        <PendingTrigger />
        <ClassifierCatalog classifiers={getClassifiers()} chains={getChains()} />
      </FilterProvider>
    );
    const results = () => container.querySelector("[aria-busy]")!;
    expect(results()).toHaveAttribute("aria-busy", "false");
    fireEvent.click(screen.getByRole("button", { name: "filter" }));
    expect(results()).toHaveAttribute("aria-busy", "true");
    rerender(
      <FilterProvider>
        <PendingTrigger />
        <ClassifierCatalog classifiers={getClassifiers()} chains={getChains()} category="security" />
      </FilterProvider>
    );
    expect(results()).toHaveAttribute("aria-busy", "false");
  });
});

describe("ScenarioExplorer", () => {
  it("switches between predefined scenarios", () => {
    const classifier = getClassifier("support-ticket-routing")!;
    render(<ScenarioExplorer classifier={classifier} sources={SOURCES} />);
    const tabs = screen.getAllByRole("tab");
    expect(tabs).toHaveLength(classifier.scenarios.length);
    expect(tabs[0]).toHaveAttribute("aria-selected", "true");

    const second = classifier.scenarios[1];
    fireEvent.click(tabs[1]);
    expect(tabs[1]).toHaveAttribute("aria-selected", "true");
    const outcome = classifier.outcomes.find((o) => o.id === second.outcome)!;
    expect(within(screen.getByTestId("scenario-outcome")).getByText(outcome.label)).toBeInTheDocument();
    expect(screen.getByText(second.rationale)).toBeInTheDocument();
  });
});

describe("ChainFlow", () => {
  const chain = getChain("support-inbox-triage")!;
  const renderFlow = () => render(<ChainFlow chain={chain} classifiers={classifierMap} chainNames={chainNames} />);

  it("shows every step with its branches", () => {
    renderFlow();
    expect(screen.getAllByTestId("chain-step")).toHaveLength(chain.steps.length);
    expect(screen.queryByTestId("scenario-path")).toBeNull();
    expect(document.querySelectorAll("[data-taken]")).toHaveLength(0);
  });

  it("highlights the branches taken by a selected scenario", () => {
    renderFlow();
    const scenario = chain.scenarios.find((s) => s.id === "duplicate-charge")!;
    fireEvent.click(screen.getByRole("button", { name: scenario.title }));

    const panel = screen.getByTestId("scenario-path");
    expect(within(panel).getByText(scenario.summary)).toBeInTheDocument();
    expect(document.querySelectorAll("[data-taken]")).toHaveLength(scenario.path.length);
    expect(window.location.search).toContain("scenario=duplicate-charge");

    const terminal = chain.terminals.find((t) => t.id === scenario.terminal)!;
    expect(within(panel).getByText(terminal.label)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "allBranches" }));
    expect(screen.queryByTestId("scenario-path")).toBeNull();
    expect(window.location.search).not.toContain("scenario=");
  });

  it("selects a scenario from the compact phone picker", () => {
    renderFlow();
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "invoice-copy" } });
    expect(screen.getByTestId("scenario-path")).toBeInTheDocument();
    expect(window.location.search).toContain("scenario=invoice-copy");
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "" } });
    expect(screen.queryByTestId("scenario-path")).toBeNull();
  });

  it("opens a scenario from the URL", () => {
    window.history.replaceState(null, "", "/classifiers/chains/support-inbox-triage?scenario=recruiter");
    renderFlow();
    expect(screen.getByTestId("scenario-path")).toBeInTheDocument();
    expect(document.querySelectorAll("[data-taken]")).toHaveLength(1);
  });

  it("links the handoff endpoint to the next chain from the overview", () => {
    renderFlow();
    const overview = screen.getByTestId("chain-overview");
    const handoff = chain.terminals.find((t) => t.handoffChain)!;
    const link = within(overview).getByRole("link", { name: handoff.label });
    expect(link).toHaveAttribute("href", "/classifiers/chains/refund-request-resolution");
  });

  it("summarises every step and endpoint in the overview", () => {
    renderFlow();
    const overview = screen.getByTestId("chain-overview");
    for (const step of chain.steps) {
      const name = classifierMap[step.classifier].name;
      expect(within(overview).getByRole("link", { name })).toHaveAttribute("href", `#step-${step.id}`);
    }
    for (const end of chain.terminals) {
      expect(overview.querySelector(`#end-${end.id}`)).not.toBeNull();
    }
  });

  it("marks the endpoint a scenario reaches", () => {
    renderFlow();
    fireEvent.click(screen.getByRole("button", { name: chain.scenarios[0].title }));
    const reached = document.querySelectorAll("[data-reached]");
    expect(reached).toHaveLength(1);
    expect(reached[0].closest("li")).toHaveAttribute("id", `end-${chain.scenarios[0].terminal}`);
  });

  it("links each step to its classifier and keeps verbose details collapsed", () => {
    renderFlow();
    const [first] = screen.getAllByTestId("chain-step");
    const classifier = classifierMap[chain.steps[0].classifier];
    expect(within(first).getByRole("link", { name: classifier.name })).toHaveAttribute(
      "href",
      `/classifiers/${classifier.slug}`
    );
    const details = first.querySelector("details")!;
    expect(details.open).toBe(false);
    expect(within(details).getByText(classifier.question.instructions)).toBeInTheDocument();
  });

  it("keeps manual review branches visible", () => {
    renderFlow();
    const humanEnds = chain.terminals.filter((t) => t.kind === "human").map((t) => t.label);
    expect(humanEnds.length).toBeGreaterThan(0);
    const steps = screen.getAllByTestId("chain-step");
    const branchText = steps.map((s) => s.querySelector("ul")!.textContent).join(" ");
    for (const label of humanEnds) expect(branchText).toContain(label);
  });
});

describe("ChainFlow across the catalog", () => {
  it("opens every scenario of every chain from its deep link", () => {
    for (const each of getChains()) {
      for (const scenario of each.scenarios) {
        window.history.replaceState(null, "", `/classifiers/chains/${each.slug}?scenario=${scenario.id}`);
        const { unmount } = render(<ChainFlow chain={each} classifiers={classifierMap} chainNames={chainNames} />);
        const label = `${each.slug}?scenario=${scenario.id}`;
        expect(screen.queryByTestId("scenario-path"), label).not.toBeNull();
        expect(document.querySelectorAll("[data-taken]").length, label).toBe(scenario.path.length);
        const reached = document.querySelectorAll("[data-reached]");
        expect(reached.length, label).toBe(1);
        expect(reached[0].closest("li"), label).toHaveAttribute("id", `end-${scenario.terminal}`);
        unmount();
      }
    }
  });

  it("links every handoff endpoint to its chain", () => {
    for (const each of getChains()) {
      const handoffs = each.terminals.filter((t) => t.kind === "handoff");
      if (handoffs.length === 0) continue;
      const { unmount } = render(<ChainFlow chain={each} classifiers={classifierMap} chainNames={chainNames} />);
      const overview = screen.getByTestId("chain-overview");
      for (const t of handoffs) {
        expect(within(overview).getByRole("link", { name: t.label }), `${each.slug}/${t.id}`).toHaveAttribute(
          "href",
          `/classifiers/chains/${t.handoffChain}`
        );
      }
      unmount();
    }
  });
});
