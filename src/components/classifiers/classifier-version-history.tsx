"use client";

import { SnapshotVersionHistory, type SnapshotVersion } from "@/components/changes/snapshot-version-history";
import { ClassifierDiff, type ClassifierDiffSide } from "@/components/classifiers/classifier-diff";

interface ClassifierVersionHistoryProps {
  versions: SnapshotVersion<ClassifierDiffSide>[];
  current: ClassifierDiffSide;
}

export function ClassifierVersionHistory({ versions, current }: ClassifierVersionHistoryProps) {
  return (
    <SnapshotVersionHistory
      versions={versions}
      current={current}
      renderDiff={(original, modified, { showUnchanged }) => (
        <ClassifierDiff original={original} modified={modified} showUnchanged={showUnchanged} />
      )}
    />
  );
}
