"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { REFERENCES, type ClassifierDefinition } from "@/lib/classifiers";
import { IllustrativeBadge, OutcomeChip } from "./classifier-badges";
import { StateView } from "./state-view";

export function ScenarioExplorer({ classifier }: { classifier: ClassifierDefinition }) {
  const t = useTranslations("classifiers");
  const [selectedId, setSelectedId] = useState(classifier.scenarios[0]?.id);
  const scenario = classifier.scenarios.find((s) => s.id === selectedId) ?? classifier.scenarios[0];
  if (!scenario) return null;
  const outcome = classifier.outcomes.find((o) => o.id === scenario.outcome);
  const source = scenario.adaptedFrom ? REFERENCES[scenario.adaptedFrom] : undefined;

  return (
    <div className="space-y-3">
      <p className="flex items-start gap-2 text-xs text-muted-foreground">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        {t("scenariosNote")}
      </p>
      <div className="flex flex-wrap gap-1.5" role="tablist" aria-label={t("scenarios")}>
        {classifier.scenarios.map((s) => (
          <button
            key={s.id}
            type="button"
            role="tab"
            aria-selected={s.id === scenario.id}
            onClick={() => setSelectedId(s.id)}
            className={cn(
              "rounded-[var(--radius)] border px-2.5 py-1 text-xs font-medium transition-colors text-left",
              s.id === scenario.id
                ? "border-primary bg-primary/10 text-foreground"
                : "text-muted-foreground hover:bg-accent hover:text-foreground"
            )}
          >
            {s.title}
          </button>
        ))}
      </div>

      <div role="tabpanel" className="grid gap-4 rounded-[var(--radius)] border p-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.8fr)]">
        <div className="space-y-2 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{t("exampleState")}</h3>
            {source && (
              <a
                href={source.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-muted-foreground underline-offset-2 hover:underline"
              >
                {t("adaptedFrom", { source: source.title })}
              </a>
            )}
          </div>
          <StateView state={scenario.state} />
        </div>
        <div className="space-y-3 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{t("illustrativeOutcome")}</h3>
            <IllustrativeBadge />
          </div>
          {outcome && (
            <div className="space-y-1.5" data-testid="scenario-outcome">
              <OutcomeChip outcome={outcome} emphasized />
              <p className="text-xs text-muted-foreground">{outcome.when}</p>
            </div>
          )}
          <div>
            <h4 className="text-xs font-medium text-muted-foreground">{t("why")}</h4>
            <p className="text-sm">{scenario.rationale}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
