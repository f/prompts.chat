import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { ClassifierCatalog } from "@/components/classifiers/classifier-catalog";
import { ScenarioExplorer } from "@/components/classifiers/scenario-explorer";
import { ChainFlow } from "@/components/classifiers/chain-flow";
import { getChain, getChains, getClassifier, getClassifiers } from "@/lib/classifiers";

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

  it("filters by category and syncs the URL", () => {
    renderCatalog();
    const button = screen.getByRole("button", { name: "categories.security" });
    fireEvent.click(button);
    expect(button).toHaveAttribute("aria-pressed", "true");
    const cards = screen.getAllByTestId("classifier-card");
    expect(cards).toHaveLength(getClassifiers().filter((c) => c.category === "security").length);
    expect(window.location.search).toContain("category=security");
  });

  it("searches and recovers from no results", () => {
    renderCatalog();
    const input = screen.getByRole("searchbox");
    fireEvent.change(input, { target: { value: "groundedness" } });
    expect(screen.getAllByTestId("classifier-card").length).toBeGreaterThan(0);
    expect(window.location.search).toContain("q=groundedness");

    fireEvent.change(input, { target: { value: "zzzz-no-match" } });
    expect(screen.queryByTestId("classifier-card")).toBeNull();
    expect(screen.getByText("noResults")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "clearFilters" }));
    expect(screen.getAllByTestId("classifier-card")).toHaveLength(getClassifiers().length);
  });
});

describe("ScenarioExplorer", () => {
  it("switches between predefined scenarios", () => {
    const classifier = getClassifier("support-ticket-routing")!;
    render(<ScenarioExplorer classifier={classifier} />);
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
