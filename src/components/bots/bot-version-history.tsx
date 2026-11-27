"use client";

import { SnapshotVersionHistory, type SnapshotVersion } from "@/components/changes/snapshot-version-history";
import { BotDiff, type BotDiffSide } from "@/components/bots/bot-diff";

interface BotVersionHistoryProps {
  versions: SnapshotVersion<BotDiffSide>[];
  current: BotDiffSide;
}

export function BotVersionHistory({ versions, current }: BotVersionHistoryProps) {
  return (
    <SnapshotVersionHistory
      versions={versions}
      current={current}
      renderDiff={(original, modified, { showUnchanged }) => (
        <BotDiff original={original} modified={modified} showUnchanged={showUnchanged} />
      )}
    />
  );
}
