/** One entry of a list-like field, e.g. a platform, tag, connector, skill or routine */
export interface DiffItem {
  /** Identity of the item across both sides, e.g. a platform id or a skill name */
  key: string;
  /** Short label shown for the item */
  text: string;
  /** Full content behind the label, e.g. a routine's prompt; a change here alone marks the item changed */
  detail?: string;
}

export type ListDiffEntry =
  | { type: "unchanged"; key: string; text: string }
  | { type: "added"; key: string; text: string }
  | { type: "removed"; key: string; text: string }
  | { type: "changed"; key: string; original: string; modified: string };

/**
 * Item-level diff of two lists: items are matched by key in order (longest common subsequence),
 * so an item present on both sides is never shown as removed and re-added, only items that were
 * added or removed are, and a kept item whose label or detail changed is reported as changed.
 */
export function diffItemLists(original: readonly DiffItem[], modified: readonly DiffItem[]): ListDiffEntry[] {
  const m = original.length;
  const n = modified.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = m - 1; i >= 0; i--) {
    for (let j = n - 1; j >= 0; j--) {
      dp[i][j] = original[i].key === modified[j].key ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }

  const entries: ListDiffEntry[] = [];
  let i = 0;
  let j = 0;
  while (i < m || j < n) {
    if (i < m && j < n && original[i].key === modified[j].key) {
      const before = original[i];
      const after = modified[j];
      entries.push(
        before.text === after.text && (before.detail ?? "") === (after.detail ?? "")
          ? { type: "unchanged", key: after.key, text: after.text }
          : { type: "changed", key: after.key, original: before.text, modified: after.text }
      );
      i++;
      j++;
    } else if (i < m && (j === n || dp[i + 1][j] >= dp[i][j + 1])) {
      entries.push({ type: "removed", key: original[i].key, text: original[i].text });
      i++;
    } else {
      entries.push({ type: "added", key: modified[j].key, text: modified[j].text });
      j++;
    }
  }
  return entries;
}

export interface DiffChip {
  key: string;
  text: string;
  kind: "added" | "removed" | "unchanged" | "changed";
}

/**
 * The diff as chips: a kept item whose label changed becomes its old label removed and its new
 * label added, and one whose label stayed but whose detail changed becomes a single changed chip
 */
export function diffChips(original: readonly DiffItem[], modified: readonly DiffItem[]): DiffChip[] {
  return diffItemLists(original, modified).flatMap((entry): DiffChip[] => {
    if (entry.type !== "changed") return [{ key: `${entry.type}:${entry.key}`, text: entry.text, kind: entry.type }];
    if (entry.original === entry.modified) return [{ key: `changed:${entry.key}`, text: entry.modified, kind: "changed" }];
    return [
      { key: `removed:${entry.key}`, text: entry.original, kind: "removed" },
      { key: `added:${entry.key}`, text: entry.modified, kind: "added" },
    ];
  });
}

/** Items whose key is their text, for plain string lists */
export function textItems(values: readonly string[]): DiffItem[] {
  return values.map((value) => ({ key: value, text: value }));
}
