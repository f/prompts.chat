"use client";

import { DiffView } from "@/components/ui/diff-view";
import { ChipListDiff } from "@/components/changes/chip-list-diff";
import type { DiffItem } from "@/lib/list-diff";

export interface FieldDiff {
  key: string;
  label: string;
  original: string;
  modified: string;
  /** Set for list-like fields (platforms, tags, skills, …) to diff them item by item */
  items?: { original: readonly DiffItem[]; modified: readonly DiffItem[] };
}

interface FieldDiffListProps {
  fields: FieldDiff[];
  /** Also list fields whose text did not change, e.g. to show a whole version */
  showUnchanged?: boolean;
}

/** One diff per field, with the same diff viewer and section style as prompt change requests */
export function FieldDiffList({ fields, showUnchanged = false }: FieldDiffListProps) {
  const shown = fields.filter((field) =>
    showUnchanged ? field.original !== "" || field.modified !== "" : field.original !== field.modified
  );
  return (
    <div className="space-y-6">
      {shown.map((field) => (
        <div key={field.key}>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">{field.label}</p>
          {field.items ? (
            <ChipListDiff original={field.items.original} modified={field.items.modified} />
          ) : (
            <DiffView original={field.original} modified={field.modified} />
          )}
        </div>
      ))}
    </div>
  );
}
