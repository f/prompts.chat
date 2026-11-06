"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { ArrowRight, CornerDownRight, Info, ListTree } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  getScenarioHighlight,
  type ChainTerminal,
  type ClassifierChain,
  type ClassifierDefinition,
} from "@/lib/classifiers";
import { IllustrativeBadge, OutcomeChip, QuestionTypeBadge } from "./classifier-badges";
import { StateView } from "./state-view";
import { TERMINAL_KIND_CLASSES, TERMINAL_KIND_ICONS, TERMINAL_KIND_TEXT } from "./classifier-styles";

interface ChainFlowProps {
  chain: ClassifierChain;
  classifiers: Record<string, ClassifierDefinition>;
  chainNames: Record<string, string>;
}

const SCENARIO_PARAM = "scenario";

export function ChainFlow({ chain, classifiers, chainNames }: ChainFlowProps) {
  const t = useTranslations("classifiers");
  const [scenarioId, setScenarioId] = useState<string | null>(null);

  // Allow linking straight to a scenario path.
  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get(SCENARIO_PARAM);
    if (requested && chain.scenarios.some((s) => s.id === requested)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reading the URL is only possible after mount
      setScenarioId(requested);
    }
  }, [chain.scenarios]);

  const selectScenario = (id: string | null) => {
    setScenarioId(id);
    const url = new URL(window.location.href);
    if (id) url.searchParams.set(SCENARIO_PARAM, id);
    else url.searchParams.delete(SCENARIO_PARAM);
    window.history.replaceState(window.history.state, "", url.toString());
  };

  const scenario = chain.scenarios.find((s) => s.id === scenarioId);
  const highlight = useMemo(
    () => (scenarioId ? getScenarioHighlight(chain, scenarioId) : undefined),
    [chain, scenarioId]
  );

  const stepNumbers = useMemo(
    () => Object.fromEntries(chain.steps.map((s, i) => [s.id, i + 1])),
    [chain.steps]
  );
  const stepName = (stepId: string) => {
    const step = chain.steps.find((s) => s.id === stepId);
    return step ? classifiers[step.classifier]?.name ?? step.classifier : stepId;
  };
  const terminal = (id: string) => chain.terminals.find((x) => x.id === id);

  return (
    <div className="space-y-8">
      <section aria-labelledby="scenario-paths-heading" className="space-y-3">
        <div className="space-y-1">
          <h2 id="scenario-paths-heading" className="text-base font-semibold">
            {t("scenarioPaths")}
          </h2>
          <p className="flex items-start gap-2 text-xs text-muted-foreground">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            {t("scenarioPathsNote")}
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label={t("scenarioPaths")}>
          <PathButton active={scenarioId === null} onClick={() => selectScenario(null)}>
            <ListTree className="h-3.5 w-3.5" />
            {t("allBranches")}
          </PathButton>
          {chain.scenarios.map((s) => (
            <PathButton key={s.id} active={s.id === scenarioId} onClick={() => selectScenario(s.id)}>
              {s.title}
            </PathButton>
          ))}
        </div>

        {scenario && highlight && (
          <div className="space-y-4 rounded-[var(--radius)] border border-primary/40 bg-primary/5 p-4" data-testid="scenario-path">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-semibold">{scenario.title}</h3>
              <IllustrativeBadge />
            </div>
            <p className="text-sm text-muted-foreground">{scenario.summary}</p>
            <ol className="space-y-2">
              {scenario.path.map((p) => {
                const step = chain.steps.find((s) => s.id === p.step);
                const outcome = step && classifiers[step.classifier]?.outcomes.find((o) => o.id === p.outcome);
                return (
                  <li key={p.step} className="flex flex-col gap-1 sm:flex-row sm:items-start sm:gap-3">
                    <a href={`#step-${p.step}`} className="shrink-0 text-sm font-medium hover:underline sm:w-56">
                      {t("stepLabel", { number: stepNumbers[p.step] })} · {stepName(p.step)}
                    </a>
                    <div className="flex flex-wrap items-center gap-2">
                      {outcome && <OutcomeChip outcome={outcome} />}
                      <span className="text-xs text-muted-foreground">{p.note}</span>
                    </div>
                  </li>
                );
              })}
              <li className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-3">
                <span className="shrink-0 text-sm font-medium sm:w-56">{t("endsAt")}</span>
                {terminal(scenario.terminal) && <TerminalPill terminal={terminal(scenario.terminal)!} />}
              </li>
            </ol>
            <details className="group">
              <summary className="cursor-pointer text-xs font-medium text-muted-foreground hover:text-foreground">
                {t("scenarioInput")}
              </summary>
              <StateView state={scenario.input} className="mt-2 bg-background" />
            </details>
          </div>
        )}
      </section>

      <section aria-labelledby="steps-heading" className="space-y-3">
        <h2 id="steps-heading" className="text-base font-semibold">
          {t("steps")}
        </h2>
        <ol className="relative space-y-4">
          {chain.steps.map((step, index) => {
            const classifier = classifiers[step.classifier];
            const onPath = highlight?.steps.has(step.id) ?? false;
            const dimmed = Boolean(highlight) && !onPath;
            const chosenOutcome = highlight?.outcomes.get(step.id);
            return (
              <li key={step.id} id={`step-${step.id}`} className="relative scroll-mt-20 pl-11" data-testid="chain-step">
                {index < chain.steps.length - 1 && (
                  <span className="absolute left-[15px] top-9 -bottom-4 w-px bg-border" aria-hidden />
                )}
                <span
                  className={cn(
                    "absolute left-0 top-3 flex h-8 w-8 items-center justify-center rounded-full border text-xs font-semibold",
                    onPath ? "border-primary bg-primary text-primary-foreground" : "bg-background"
                  )}
                >
                  {index + 1}
                </span>
                <div
                  className={cn(
                    "space-y-4 rounded-[var(--radius)] border bg-card p-4 transition-opacity",
                    onPath && "border-primary/50 shadow-sm",
                    dimmed && "opacity-50"
                  )}
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link href={`/classifiers/${step.classifier}`} className="font-semibold hover:underline">
                          {classifier?.name ?? step.classifier}
                        </Link>
                        {classifier && <QuestionTypeBadge type={classifier.question.type} />}
                        {step.id === chain.entry && (
                          <span className="text-xs font-medium text-primary">{t("entry")}</span>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">{step.purpose}</p>
                    </div>
                  </div>

                  {classifier && (
                    <p className="rounded-[var(--radius)] bg-muted/50 px-3 py-2 text-sm">
                      <span className="mr-1 text-xs font-medium text-muted-foreground">{t("asks")}</span>
                      {classifier.question.instructions}
                    </p>
                  )}

                  <div className="space-y-1.5">
                    <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{t("receives")}</h3>
                    <ul className="flex flex-wrap gap-1.5">
                      {step.receives.map((input, i) => (
                        <li key={i}>
                          {input.from === "input" ? (
                            <span className="inline-flex items-center gap-1 rounded-[var(--radius)] border bg-muted/40 px-2 py-0.5 text-xs">
                              <span className="text-muted-foreground">{t("fromInput")}</span>
                              <span className="font-mono">{input.value}</span>
                            </span>
                          ) : (
                            <a
                              href={`#step-${input.from}`}
                              className="inline-flex items-center gap-1 rounded-[var(--radius)] border border-primary/30 bg-primary/5 px-2 py-0.5 text-xs hover:bg-primary/10"
                            >
                              <CornerDownRight className="h-3 w-3 text-primary" />
                              <span className="text-muted-foreground">
                                {t("fromStep", { number: stepNumbers[input.from] })}
                              </span>
                              <span>{input.value}</span>
                            </a>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="space-y-1.5">
                    <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{t("branches")}</h3>
                    <ul className="divide-y rounded-[var(--radius)] border">
                      {step.branches.map((branch) => {
                        const taken = highlight?.edges.has(`${step.id}->${branch.to}`) ?? false;
                        const target = chain.steps.find((s) => s.id === branch.to);
                        const end = terminal(branch.to);
                        return (
                          <li
                            key={branch.to + branch.outcomes.join()}
                            className={cn(
                              "grid gap-2 p-2.5 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] sm:items-center",
                              taken && "bg-primary/10",
                              onPath && !taken && "opacity-50"
                            )}
                            data-taken={taken || undefined}
                          >
                            <div className="flex flex-wrap gap-1.5">
                              {branch.outcomes.map((id) => {
                                const outcome = classifier?.outcomes.find((o) => o.id === id);
                                return outcome ? (
                                  <OutcomeChip key={id} outcome={outcome} emphasized={chosenOutcome === id} />
                                ) : null;
                              })}
                            </div>
                            <ArrowRight
                              className={cn("h-4 w-4 rotate-90 sm:rotate-0", taken ? "text-primary" : "text-muted-foreground")}
                              aria-hidden
                            />
                            <div className="min-w-0">
                              {target ? (
                                <a href={`#step-${target.id}`} className="text-sm font-medium hover:underline">
                                  {t("stepLabel", { number: stepNumbers[target.id] })} · {stepName(target.id)}
                                </a>
                              ) : end ? (
                                <TerminalPill terminal={end} />
                              ) : null}
                            </div>
                            {branch.note && (
                              <p className="text-xs text-muted-foreground sm:col-span-3">{branch.note}</p>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      </section>

      <section aria-labelledby="endpoints-heading" className="space-y-3">
        <div>
          <h2 id="endpoints-heading" className="text-base font-semibold">
            {t("endpoints")}
          </h2>
          <p className="text-sm text-muted-foreground">{t("endpointsDescription")}</p>
        </div>
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {chain.terminals.map((end) => {
            const Icon = TERMINAL_KIND_ICONS[end.kind];
            const reached = highlight?.terminal === end.id;
            return (
              <li
                key={end.id}
                id={`end-${end.id}`}
                className={cn(
                  "scroll-mt-20 space-y-1.5 rounded-[var(--radius)] border p-3 transition-opacity",
                  TERMINAL_KIND_CLASSES[end.kind],
                  reached && "ring-2 ring-primary",
                  highlight && !reached && "opacity-50"
                )}
              >
                <div className="flex items-center gap-2">
                  <Icon className={cn("h-4 w-4", TERMINAL_KIND_TEXT[end.kind])} />
                  <span className="text-sm font-medium">{end.label}</span>
                </div>
                <p className={cn("text-xs font-medium", TERMINAL_KIND_TEXT[end.kind])}>{t(`terminalKinds.${end.kind}`)}</p>
                <p className="text-xs text-muted-foreground">{end.description}</p>
                {end.handoffChain && (
                  <Link
                    href={`/classifiers/chains/${end.handoffChain}`}
                    className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                  >
                    {t("continuesIn", { chain: chainNames[end.handoffChain] ?? end.handoffChain })}
                    <ArrowRight className="h-3 w-3" />
                  </Link>
                )}
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}

function TerminalPill({ terminal }: { terminal: ChainTerminal }) {
  const Icon = TERMINAL_KIND_ICONS[terminal.kind];
  return (
    <a
      href={`#end-${terminal.id}`}
      className={cn(
        "inline-flex max-w-full items-center gap-1.5 rounded-[var(--radius)] border px-2 py-0.5 text-sm font-medium hover:underline",
        TERMINAL_KIND_CLASSES[terminal.kind]
      )}
    >
      <Icon className={cn("h-3.5 w-3.5 shrink-0", TERMINAL_KIND_TEXT[terminal.kind])} />
      <span className="truncate">{terminal.label}</span>
    </a>
  );
}

function PathButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-[var(--radius)] border px-2.5 py-1 text-xs font-medium transition-colors text-left",
        active ? "border-primary bg-primary/10 text-foreground" : "text-muted-foreground hover:bg-accent hover:text-foreground"
      )}
    >
      {children}
    </button>
  );
}
