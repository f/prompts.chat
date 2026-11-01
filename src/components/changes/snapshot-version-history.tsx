"use client";

import { useState, type ReactNode } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Eye, GitCompare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatDistanceToNow } from "@/lib/date";

export interface SnapshotVersion<T> {
  id: string;
  version: number;
  changeNote: string | null;
  createdAt: Date | string;
  authorUsername: string | null;
  snapshot: T;
}

interface SnapshotVersionHistoryProps<T> {
  /** Newest first; the first one is the current version */
  versions: SnapshotVersion<T>[];
  /** The live record, compared against when it differs from the newest version */
  current: T;
  renderDiff: (original: T, modified: T, options: { showUnchanged: boolean }) => ReactNode;
}

const CURRENT = "current";

/** Version list with "view this version" and "compare versions", the same layout as the prompt versions tab */
export function SnapshotVersionHistory<T>({ versions, current, renderDiff }: SnapshotVersionHistoryProps<T>) {
  const t = useTranslations("prompts");
  const tChanges = useTranslations("changeRequests");
  const locale = useLocale();
  const [viewing, setViewing] = useState<SnapshotVersion<T> | null>(null);
  const [comparing, setComparing] = useState(false);
  const [versionA, setVersionA] = useState<string>(versions[1]?.id ?? versions[0]?.id ?? CURRENT);
  const [versionB, setVersionB] = useState<string>(CURRENT);

  if (versions.length === 0) {
    return <p className="text-muted-foreground py-8 text-center">{t("noVersions")}</p>;
  }

  const snapshotOf = (id: string) => (id === CURRENT ? current : versions.find((v) => v.id === id)?.snapshot ?? current);
  const labelOf = (id: string) => {
    if (id === CURRENT) return t("currentVersion");
    return `${t("version")} ${versions.find((v) => v.id === id)?.version ?? ""}`;
  };
  const previousOf = (version: SnapshotVersion<T>) => versions[versions.indexOf(version) + 1] ?? null;

  return (
    <div>
      <div className="flex items-center justify-end mb-3">
        {versions.length > 1 && (
          <Button variant="outline" size="sm" onClick={() => setComparing(true)}>
            <GitCompare className="h-4 w-4 mr-1.5" />
            {t("compareVersions")}
          </Button>
        )}
      </div>
      <div className="divide-y border rounded-lg">
        {versions.map((version, index) => {
          const isLatest = index === 0;
          return (
            <div key={version.id} className="px-4 py-3 flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium">v{version.version}</span>
                  {isLatest && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary font-medium">{t("currentVersion")}</span>
                  )}
                  <span className="text-xs text-muted-foreground">{formatDistanceToNow(version.createdAt, locale)}</span>
                  {version.authorUsername && <span className="text-xs text-muted-foreground">@{version.authorUsername}</span>}
                </div>
                {version.changeNote && <p className="text-xs text-muted-foreground mt-0.5 truncate">{version.changeNote}</p>}
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setViewing(version)} title={tChanges("viewVersion")}>
                  <Eye className="h-3.5 w-3.5" />
                  <span className="sr-only">{tChanges("viewVersion")}</span>
                </Button>
                {!isLatest && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => {
                      setVersionA(version.id);
                      setVersionB(CURRENT);
                      setComparing(true);
                    }}
                    title={t("compareWithCurrent")}
                  >
                    <GitCompare className="h-3.5 w-3.5" />
                    <span className="sr-only">{t("compareWithCurrent")}</span>
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <Dialog open={!!viewing} onOpenChange={(open) => !open && setViewing(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>
              {t("version")} {viewing?.version}
            </DialogTitle>
            {viewing && (
              <p className="text-sm text-muted-foreground">
                {previousOf(viewing) ? tChanges("viewVersionHint", { previous: previousOf(viewing)!.version }) : tChanges("viewFirstVersionHint")}
              </p>
            )}
          </DialogHeader>
          <div className="flex-1 min-h-0 overflow-y-auto">
            {viewing && renderDiff(previousOf(viewing)?.snapshot ?? viewing.snapshot, viewing.snapshot, { showUnchanged: true })}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={comparing} onOpenChange={setComparing}>
        <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>{t("compareVersions")}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4">
            {[
              { value: versionA, onChange: setVersionA, label: t("compareFrom") },
              { value: versionB, onChange: setVersionB, label: t("compareTo") },
            ].map((select) => (
              <div key={select.label} className="space-y-1.5">
                <Label className="text-xs">{select.label}</Label>
                <Select value={select.value} onValueChange={select.onChange}>
                  <SelectTrigger className="h-9">
                    <SelectValue>{labelOf(select.value)}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={CURRENT}>{t("currentVersion")}</SelectItem>
                    {versions.map((version) => (
                      <SelectItem key={version.id} value={version.id}>
                        {t("version")} {version.version}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ))}
          </div>
          <p className="text-sm text-muted-foreground">
            {labelOf(versionA)} → {labelOf(versionB)}
          </p>
          <div className="flex-1 min-h-0 overflow-y-auto">
            {renderDiff(snapshotOf(versionA), snapshotOf(versionB), { showUnchanged: false })}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
