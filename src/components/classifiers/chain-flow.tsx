"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { ArrowRight, ChevronRight, CornerDownRight, ListTree } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  getScenarioHighlight,
  type ChainStep,
  type ChainTerminal,
  type ClassifierChain,
  type ClassifierDefinition,
} from "@/lib/classifiers";
import { IllustrativeBadge, OutcomeChip, QuestionTypeBadge } from "./classifier-badges";
import { Disclosure } from "./disclosure";
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
  const outcomeOf = (step: ChainStep | undefined, id: string) =>
    step ? classifiers[step.classifier]?.outcomes.find((o) => o.id === id) : undefined;

  return (
    <div className="space-y-6">
      <section
        aria-labelledby="scenario-paths-heading"
        className="overflow-hidden rounded-[var(--radius)] border bg-card"
        data-testid="chain-overview"
      >
        <div className="space-y-3 p-3 sm:p-4">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <h2 id="scenario-paths-heading" className="text-sm font-semibold">
              {t("scenarioPaths")}
            </h2>
            <p className="text-xs text-muted-foreground">{t("scenarioPathsNote")}</p>
          </div>
          <select
            value={scenarioId ?? ""}
            onChange={(e) => selectScenario(e.target.value || null)}
            aria-label={t("scenarioPaths")}
            className="h-9 w-full rounded-[var(--radius)] border bg-background px-2.5 text-sm shadow-xs focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none sm:hidden"
          >
            <option value="">{t("allBranches")}</option>
            {chain.scenarios.map((s) => (
              <option key={s.id} value={s.id}>
                {s.title}
              </option>
            ))}
          </select>
          <div className="hidden flex-wrap gap-1.5 sm:flex" role="group" aria-label={t("scenarioPaths")}>
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

          <dl className="grid gap-x-3 gap-y-2 border-t pt-3 text-xs sm:grid-cols-[auto_minmax(0,1fr)] sm:items-start">
            <dt className="pt-1 font-medium text-muted-foreground">{t("steps")}</dt>
            <dd>
              <ol className="flex flex-wrap items-center gap-1">
                {chain.steps.map((step, index) => {
                  const onPath = highlight?.steps.has(step.id) ?? false;
                  return (
                    <Fragment key={step.id}>
                      {index > 0 && <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/60" aria-hidden />}
                      <li>
                        <a
                          href={`#step-${step.id}`}
                          className={cn(
                            "inline-flex items-center gap-1.5 rounded-[var(--radius)] border px-2 py-1 font-medium hover:bg-accent",
                            onPath && "border-primary/50 bg-primary/10",
                            highlight && !onPath && "opacity-50"
                          )}
                        >
                          <StepNumber number={index + 1} active={onPath} small />
                          {stepName(step.id)}
                        </a>
                      </li>
                    </Fragment>
                  );
                })}
              </ol>
            </dd>
            <dt className="pt-1 font-medium text-muted-foreground">{t("endpoints")}</dt>
            <dd>
              <ul className="flex flex-wrap gap-1">
                {chain.terminals.map((end) => (
                  <li key={end.id} id={`end-${end.id}`} className="scroll-mt-20">
                    <TerminalTag
                      terminal={end}
                      reached={highlight?.terminal === end.id}
                      dimmed={Boolean(highlight) && highlight?.terminal !== end.id}
                      title={
                        end.handoffChain
                          ? t("continuesIn", { chain: chainNames[end.handoffChain] ?? end.handoffChain })
                          : `${t(`terminalKinds.${end.kind}`)}: ${end.description}`
                      }
                    />
                  </li>
                ))}
              </ul>
              <Disclosure summary={t("endpointDetails")} className="mt-2" contentClassName="mt-2">
                <ul className="grid gap-x-4 gap-y-2 sm:grid-cols-2">
                  {chain.terminals.map((end) => (
                    <li key={end.id} className="space-y-0.5">
                      <p className="font-medium">
                        {end.label}{" "}
                        <span className={cn("font-normal", TERMINAL_KIND_TEXT[end.kind])}>
                          · {t(`terminalKinds.${end.kind}`)}
                        </span>
                      </p>
                      <p className="text-muted-foreground">{end.description}</p>
                      {end.handoffChain && (
                        <Link
                          href={`/classifiers/chains/${end.handoffChain}`}
                          className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
                        >
                          {t("continuesIn", { chain: chainNames[end.handoffChain] ?? end.handoffChain })}
                          <ArrowRight className="h-3 w-3" />
                        </Link>
                      )}
                    </li>
                  ))}
                </ul>
              </Disclosure>
            </dd>
          </dl>
        </div>

        {scenario && highlight && (
          <div className="space-y-2 border-t border-primary/30 bg-primary/5 p-3 sm:p-4" data-testid="scenario-path">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-semibold">{scenario.title}</h3>
              <IllustrativeBadge />
            </div>
            <p className="text-sm text-muted-foreground">{scenario.summary}</p>
            <ol className="flex flex-wrap items-center gap-1.5" aria-label={scenario.title}>
              {scenario.path.map((p) => {
                const outcome = outcomeOf(chain.steps.find((s) => s.id === p.step), p.outcome);
                return (
                  <li key={p.step} className="inline-flex items-center gap-1.5">
                    <a href={`#step-${p.step}`} title={stepName(p.step)} className="inline-flex items-center gap-1">
                      <StepNumber number={stepNumbers[p.step]} active small />
                      <span className="sr-only">{stepName(p.step)}</span>
                      {outcome && <OutcomeChip outcome={outcome} />}
                    </a>
                    <ArrowRight className="h-3.5 w-3.5 text-primary" aria-hidden />
                  </li>
                );
              })}
              <li>
                <span className="sr-only">{t("endsAt")} </span>
                {terminal(scenario.terminal) && <TerminalPill terminal={terminal(scenario.terminal)!} />}
              </li>
            </ol>
            <Disclosure summary={t("pathDetails")} contentClassName="mt-2 space-y-2">
              <ol className="space-y-1 text-xs">
                {scenario.path.map((p) => (
                  <li key={p.step}>
                    <span className="font-medium">
                      {t("stepLabel", { number: stepNumbers[p.step] })} · {stepName(p.step)}:
                    </span>{" "}
                    <span className="text-muted-foreground">{p.note}</span>
                  </li>
                ))}
              </ol>
              <StateView state={scenario.input} className="bg-background" />
            </Disclosure>
          </div>
        )}
      </section>

      <section aria-labelledby="steps-heading" className="space-y-2">
        <h2 id="steps-heading" className="text-sm font-semibold">
          {t("steps")}
        </h2>
        <ol className="space-y-2">
          {chain.steps.map((step, index) => {
            const classifier = classifiers[step.classifier];
            const onPath = highlight?.steps.has(step.id) ?? false;
            const chosenOutcome = highlight?.outcomes.get(step.id);
            const notes = step.branches.filter((b) => b.note);
            return (
              <li
                key={step.id}
                id={`step-${step.id}`}
                data-testid="chain-step"
                className={cn(
                  "scroll-mt-20 rounded-[var(--radius)] border bg-card transition-opacity",
                  onPath && "border-primary/50 shadow-sm",
                  highlight && !onPath && "opacity-60"
                )}
              >
                <div className="grid gap-3 p-3 md:grid-cols-[minmax(0,16rem)_minmax(0,1fr)] md:gap-5">
                  <div className="flex min-w-0 gap-2.5">
                    <StepNumber number={index + 1} active={onPath} />
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Link href={`/classifiers/${step.classifier}`} className="text-sm font-semibold hover:underline">
                          {classifier?.name ?? step.classifier}
                        </Link>
                        {classifier && <QuestionTypeBadge type={classifier.question.type} />}
                        {step.id === chain.entry && (
                          <span className="text-xs font-medium text-primary">{t("entry")}</span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">{step.purpose}</p>
                    </div>
                  </div>

                  <ul className="space-y-1" aria-label={t("branches")}>
                    {step.branches.map((branch) => {
                      const taken = highlight?.edges.has(`${step.id}->${branch.to}`) ?? false;
                      const target = chain.steps.find((s) => s.id === branch.to);
                      const end = terminal(branch.to);
                      return (
                        <li
                          key={branch.to + branch.outcomes.join()}
                          className={cn(
                            "flex flex-wrap items-center gap-1.5 rounded-[var(--radius)] px-1.5 py-1",
                            taken && "bg-primary/10",
                            onPath && !taken && "opacity-50"
                          )}
                          data-taken={taken || undefined}
                        >
                          {branch.outcomes.map((id) => {
                            const outcome = classifier?.outcomes.find((o) => o.id === id);
                            return outcome ? (
                              <OutcomeChip key={id} outcome={outcome} emphasized={chosenOutcome === id} />
                            ) : null;
                          })}
                          <ArrowRight
                            className={cn("h-3.5 w-3.5 shrink-0", taken ? "text-primary" : "text-muted-foreground")}
                            aria-hidden
                          />
                          {target ? (
                            <a
                              href={`#step-${target.id}`}
                              className="inline-flex min-w-0 items-center gap-1.5 text-sm font-medium hover:underline"
                            >
                              <StepNumber number={stepNumbers[target.id]} active={taken} small />
                              {stepName(target.id)}
                            </a>
                          ) : end ? (
                            <TerminalPill terminal={end} />
                          ) : null}
                        </li>
                      );
                    })}
                  </ul>
                </div>

                <Disclosure
                  summary={t("stepDetails")}
                  className="border-t"
                  summaryClassName="px-3 py-2"
                  contentClassName="space-y-3 px-3 pb-3 text-xs"
                >
                  {classifier && (
                    <p className="rounded-[var(--radius)] bg-muted/50 px-2.5 py-2 text-sm">
                      <span className="mr-1 text-xs font-medium text-muted-foreground">{t("asks")}</span>
                      {classifier.question.instructions}
                    </p>
                  )}
                  <div className="space-y-1.5">
                    <h3 className="font-medium text-muted-foreground">{t("receives")}</h3>
                    <ul className="flex flex-wrap gap-1.5">
                      {step.receives.map((input, i) => (
                        <li key={i}>
                          {input.from === "input" ? (
                            <span className="inline-flex items-center gap-1 rounded-[var(--radius)] border bg-muted/40 px-2 py-0.5">
                              <span className="text-muted-foreground">{t("fromInput")}</span>
                              <span className="font-mono">{input.value}</span>
                            </span>
                          ) : (
                            <a
                              href={`#step-${input.from}`}
                              className="inline-flex items-center gap-1 rounded-[var(--radius)] border border-primary/30 bg-primary/5 px-2 py-0.5 hover:bg-primary/10"
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
                  {notes.length > 0 && (
                    <div className="space-y-1.5">
                      <h3 className="font-medium text-muted-foreground">{t("branches")}</h3>
                      <ul className="space-y-1">
                        {notes.map((branch) => (
                          <li key={branch.to + branch.outcomes.join()} className="text-muted-foreground">
                            <span className="font-medium text-foreground">
                              {branch.outcomes
                                .map((id) => classifier?.outcomes.find((o) => o.id === id)?.label ?? id)
                                .join(", ")}
                              :
                            </span>{" "}
                            {branch.note}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </Disclosure>
              </li>
            );
          })}
        </ol>
      </section>
    </div>
  );
}

function StepNumber({ number, active, small = false }: { number: number; active: boolean; small?: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full border font-semibold tabular-nums",
        small ? "h-4 min-w-4 px-1 text-[10px]" : "h-6 w-6 text-xs",
        active ? "border-primary bg-primary text-primary-foreground" : "bg-background text-muted-foreground"
      )}
      aria-hidden
    >
      {number}
    </span>
  );
}

function TerminalTag({
  terminal,
  reached,
  dimmed,
  title,
}: {
  terminal: ChainTerminal;
  reached: boolean;
  dimmed: boolean;
  title: string;
}) {
  const Icon = TERMINAL_KIND_ICONS[terminal.kind];
  const className = cn(
    "inline-flex items-center gap-1 rounded-[var(--radius)] border px-1.5 py-0.5",
    TERMINAL_KIND_CLASSES[terminal.kind],
    reached && "ring-2 ring-primary",
    dimmed && "opacity-50"
  );
  const content = (
    <>
      <Icon className={cn("h-3 w-3 shrink-0", TERMINAL_KIND_TEXT[terminal.kind])} aria-hidden />
      {terminal.label}
    </>
  );
  if (terminal.handoffChain) {
    return (
      <Link
        href={`/classifiers/chains/${terminal.handoffChain}`}
        title={title}
        className={cn(className, "font-medium hover:underline")}
        data-reached={reached || undefined}
      >
        {content}
        <ArrowRight className="h-3 w-3 shrink-0 text-primary" aria-hidden />
      </Link>
    );
  }
  return (
    <span title={title} className={className} data-reached={reached || undefined}>
      {content}
    </span>
  );
}

function TerminalPill({ terminal }: { terminal: ChainTerminal }) {
  const Icon = TERMINAL_KIND_ICONS[terminal.kind];
  return (
    <a
      href={`#end-${terminal.id}`}
      className={cn(
        "inline-flex max-w-full items-center gap-1.5 rounded-[var(--radius)] border px-2 py-0.5 text-xs font-medium hover:underline",
        TERMINAL_KIND_CLASSES[terminal.kind]
      )}
    >
      <Icon className={cn("h-3.5 w-3.5 shrink-0", TERMINAL_KIND_TEXT[terminal.kind])} aria-hidden />
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
        "inline-flex items-center gap-1.5 rounded-[var(--radius)] border px-2.5 py-1 text-left text-xs font-medium transition-colors",
        active ? "border-primary bg-primary/10 text-foreground" : "text-muted-foreground hover:bg-accent hover:text-foreground"
      )}
    >
      {children}
    </button>
  );
}
