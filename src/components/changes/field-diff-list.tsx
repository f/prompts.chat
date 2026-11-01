"use client";

import { DiffView } from "@/components/ui/diff-view";

export interface FieldDiff {
  key: string;
  label: string;
  original: string;
  modified: string;
}

interface FieldDiffListProps {
  fields: FieldDiff[];
  /** Also list fields whose text did not change, e.g. to show a whole version */
  showUnchanged?: boolean;
}

/** One word diff per field, with the same diff viewer and section style as prompt change requests */
export function FieldDiffList({ fields, showUnchanged = false }: FieldDiffListProps) {
  const shown = fields.filter((field) =>
    showUnchanged ? field.original !== "" || field.modified !== "" : field.original !== field.modified
  );
  return (
    <div className="space-y-6">
      {shown.map((field) => (
        <div key={field.key}>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">{field.label}</p>
          <DiffView original={field.original} modified={field.modified} />
        </div>
      ))}
    </div>
  );
}
