"use client";

import { useTranslations } from "next-intl";
import { Minus, Pencil, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { DiffView } from "@/components/ui/diff-view";
import { FieldDiffList } from "@/components/changes/field-diff-list";
import { cn } from "@/lib/utils";
import { TEAM_TEXT_FIELDS, diffTeamSnapshots, teamSnapshotTexts, type TeamMemberChangeKind, type TeamSnapshot } from "@/lib/bots/team-snapshot";

interface TeamDiffProps {
  original: TeamSnapshot;
  modified: TeamSnapshot;
  /** Also list fields and members that did not change, e.g. to show a whole version */
  showUnchanged?: boolean;
}

const KIND_STYLES: Record<TeamMemberChangeKind, string> = {
  added: "bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20",
  removed: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20",
  changed: "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/20",
  unchanged: "",
};

const KIND_ICONS = { added: Plus, removed: Minus, changed: Pencil, unchanged: null } as const;

/**
 * A team change: word diffs of the title, description, category, tags and handoffs, then every
 * added, removed and changed member with word diffs of its role and description
 */
export function TeamDiff({ original, modified, showUnchanged = false }: TeamDiffProps) {
  const t = useTranslations("changeRequests");
  const diff = diffTeamSnapshots(original, modified);
  const before = teamSnapshotTexts(original);
  const after = teamSnapshotTexts(modified);
  const changedFields = new Set(diff.fields.map((field) => field.field));
  const fields = TEAM_TEXT_FIELDS.filter((field) => showUnchanged || changedFields.has(field)).map((field) => ({
    key: field,
    label: t(`teamFields.${field}`),
    original: before[field],
    modified: changedFields.has(field) ? after[field] : before[field],
  }));
  const members = diff.members.filter((member) => showUnchanged || member.kind !== "unchanged");
  const kept = new Set(modified.members.map((m) => m.botId));
  const keptOrderBefore = original.members.filter((m) => kept.has(m.botId)).map((m) => m.botId);
  const keptIds = new Set(keptOrderBefore);
  const keptOrderAfter = modified.members.filter((m) => keptIds.has(m.botId)).map((m) => m.botId);
  const reordered = keptOrderBefore.join(">") !== keptOrderAfter.join(">");

  if (!diff.hasChanges && !showUnchanged) {
    return <p className="rounded-lg border bg-muted/30 p-4 text-sm text-muted-foreground">{t("noFieldChanges")}</p>;
  }

  return (
    <div className="space-y-6">
      <FieldDiffList fields={fields} showUnchanged={showUnchanged} />

      {(members.length > 0 || reordered) && (
        <div>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">{t("teamFields.members")}</p>
          {reordered && <p className="mb-2 text-sm text-muted-foreground">{t("membersReordered")}</p>}
          <ul className="divide-y rounded-lg border">
            {members.map((member) => {
              const Icon = KIND_ICONS[member.kind];
              const parts = [
                { key: "role", label: t("memberRole"), ...member.role },
                { key: "description", label: t("memberDescription"), ...member.description },
              ].filter((part) => (showUnchanged || member.kind !== "changed" ? part.original || part.modified : part.original !== part.modified));
              return (
                <li key={member.botId} className="space-y-3 p-3">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="min-w-0 truncate text-sm font-medium" title={member.title}>{member.title}</span>
                    {member.kind !== "unchanged" && (
                      <Badge variant="outline" className={cn("h-5 shrink-0 px-1.5 text-[10px]", KIND_STYLES[member.kind])}>
                        {Icon && <Icon className="h-3 w-3" />}
                        {t(`member.${member.kind}`)}
                      </Badge>
                    )}
                  </div>
                  {parts.map((part) => (
                    <div key={part.key}>
                      <p className="mb-1 text-xs text-muted-foreground">{part.label}</p>
                      <DiffView original={part.original} modified={part.modified} />
                    </div>
                  ))}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
