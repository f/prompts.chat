"use client";

import { useTranslations } from "next-intl";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  JEV_ENDPOINT,
  JEV_MODEL,
  KEV_LOCAL_ENDPOINT,
  KEV_MODEL,
  buildSystemOneRequest,
  type ClassifierDefinition,
} from "@/lib/classifiers";
import { CopyTextButton } from "./copy-text-button";

export function RequestSnippet({ classifier }: { classifier: ClassifierDefinition }) {
  const t = useTranslations("classifiers");
  const targets = [
    { id: "jev", label: t("hostedJev"), endpoint: JEV_ENDPOINT, model: JEV_MODEL },
    { id: "kev", label: t("selfHostedKev"), endpoint: KEV_LOCAL_ENDPOINT, model: KEV_MODEL },
  ];

  return (
    <Tabs defaultValue="jev" className="gap-3">
      <TabsList>
        {targets.map((target) => (
          <TabsTrigger key={target.id} value={target.id} className="text-xs">
            {target.label}
          </TabsTrigger>
        ))}
      </TabsList>
      {targets.map((target) => {
        const body = JSON.stringify(buildSystemOneRequest(classifier, { model: target.model }), null, 2);
        return (
          <TabsContent key={target.id} value={target.id} className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs break-all">POST {target.endpoint}</code>
              <CopyTextButton label={t("copyRequest")} text={body} variant="ghost" />
            </div>
            <pre className="max-h-96 overflow-auto rounded-[var(--radius)] border bg-muted/40 p-3 font-mono text-xs leading-relaxed">
              {body}
            </pre>
          </TabsContent>
        );
      })}
      <p className="text-xs text-muted-foreground">{t("requestSnippetNote")}</p>
    </Tabs>
  );
}
