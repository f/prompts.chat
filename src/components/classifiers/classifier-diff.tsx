"use client";

import { useTranslations } from "next-intl";
import { FieldDiffList } from "@/components/changes/field-diff-list";
import {
  CLASSIFIER_LIST_FIELDS,
  CLASSIFIER_TEXT_FIELDS,
  classifierSnapshotItems,
  classifierSnapshotTexts,
  type ClassifierFields,
  type ClassifierListField,
  type ClassifierTextField,
} from "@/lib/classifiers/change-snapshot";

/**
 * Fields shown as chips. Inputs, options, outcomes and scenarios carry text behind each key, so
 * they are shown as a line diff instead, where a changed description is visible.
 */
const CHIP_FIELDS: readonly ClassifierListField[] = CLASSIFIER_LIST_FIELDS.filter(
  (field) => !["input", "options", "outcomes", "scenarios"].includes(field)
);

function isChipField(field: ClassifierTextField): field is ClassifierListField {
  return (CHIP_FIELDS as readonly string[]).includes(field);
}

export interface ClassifierDiffSide {
  title: string;
  /** Null when a stored version or change request has no valid classifier fields */
  fields: ClassifierFields | null;
}

interface ClassifierDiffProps {
  original: ClassifierDiffSide;
  modified: ClassifierDiffSide;
  /** Also list fields that did not change, e.g. to show a whole version */
  showUnchanged?: boolean;
}

/** A classifier change field by field: title, summary, category, …, outcomes, scenarios, sources */
export function ClassifierDiff({ original, modified, showUnchanged = false }: ClassifierDiffProps) {
  const t = useTranslations("changeRequests");
  const before = classifierSnapshotTexts(original);
  const after = classifierSnapshotTexts(modified);
  const beforeItems = classifierSnapshotItems(original.fields);
  const afterItems = classifierSnapshotItems(modified.fields);
  const fields = CLASSIFIER_TEXT_FIELDS.filter((field) => before[field] !== undefined && after[field] !== undefined).map((field) => ({
    key: field,
    label: t(`classifierFields.${field}`),
    original: before[field]!,
    modified: after[field]!,
    items: beforeItems && afterItems && isChipField(field) ? { original: beforeItems[field], modified: afterItems[field] } : undefined,
  }));
  const hasChanges = fields.some((field) => field.original !== field.modified);

  if (!hasChanges && !showUnchanged) {
    return <p className="rounded-lg border bg-muted/30 p-4 text-sm text-muted-foreground">{t("noFieldChanges")}</p>;
  }
  return <FieldDiffList fields={fields} showUnchanged={showUnchanged} />;
}
