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

  it("opens a scenario from the URL", () => {
    window.history.replaceState(null, "", "/classifiers/chains/support-inbox-triage?scenario=recruiter");
    renderFlow();
    expect(screen.getByTestId("scenario-path")).toBeInTheDocument();
    expect(document.querySelectorAll("[data-taken]")).toHaveLength(1);
  });

  it("links the handoff to the refund chain", () => {
    renderFlow();
    const link = screen.getByRole("link", { name: /continuesIn/ });
    expect(link).toHaveAttribute("href", "/classifiers/chains/refund-request-resolution");
  });
});
