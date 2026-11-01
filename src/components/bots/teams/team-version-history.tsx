"use client";

import { SnapshotVersionHistory, type SnapshotVersion } from "@/components/changes/snapshot-version-history";
import { TeamDiff } from "@/components/bots/teams/team-diff";
import type { TeamSnapshot } from "@/lib/bots/team-snapshot";

interface TeamVersionHistoryProps {
  versions: SnapshotVersion<TeamSnapshot>[];
  current: TeamSnapshot;
}

export function TeamVersionHistory({ versions, current }: TeamVersionHistoryProps) {
  return (
    <SnapshotVersionHistory
      versions={versions}
      current={current}
      renderDiff={(original, modified, { showUnchanged }) => (
        <TeamDiff original={original} modified={modified} showUnchanged={showUnchanged} />
      )}
    />
  );
}
