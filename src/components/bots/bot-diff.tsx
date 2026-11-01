"use client";

import { useTranslations } from "next-intl";
import { FieldDiffList } from "@/components/changes/field-diff-list";
import { BOT_TEXT_FIELDS, botSnapshotTexts, type BotFields } from "@/lib/bots/change-snapshot";

export interface BotDiffSide {
  /** Null on versions saved before bots had snapshots */
  title: string | null;
  instructions: string;
  /** Null on change requests and versions saved before bots had snapshots */
  fields: BotFields | null;
}

interface BotDiffProps {
  original: BotDiffSide;
  modified: BotDiffSide;
  /** Also list fields that did not change, e.g. to show a whole version */
  showUnchanged?: boolean;
}

function texts(side: BotDiffSide) {
  const result = botSnapshotTexts({ title: side.title ?? "", instructions: side.instructions, fields: side.fields });
  if (side.title === null) delete result.title;
  return result;
}

/** A bot change field by field: title, description, platforms, …, instructions, routines, skills, connectors */
export function BotDiff({ original, modified, showUnchanged = false }: BotDiffProps) {
  const t = useTranslations("changeRequests");
  const before = texts(original);
  const after = texts(modified);
  const fields = BOT_TEXT_FIELDS.filter((field) => before[field] !== undefined && after[field] !== undefined).map((field) => ({
    key: field,
    label: t(`botFields.${field}`),
    original: before[field]!,
    modified: after[field]!,
  }));
  const hasChanges = fields.some((field) => field.original !== field.modified);

  if (!hasChanges && !showUnchanged) {
    return <p className="rounded-lg border bg-muted/30 p-4 text-sm text-muted-foreground">{t("noFieldChanges")}</p>;
  }
  return <FieldDiffList fields={fields} showUnchanged={showUnchanged} />;
}
